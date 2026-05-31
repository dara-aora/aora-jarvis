import { BrainwavePowerBands, LiveMetrics } from "../types";
import { EegScores, getEnergyAdvisory, scoresFromPercent } from "./eegEnergy";

export type TimingVerdict = "optimal" | "good" | "fair" | "avoid";

export interface CircadianGuidance {
  work: { verdict: TimingVerdict; title: string; detail: string };
  sleep: { verdict: TimingVerdict; title: string; detail: string };
  breakNow: boolean;
  breakDetail: string;
  feelSummary: string;
  dominantActivity: "deep_work" | "light_work" | "active_rest" | "wind_down" | "sleep_prep";
}

function verdictRank(v: TimingVerdict): number {
  return { optimal: 4, good: 3, fair: 2, avoid: 1 }[v];
}

export function getCircadianGuidance(
  metrics: LiveMetrics,
  bands: BrainwavePowerBands,
  mentalState?: string
): CircadianGuidance {
  const scores: EegScores = scoresFromPercent(
    metrics.focusScore,
    metrics.relaxScore,
    metrics.stressScore
  );
  const advisory = getEnergyAdvisory(scores);

  const { focusScore: focus, relaxScore: relax, stressScore: stress, manaLevel: mana } = metrics;
  const highAlpha = bands.alpha >= bands.beta && bands.alpha >= 35;
  const highTheta = bands.theta >= 30;
  const highBeta = bands.beta >= 35;

  let workVerdict: TimingVerdict = "fair";
  let workTitle = "Moderate window";
  let workDetail = "Signals are mixed — light tasks or a short focus sprint, then reassess.";

  if (stress >= 60 || mana < 20) {
    workVerdict = "avoid";
    workTitle = "Not ideal for work";
    workDetail = "Stress or depleted mana — recover first (walk, water, 4-4-4 breathing).";
  } else if (focus >= 65 && stress < 45 && mana >= 45) {
    workVerdict = "optimal";
    workTitle = "Prime deep-work window";
    workDetail = "Strong focus, manageable stress, adequate energy — tackle your hardest task now.";
  } else if (focus >= 50 && stress < 55 && mana >= 35) {
    workVerdict = "good";
    workTitle = "Good for focused work";
    workDetail = "Solid concentration — schedule 25–45 minutes on a priority item.";
  } else if (relax >= 55 && focus < 45) {
    workVerdict = "fair";
    workTitle = "Light work only";
    workDetail = "Calm but unfocused — admin, planning, or creative sketching beats deep logic.";
  }

  let sleepVerdict: TimingVerdict = "avoid";
  let sleepTitle = "Stay awake";
  let sleepDetail = "Brain still in active-beta territory — not a natural sleep window yet.";

  if (
    (relax >= 65 && focus < 35 && stress < 50) ||
    (highAlpha && highTheta && mana < 45) ||
    mentalState === "relaxation"
  ) {
    sleepVerdict = "optimal";
    sleepTitle = "Good time to wind down";
    sleepDetail = "Alpha/theta dominant with low arousal — dim lights, screens off, sleep routine in ~30–60 min.";
  } else if (relax >= 55 && focus < 45 && stress < 55 && mana < 50) {
    sleepVerdict = "good";
    sleepTitle = "Sleep soon";
    sleepDetail = "Relaxation rising — finish loose ends, then start winding down within an hour.";
  } else if (stress >= 55 && mana < 40) {
    sleepVerdict = "fair";
    sleepTitle = "Rest, not sleep yet";
    sleepDetail = "Overloaded but wired — calm the nervous system before bed (breathing, no screens).";
  } else if (highBeta && focus >= 55) {
    sleepVerdict = "avoid";
    sleepTitle = "Too alert for sleep";
    sleepDetail = "Beta-dominant focus — expect 1–2+ hours before melatonin-friendly signals appear.";
  }

  const breakNow = stress >= 50 || mana < 30 || advisory.type === "rest";
  const breakDetail = breakNow
    ? stress >= 55
      ? "Take 5–10 min away from screens — box breathing or a short walk."
      : "Energy dipping — micro-break before the next cognitive push."
    : "No mandatory break — stay in rhythm but hydrate.";

  let feelSummary = "Balanced — neither wired nor drowsy.";
  if (stress >= 55) feelSummary = "Likely tense or overloaded.";
  else if (focus >= 65 && stress < 40) feelSummary = "Likely sharp and in the zone.";
  else if (relax >= 60 && focus < 40) feelSummary = "Likely calm, maybe drifting.";
  else if (mana < 35) feelSummary = "Likely mentally fatigued.";
  if (mentalState) {
    feelSummary += ` (${mentalState})`;
  }

  let dominantActivity: CircadianGuidance["dominantActivity"] = "light_work";
  if (sleepVerdict === "optimal" || sleepVerdict === "good") dominantActivity = "sleep_prep";
  else if (workVerdict === "optimal") dominantActivity = "deep_work";
  else if (workVerdict === "avoid" || breakNow) dominantActivity = stress >= 55 ? "wind_down" : "active_rest";
  else if (workVerdict === "good") dominantActivity = "deep_work";

  return {
    work: { verdict: workVerdict, title: workTitle, detail: workDetail },
    sleep: { verdict: sleepVerdict, title: sleepTitle, detail: sleepDetail },
    breakNow,
    breakDetail,
    feelSummary,
    dominantActivity,
  };
}

export function verdictStyles(verdict: TimingVerdict): {
  pill: string;
  ring: string;
  icon: string;
} {
  switch (verdict) {
    case "optimal":
      return {
        pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
        ring: "ring-emerald-400/40",
        icon: "text-emerald-600",
      };
    case "good":
      return {
        pill: "bg-blue-100 text-blue-800 border-blue-200",
        ring: "ring-blue-400/40",
        icon: "text-blue-600",
      };
    case "fair":
      return {
        pill: "bg-amber-100 text-amber-800 border-amber-200",
        ring: "ring-amber-400/40",
        icon: "text-amber-600",
      };
    case "avoid":
      return {
        pill: "bg-rose-100 text-rose-800 border-rose-200",
        ring: "ring-rose-400/40",
        icon: "text-rose-600",
      };
  }
}

/** Pick the stronger recommendation for a one-line headline */
export function primaryTimingHeadline(g: CircadianGuidance): string {
  if (g.sleep.verdict === "optimal") return g.sleep.title;
  if (g.work.verdict === "optimal") return g.work.title;
  if (verdictRank(g.work.verdict) >= verdictRank(g.sleep.verdict)) return g.work.title;
  return g.sleep.title;
}
