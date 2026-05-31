import { CAL_SEQUENCE, CalStateKey } from "../components/CalibrationSession";
import { EEGSimulator } from "./eegSimulator";
import {
  EegDataMessage,
  EegLiveUpdate,
  mapEegDataToLiveUpdate,
} from "./eegWebSocketClient";

/** Shortened calibration for local UI testing (production server uses 40s per state). */
const MOCK_CAL_DURATION_SEC = 8;
const MOCK_CAL_TICK_MS = 500;
const MOCK_COUNTDOWN_SEC = 4;
const LIVE_TICK_MS = 500;
const WAVEFORM_LEN = 90;

function delay(ms: number, signal: { aborted: boolean }): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(() => resolve(), ms);
    signal.timers.push(t);
  });
}

function applySimulatorForState(sim: EEGSimulator, state: CalStateKey) {
  switch (state) {
    case "relaxation":
      sim.setFocusState(22, 88);
      sim.triggerJawClench(false);
      break;
    case "concentration":
      sim.setFocusState(86, 28);
      sim.triggerJawClench(false);
      break;
    case "stress":
      sim.setFocusState(58, 22);
      sim.triggerJawClench(true);
      break;
  }
}

function dominantState(
  relaxation: number,
  concentration: number,
  stress: number
): EegDataMessage["state"] {
  const scores = { relaxation, concentration, stress };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as EegDataMessage["state"];
}

/**
 * Emulates the Python EEG WebSocket server for UI testing without hardware.
 */
export class EegMockClient {
  private onUpdate: (update: Partial<EegLiveUpdate>) => void;
  private simulator = new EEGSimulator();
  private calDone: Partial<Record<CalStateKey, boolean>> = {};
  private intentionalDisconnect = false;
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private liveCh1: number[] = [];
  private liveCh2: number[] = [];
  private runSignal = { aborted: false, timers: [] as ReturnType<typeof setTimeout>[] };

  constructor(onUpdate: (update: Partial<EegLiveUpdate>) => void) {
    this.onUpdate = onUpdate;
  }

  connect() {
    this.disconnect();
    this.intentionalDisconnect = false;
    this.calDone = {};
    this.runSignal = { aborted: false, timers: [] };
    this.onUpdate({ phase: "connecting", calDone: {} });
    void this.runSession();
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.runSignal.aborted = true;
    for (const t of this.runSignal.timers) clearTimeout(t);
    this.runSignal.timers = [];
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  private async runSession() {
    await delay(600, this.runSignal);
    if (this.intentionalDisconnect) return;

    this.onUpdate({ phase: "calibrating", calDone: {} });

    for (const step of CAL_SEQUENCE) {
      if (this.intentionalDisconnect) return;
      await this.runCalPhase(step.key, step.label, step.instruction);
      if (this.intentionalDisconnect) return;
      this.calDone[step.key] = true;
      this.onUpdate({
        calDone: { ...this.calDone },
        calProgress: 1,
      });
    }

    this.onUpdate({
      phase: "live",
      calProgress: 1,
      calComplete: true,
      calDone: { ...this.calDone },
    });
    this.startLiveStream();
  }

  private async runCalPhase(
    stateKey: CalStateKey,
    label: string,
    instruction: string
  ) {
    applySimulatorForState(this.simulator, stateKey);

    this.onUpdate({
      phase: "calibrating",
      calState: stateKey,
      calLabel: label,
      calInstruction: instruction,
      calProgress: 0,
      calCountdown: MOCK_COUNTDOWN_SEC,
      calSamples: 0,
      calDone: { ...this.calDone },
    });

    for (let c = MOCK_COUNTDOWN_SEC; c > 0; c--) {
      if (this.intentionalDisconnect) return;
      this.onUpdate({ calCountdown: c, calProgress: 0 });
      await delay(1000, this.runSignal);
    }

    this.onUpdate({ calCountdown: 0 });
    const ch1: number[] = [];
    const ch2: number[] = [];
    let samples = 0;
    const ticks = Math.ceil((MOCK_CAL_DURATION_SEC * 1000) / MOCK_CAL_TICK_MS);

    for (let i = 0; i < ticks; i++) {
      if (this.intentionalDisconnect) return;

      const sample = this.simulator.nextSample(MOCK_CAL_TICK_MS);
      ch1.push(sample.ch1);
      ch2.push(sample.ch2);
      while (ch1.length > WAVEFORM_LEN) ch1.shift();
      while (ch2.length > WAVEFORM_LEN) ch2.shift();
      samples += 1;

      const progress = Math.min((i + 1) / ticks, 1);
      this.onUpdate({
        phase: "calibrating",
        calState: stateKey,
        calLabel: label,
        calInstruction: instruction,
        calProgress: progress,
        calCountdown: 0,
        calSamples: samples,
        calDone: { ...this.calDone },
        ch1Buffer: [...ch1],
        ch2Buffer: [...ch2],
      });

      await delay(MOCK_CAL_TICK_MS, this.runSignal);
    }
  }

  private startLiveStream() {
    if (this.liveTimer) clearInterval(this.liveTimer);

    this.liveTimer = setInterval(() => {
      if (this.intentionalDisconnect) return;

      const sample = this.simulator.nextSample(LIVE_TICK_MS);
      this.liveCh1.push(sample.ch1);
      this.liveCh2.push(sample.ch2);
      while (this.liveCh1.length > WAVEFORM_LEN) this.liveCh1.shift();
      while (this.liveCh2.length > WAVEFORM_LEN) this.liveCh2.shift();

      const relaxation = sample.metrics.relaxScore / 100;
      const concentration = sample.metrics.focusScore / 100;
      const stress = sample.metrics.stressScore / 100;
      const state = dominantState(relaxation, concentration, stress);

      const msg: EegDataMessage = {
        type: "data",
        state,
        scores: {
          relaxation,
          concentration,
          stress,
        },
        bands: {
          delta: sample.bands.delta / 100,
          theta: sample.bands.theta / 100,
          alpha: sample.bands.alpha / 100,
          beta: sample.bands.beta / 100,
        },
        waveform: {
          ch1: [...this.liveCh1],
          ch2: [...this.liveCh2],
        },
        ch1_uv: sample.metrics.ch1Microvolts,
        ch2_uv: sample.metrics.ch2Microvolts,
        calibrated: true,
        fatigue: {
          score: 35,
          state: "alert",
          ready: true,
          pct: 0.5,
          coffee_needed: false,
          quality: 0.85,
        },
        gesture: {
          type: null,
          confidence: 0,
          ready: true,
        },
      };

      this.onUpdate({
        phase: "live",
        ...mapEegDataToLiveUpdate(msg),
      });
    }, LIVE_TICK_MS);
  }
}
