import { BrainwavePowerBands, LiveMetrics } from "../types";
import { CAL_SEQUENCE, CalStateKey } from "../components/CalibrationSession";
import { computePlayEnergy } from "./eegEnergy";

export type EegPhase = "connecting" | "calibrating" | "live";

export interface EegScores {
  relaxation: number;
  concentration: number;
  stress: number;
}

export interface EegFatigue {
  score: number | null;
  state: string;
  ready: boolean;
  pct: number;
  coffee_needed: boolean;
  quality: number;
}

export interface EegGesture {
  type: "jaw_clench" | "eye_right" | "eye_left" | null;
  confidence: number;
  ready: boolean;
}

export interface EegDataMessage {
  type: "data";
  state: "relaxation" | "concentration" | "stress";
  scores: EegScores;
  bands: { delta?: number; theta: number; alpha: number; beta: number };
  waveform?: { ch1: number[]; ch2: number[] };
  ch1_uv?: number;
  ch2_uv?: number;
  calibrated: boolean;
  fatigue: EegFatigue;
  gesture: EegGesture;
}

export interface EegStatusMessage {
  type: "status";
  phase: EegPhase;
}

export interface EegCalPhaseMessage {
  type: "cal_phase";
  state: string;
  label: string;
  instruction: string;
  countdown: number;
}

export interface EegCalProgressMessage {
  type: "cal_progress";
  state: string;
  progress: number;
  samples: number;
  waveform?: { ch1: number[]; ch2: number[] };
}

export interface EegSyncMessage {
  type: "sync";
  phase: string;
  cal_state?: string;
  cal_label?: string;
  cal_instruction?: string;
  cal_progress?: number;
  cal_countdown?: number;
  cal_samples?: number;
  cal_done?: string[];
}

export type EegMessage =
  | EegStatusMessage
  | EegCalPhaseMessage
  | EegCalProgressMessage
  | EegSyncMessage
  | { type: "cal_done"; state: string; samples: number }
  | { type: "cal_complete" }
  | EegDataMessage;

export interface EegLiveUpdate {
  phase: EegPhase;
  calState?: string;
  calLabel?: string;
  calInstruction?: string;
  calProgress?: number;
  calCountdown?: number;
  calSamples?: number;
  calDone?: Partial<Record<"relaxation" | "concentration" | "stress", boolean>>;
  calComplete?: boolean;
  mentalState?: EegDataMessage["state"];
  bands: BrainwavePowerBands;
  metrics: LiveMetrics;
  ch1Buffer: number[];
  ch2Buffer: number[];
  fatigue?: EegFatigue;
  gesture?: EegGesture;
}

function bandsToPercentages(bands: EegDataMessage["bands"]): BrainwavePowerBands {
  const delta = bands.delta ?? 0;
  const theta = bands.theta ?? 0;
  const alpha = bands.alpha ?? 0;
  const beta = bands.beta ?? 0;
  const total = delta + theta + alpha + beta || 1;
  return {
    delta: Math.round((delta / total) * 100),
    theta: Math.round((theta / total) * 100),
    alpha: Math.round((alpha / total) * 100),
    beta: Math.round((beta / total) * 100),
  };
}

function dominantFromBands(bands: BrainwavePowerBands): LiveMetrics["dominantBand"] {
  const entries: [LiveMetrics["dominantBand"], number][] = [
    ["Delta", bands.delta],
    ["Theta", bands.theta],
    ["Alpha", bands.alpha],
    ["Beta", bands.beta],
  ];
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function qualityToImpedance(quality: number): LiveMetrics["impedanceCh1"] {
  if (quality >= 0.7) return "excellent";
  if (quality >= 0.45) return "good";
  if (quality >= 0.2) return "poor";
  return "disconnected";
}

export function mapEegDataToLiveUpdate(
  msg: EegDataMessage
): Pick<EegLiveUpdate, "bands" | "metrics" | "ch1Buffer" | "ch2Buffer" | "mentalState" | "fatigue" | "gesture"> {
  const bands = bandsToPercentages(msg.bands);
  const quality = msg.fatigue?.quality ?? 0.8;

  const gestureNoise =
    msg.gesture?.type === "jaw_clench" ? 120 + msg.gesture.confidence * 80 : 15 + msg.scores.stress * 40;

  const playEnergy = computePlayEnergy(msg.scores);

  return {
    mentalState: msg.state,
    bands,
    ch1Buffer: msg.waveform?.ch1 ?? [],
    ch2Buffer: msg.waveform?.ch2 ?? [],
    fatigue: msg.fatigue,
    gesture: msg.gesture,
    metrics: {
      focusScore: Math.round(msg.scores.concentration * 100),
      relaxScore: Math.round(msg.scores.relaxation * 100),
      stressScore: Math.round(msg.scores.stress * 100),
      noiseLevel: Math.round(gestureNoise),
      impedanceCh1: qualityToImpedance(quality),
      impedanceCh2: qualityToImpedance(quality),
      ch1Microvolts: msg.ch1_uv ?? 0,
      ch2Microvolts: msg.ch2_uv ?? 0,
      manaLevel: playEnergy,
      dominantBand: dominantFromBands(bands),
    },
  };
}

export class EegWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private onUpdate: (update: Partial<EegLiveUpdate>) => void;
  private onError: (err: string) => void;
  private phase: EegPhase = "connecting";
  private calDone: Partial<Record<"relaxation" | "concentration" | "stress", boolean>> = {};
  private intentionalDisconnect = false;

  constructor(
    url: string,
    onUpdate: (update: Partial<EegLiveUpdate>) => void,
    onError: (err: string) => void
  ) {
    this.url = url;
    this.onUpdate = onUpdate;
    this.onError = onError;
  }

  connect() {
    this.cleanup(false);
    this.intentionalDisconnect = false;
    this.calDone = {};
    this.phase = "connecting";
    this.onUpdate({ phase: "connecting", calDone: {} });

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.onUpdate({ phase: this.phase });
    };

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as EegMessage;
        this.handleMessage(msg);
      } catch {
        this.onError("Failed to parse EEG server message");
      }
    };

    this.ws.onerror = () => {
      this.onError("EEG server connection error — is eeg_server.py running?");
    };

    this.ws.onclose = () => {
      if (this.intentionalDisconnect) return;
      this.phase = "connecting";
      this.onUpdate({ phase: "connecting" });
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };
  }

  private applyCalProgress(msg: EegCalProgressMessage) {
    const step = CAL_SEQUENCE.find((s) => s.key === msg.state);
    const update: Partial<EegLiveUpdate> = {
      phase: "calibrating",
      calState: msg.state as CalStateKey,
      calProgress: msg.progress,
      calSamples: msg.samples,
      calCountdown: 0,
      calDone: { ...this.calDone },
    };
    if (step) {
      update.calLabel = step.label;
      update.calInstruction = step.instruction;
    }
    if (msg.waveform?.ch1?.length) update.ch1Buffer = msg.waveform.ch1;
    if (msg.waveform?.ch2?.length) update.ch2Buffer = msg.waveform.ch2;
    this.onUpdate(update);
  }

  private applySync(msg: EegSyncMessage) {
    if (msg.phase === "waiting_for_ui" || msg.phase === "connecting") {
      this.onUpdate({ phase: "connecting" });
      return;
    }
    if (msg.phase === "calibrating" && msg.cal_state) {
      this.phase = "calibrating";
      const done: Partial<Record<CalStateKey, boolean>> = {};
      (msg.cal_done ?? []).forEach((k) => { done[k as CalStateKey] = true; });
      this.calDone = done;
      this.onUpdate({
        phase: "calibrating",
        calState: msg.cal_state as CalStateKey,
        calLabel: msg.cal_label,
        calInstruction: msg.cal_instruction,
        calProgress: msg.cal_progress ?? 0,
        calCountdown: msg.cal_countdown ?? 0,
        calSamples: msg.cal_samples ?? 0,
        calDone: { ...this.calDone },
      });
      return;
    }
    if (msg.phase === "live") {
      this.phase = "live";
      this.onUpdate({ phase: "live", calComplete: true, calDone: { ...this.calDone } });
    }
  }

  private handleMessage(msg: EegMessage) {
    if (msg.type === "sync") {
      this.applySync(msg);
      return;
    }

    if (msg.type === "status") {
      this.phase = msg.phase;
      if (msg.phase === "calibrating") {
        this.calDone = {};
        this.onUpdate({ phase: msg.phase, calDone: {} });
      } else {
        this.onUpdate({ phase: msg.phase });
      }
      return;
    }

    if (msg.type === "cal_phase") {
      this.phase = "calibrating";
      this.onUpdate({
        phase: "calibrating",
        calState: msg.state as EegLiveUpdate["calState"],
        calLabel: msg.label,
        calInstruction: msg.instruction,
        calProgress: 0,
        calCountdown: msg.countdown,
        calSamples: 0,
        calDone: { ...this.calDone },
      });
      return;
    }

    if (msg.type === "cal_progress") {
      this.applyCalProgress(msg);
      return;
    }

    if (msg.type === "cal_done") {
      this.calDone[msg.state as keyof typeof this.calDone] = true;
      this.onUpdate({
        calDone: { ...this.calDone },
        calProgress: 1,
      });
      return;
    }

    if (msg.type === "cal_complete") {
      this.phase = "live";
      this.onUpdate({ phase: "live", calProgress: 1, calComplete: true, calDone: { ...this.calDone } });
      return;
    }

    if (msg.type === "data") {
      this.phase = "live";
      const mapped = mapEegDataToLiveUpdate(msg);
      this.onUpdate({ phase: "live", ...mapped });
    }
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.cleanup(true);
  }

  private cleanup(clearReconnect: boolean) {
    if (clearReconnect && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
