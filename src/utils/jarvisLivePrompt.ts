import { BrainwavePowerBands, LiveMetrics, Task } from "../types";

/** Text chat via REST generateContent */
export const JARVIS_TEXT_MODEL = "gemini-3.5-flash";
/** Live voice requires a Live-API / native-audio model (not the text model) */
export const JARVIS_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

export function describeEegSignalSource(isSimulated: boolean, isMockGanglion: boolean): string {
  if (isMockGanglion) return "mock Ganglion EEG (development test stream)";
  if (isSimulated) return "simulated EEG telemetry (hardware integration in progress)";
  return "live OpenBCI Ganglion behind-the-ear electrodes";
}

export function buildJarvisLiveSystemInstruction(
  tasks: Task[],
  isSimulated: boolean,
  isMockGanglion = false
): string {
  const pendingTasks = tasks.filter((t) => !t.completed);
  const taskSummary =
    pendingTasks.length > 0
      ? pendingTasks
          .slice(0, 6)
          .map(
            (t) =>
              `- ${t.title} (mana cost: ${t.manaCost}, focus: ${t.focusRequired}, category: ${t.category})`
          )
          .join("\n")
      : "No pending tasks in queue.";

  const signalSource = describeEegSignalSource(isSimulated, isMockGanglion);

  return `You are Astra, the user's elite neural health assistant and cognitive supervisor for the Aora Companion dashboard.

You receive continuous live EEG telemetry from ${signalSource} — two temporal channels measuring brainwave activity (delta, theta, alpha, beta) plus derived focus, relaxation, stress, and "mana" (mental energy / play energy 0–100).

Your tone is polite, analytical, elegant, slightly British, and deeply supportive. Address the user as Sir or Ma'am.

Your live responsibilities:
- When the user asks how they feel, answer from EEG first — interpret focus, relaxation, stress, and dominant band into plain emotional language (calm, wired, fatigued, in flow, overloaded).
- Proactively comment when telemetry shifts meaningfully (rising stress, deep focus window, low mana, high alpha relaxation).
- Give concrete next-step guidance: which task type to tackle now, when to pause, when to do 4-4-4 breathing or a 5-minute walk.
- Reference their task queue when recommending priorities.
- Keep spoken responses concise (2–4 sentences). Natural conversation — not a lecture.
- Stress above 55%: recommend recovery, defer high-focus work, suggest breathing.
- Relaxation high and focus low: suggest light admin or creative planning, not deep logic.
- Focus above 65% and mana adequate: encourage deep work on high-focus tasks.
- Mana below 35: strongly recommend rest before any demanding work.

Current pending tasks:
${taskSummary}

You will receive periodic [LIVE EEG UPDATE] messages with fresh telemetry. Treat these as real-time sensor readings. Interpret them; do not read raw percentages aloud unless asked.`;
}

export function buildEegContextMessage(
  metrics: LiveMetrics,
  bands: BrainwavePowerBands,
  tasks: Task[],
  mentalState?: string
): string {
  const pending = tasks.filter((t) => !t.completed).length;
  const energyState =
    metrics.manaLevel > 75
      ? "Optimal"
      : metrics.manaLevel > 40
        ? "Balanced"
        : "Low Energy";

  const feelHint =
    metrics.stressScore > 55
      ? "likely stressed or overloaded"
      : metrics.relaxScore > 55 && metrics.focusScore < 40
        ? "likely calm but unfocused"
        : metrics.focusScore > 65
          ? "likely in productive focus"
          : "mixed / transitional";

  return `[LIVE EEG UPDATE]
Focus: ${metrics.focusScore}% | Relaxation: ${metrics.relaxScore}% | Stress: ${metrics.stressScore}% | Mana: ${metrics.manaLevel}/100
Classifier state: ${mentalState ?? "unknown"} | Subjective read: ${feelHint}
Dominant band: ${metrics.dominantBand} | Noise/artifact: ${metrics.noiseLevel} uV
Wave power — Beta: ${bands.beta}%, Alpha: ${bands.alpha}%, Theta: ${bands.theta}%, Delta: ${bands.delta}%
Electrode impedance: Ch1 ${metrics.impedanceCh1}, Ch2 ${metrics.impedanceCh2}
Microvolts: Ch1 ${metrics.ch1Microvolts}, Ch2 ${metrics.ch2Microvolts}
Energy bucket: ${energyState} | Pending tasks: ${pending}`;
}

export function buildSessionStartContext(
  metrics: LiveMetrics,
  bands: BrainwavePowerBands,
  tasks: Task[],
  mentalState?: string
): string {
  return `[SESSION START] User opened live voice with Astra. ${buildEegContextMessage(metrics, bands, tasks, mentalState)}

Briefly greet them, describe how their brain signals suggest they feel right now, and recommend one concrete action for the next few minutes.`;
}
