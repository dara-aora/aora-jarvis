import { BrainwavePowerBands, LiveMetrics } from "../types";
import { computePlayEnergy } from "./eegEnergy";

export class EEGSimulator {
  private time = 0;
  private focusLevel = 75; // Starting focus level
  private relaxLevel = 50; // Starting relax level
  private baseNoise = 2.5; // uV RMS base noise
  private jawClenchActive = false;
  private eyeBlinkTimer = 0;
  private blinkTriggered = false;
  private lastBlinkProgress = 0;

  constructor() {
    this.randomizeFluctuations();
  }

  // Adjust simulator configuration dynamically
  public setFocusState(focus: number, relax: number) {
    this.focusLevel = Math.max(0, Math.min(100, focus));
    this.relaxLevel = Math.max(0, Math.min(100, relax));
  }

  public triggerJawClench(active: boolean) {
    this.jawClenchActive = active;
  }

  public triggerEyeBlink() {
    this.blinkTriggered = true;
    this.lastBlinkProgress = 0;
  }

  private randomizeFluctuations() {
    setInterval(() => {
      // Gentle drift of focus and relax metrics to simulate true biologics
      this.focusLevel += (Math.random() - 0.5) * 4;
      this.relaxLevel += (Math.random() - 0.5) * 4;
      this.focusLevel = Math.max(10, Math.min(95, this.focusLevel));
      this.relaxLevel = Math.max(10, Math.min(95, this.relaxLevel));

      // Occasional random eye blink simulation (approx every 4-8 seconds)
      if (Math.random() < 0.15 && !this.blinkTriggered) {
        this.triggerEyeBlink();
      }
    }, 2000);
  }

  // Generate the next sample pair (60Hz default frame rate update or high-freq sampling)
  // Behind-the-ear signals typically see Alpha waves clearly when relaxed,
  // and Beta waves when mentally active. Eye blinks are seen as high amplitude positive pulses.
  public nextSample(deltaMs: number): {
    ch1: number;
    ch2: number;
    bands: BrainwavePowerBands;
    metrics: LiveMetrics;
  } {
    this.time += deltaMs / 1000;
    const t = this.time;

    // 1. Synthesize background wave components (Delta, Theta, Alpha, Beta)
    // Map EEG ratios to the configured focus and relaxation levels
    const targetAlphaAmp = this.relaxLevel * 0.25; // Alpha is higher when relaxed
    const targetBetaAmp = this.focusLevel * 0.28; // Beta is higher when focused
    const targetThetaAmp = (100 - this.focusLevel) * 0.18; // Theta represents mental fatigue or idling
    const targetDeltaAmp = 5.0; // Steady small rolling baseline delta

    // Sum multiple sine waves with slightly offset frequencies to prevent periodic repetition patterns
    const deltaWave = targetDeltaAmp * (Math.sin(2 * Math.PI * 2.2 * t) + 0.3 * Math.sin(2 * Math.PI * 1.1 * t));
    const thetaWave = targetThetaAmp * (Math.sin(2 * Math.PI * 5.5 * t) + 0.4 * Math.sin(2 * Math.PI * 6.8 * t));
    const alphaWave = targetAlphaAmp * (Math.sin(2 * Math.PI * 10.2 * t) + 0.5 * Math.sin(2 * Math.PI * 9.5 * t));
    const betaWave = targetBetaAmp * (Math.sin(2 * Math.PI * 18.5 * t) + 0.3 * Math.sin(2 * Math.PI * 24.2 * t) + 0.2 * Math.cos(2 * Math.PI * 15.1 * t));

    // 2. Compute Raw Channel Voltage (Channels in uV, typical EEG signal is -50uV to +50uV)
    let ch1Raw = deltaWave * 0.5 + thetaWave * 0.6 + alphaWave * 0.8 + betaWave * 0.7;
    let ch2Raw = deltaWave * 0.4 + thetaWave * 0.5 + alphaWave * 0.9 + betaWave * 0.6;

    // Inject subtle white-noise/high frequency thermal components
    ch1Raw += (Math.random() - 0.5) * this.baseNoise;
    ch2Raw += (Math.random() - 0.5) * this.baseNoise;

    // 3. Inject transient artifacts
    // A. Masseter Muscle Clench artifact: high frequency, high amplitude (up to 200uV) muscle noise (EMG)
    if (this.jawClenchActive) {
      const jawNoiseCh1 = (Math.random() - 0.5) * 140 * Math.sin(2 * Math.PI * 52 * t);
      const jawNoiseCh2 = (Math.random() - 0.5) * 160 * Math.cos(2 * Math.PI * 48 * t);
      ch1Raw += jawNoiseCh1;
      ch2Raw += jawNoiseCh2;
    }

    // B. Eye Blink artifact: Large positive pulse lasting 150-250ms, strongest around eyes but easily
    // readable behind ears as a prominent standard potential swing.
    let blinkPotential = 0;
    if (this.blinkTriggered) {
      this.lastBlinkProgress += deltaMs / 250; // Blink lasts roughly 250ms
      if (this.lastBlinkProgress >= 1.0) {
        this.blinkTriggered = false;
      } else {
        // Bell curve profile for the blink: sin(progress * PI) ^ 2
        const profile = Math.pow(Math.sin(this.lastBlinkProgress * Math.PI), 3);
        blinkPotential = profile * 85.0; // 85 microvolt spike
        ch1Raw += blinkPotential;
        ch2Raw += blinkPotential * 0.9;
      }
    }

    // 4. Calculate relative power band outputs
    const sumPower = targetDeltaAmp + targetThetaAmp + targetAlphaAmp + targetBetaAmp;
    const bDelta = (targetDeltaAmp / sumPower) * 100;
    const bTheta = (targetThetaAmp / sumPower) * 100;
    const bAlpha = (targetAlphaAmp / sumPower) * 100;
    const bBeta = (targetBetaAmp / sumPower) * 100;

    // Deduce dominant frequency band
    let dominant: "Delta" | "Theta" | "Alpha" | "Beta" = "Alpha";
    if (bBeta > bAlpha && bBeta > bTheta && bBeta > bDelta) dominant = "Beta";
    else if (bAlpha > bBeta && bAlpha > bTheta && bAlpha > bDelta) dominant = "Alpha";
    else if (bTheta > bAlpha && bTheta > bBeta && bTheta > bDelta) dominant = "Theta";
    else dominant = "Delta";

    // Deduce simulated impedance based on jaw clenches or base noise
    const imp: "excellent" | "good" | "poor" = this.jawClenchActive ? "poor" : "excellent";

    const concentration = this.focusLevel / 100;
    const relaxation = this.relaxLevel / 100;
    const stress = this.jawClenchActive
      ? 0.72
      : Math.max(0, Math.min(1, 0.15 + (1 - concentration) * 0.45 + (relaxation > 0.75 ? 0.05 : 0)));
    const playEnergy = computePlayEnergy({ relaxation, concentration, stress });

    return {
      ch1: parseFloat(ch1Raw.toFixed(2)),
      ch2: parseFloat(ch2Raw.toFixed(2)),
      bands: {
        delta: parseFloat(bDelta.toFixed(1)),
        theta: parseFloat(bTheta.toFixed(1)),
        alpha: parseFloat(bAlpha.toFixed(1)),
        beta: parseFloat(bBeta.toFixed(1))
      },
      metrics: {
        focusScore: Math.round(this.focusLevel),
        relaxScore: Math.round(this.relaxLevel),
        stressScore: Math.round(stress * 100),
        noiseLevel: this.jawClenchActive ? 85 : parseFloat((this.baseNoise + (blinkPotential > 0 ? 15 : 0)).toFixed(1)),
        impedanceCh1: imp,
        impedanceCh2: imp,
        ch1Microvolts: parseFloat(ch1Raw.toFixed(2)),
        ch2Microvolts: parseFloat(ch2Raw.toFixed(2)),
        manaLevel: playEnergy,
        dominantBand: dominant
      }
    };
  }
}
