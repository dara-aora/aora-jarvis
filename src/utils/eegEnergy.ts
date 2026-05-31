export interface EegScores {
  relaxation: number;
  concentration: number;
  stress: number;
}

/** Play Energy 0–100 from live Ganglion mental-state scores (each 0–1). */
export function computePlayEnergy(scores: EegScores): number {
  const { relaxation, concentration, stress } = scores;
  const raw = 0.5 * concentration + 0.4 * (1 - stress) + 0.1 * (1 - relaxation);
  return Math.max(5, Math.min(100, Math.round(raw * 100)));
}

export type EnergyAdvisoryType = "rest" | "focus" | "flow" | "ok";

export interface EnergyAdvisory {
  type: EnergyAdvisoryType;
  title: string;
  message: string;
  badge: string;
}

const STRESS_REST_THRESHOLD = 0.55;
const RELAX_FOCUS_THRESHOLD = 0.55;
const CONCENTRATION_LOW = 0.4;
const FLOW_CONCENTRATION = 0.5;
const FLOW_STRESS_MAX = 0.35;

export function getEnergyAdvisory(scores: EegScores): EnergyAdvisory {
  const { relaxation, concentration, stress } = scores;

  if (stress >= STRESS_REST_THRESHOLD) {
    return {
      type: "rest",
      title: "Stress Elevated — Rest Recommended",
      message:
        "Your Ganglion is reading elevated stress signals. Step away, breathe, and recover before taking on more work.",
      badge: "TAKE REST",
    };
  }

  if (relaxation >= RELAX_FOCUS_THRESHOLD && concentration < CONCENTRATION_LOW) {
    return {
      type: "focus",
      title: "Relaxed — Time to Focus",
      message:
        "You're in a calm, relaxed state. Energy is stable — pick a task from your list and concentrate to enter flow.",
      badge: "START TASK",
    };
  }

  if (concentration >= FLOW_CONCENTRATION && stress < FLOW_STRESS_MAX) {
    return {
      type: "flow",
      title: "Focused Flow State",
      message:
        "Concentration is strong and stress is low. This is a good window for deep work on your highest-priority task.",
      badge: "IN FLOW",
    };
  }

  return {
    type: "ok",
    title: "Stable Energy",
    message:
      "Your neural signals show balanced energy. Keep a steady pace and monitor stress if workload increases.",
    badge: "OKAY ENERGY",
  };
}

export function scoresFromPercent(focus: number, relax: number, stress: number): EegScores {
  return {
    concentration: focus / 100,
    relaxation: relax / 100,
    stress: stress / 100,
  };
}
