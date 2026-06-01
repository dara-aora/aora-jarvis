import { LiveMetrics, Task } from "../types";

/** Neural energy drained when completing a task (0–100), blended with estimate. */
export function computeTaskEnergySpent(metrics: LiveMetrics, estimatedCost: number): number {
  const neuralLoad = metrics.stressScore * 0.45 + (100 - metrics.relaxScore) * 0.25 + metrics.focusScore * 0.15;
  const blended = neuralLoad * 0.55 + estimatedCost * 0.45;
  return Math.max(5, Math.min(100, Math.round(blended)));
}

export interface TaskEnergyInsight {
  id: string;
  title: string;
  detail: string;
  action?: string;
}

export interface TaskEnergySummary {
  totalSpent: number;
  totalEstimated: number;
  completedCount: number;
  avgSpent: number;
  highestDrain?: Task;
  accuracyPct: number;
}

export function summarizeTaskEnergy(tasks: Task[]): TaskEnergySummary {
  const completed = tasks.filter((t) => t.completed && t.energySpent != null);
  const totalSpent = completed.reduce((s, t) => s + (t.energySpent ?? 0), 0);
  const totalEstimated = completed.reduce((s, t) => s + t.manaCost, 0);
  const avgSpent = completed.length ? Math.round(totalSpent / completed.length) : 0;
  const highestDrain = completed.length
    ? completed.reduce((a, b) => ((a.energySpent ?? 0) >= (b.energySpent ?? 0) ? a : b))
    : undefined;
  const accuracyPct =
    totalEstimated > 0 ? Math.round((1 - Math.abs(totalSpent - totalEstimated) / totalEstimated) * 100) : 100;

  return {
    totalSpent,
    totalEstimated,
    completedCount: completed.length,
    avgSpent,
    highestDrain,
    accuracyPct: Math.max(0, Math.min(100, accuracyPct)),
  };
}

export function getTaskEnergyInsights(tasks: Task[], manaLevel: number): TaskEnergyInsight[] {
  const insights: TaskEnergyInsight[] = [];
  const completed = tasks.filter((t) => t.completed && t.energySpent != null);
  const pending = tasks.filter((t) => !t.completed);

  if (completed.length === 0) {
    insights.push({
      id: "no-data",
      title: "Building your energy profile",
      detail: "Complete tasks while wearing the Ganglion so I can learn how much each type of work costs you.",
      action: "Mark a task done after you finish it to record neural energy.",
    });
    return insights;
  }

  const overBudget = completed.filter((t) => (t.energySpent ?? 0) > t.manaCost * 1.25);
  if (overBudget.length >= 2) {
    const cats = [...new Set(overBudget.map((t) => t.category))].join(", ");
    insights.push({
      id: "over-budget",
      title: "Tasks cost more than expected",
      detail: `${overBudget.length} completed tasks used significantly more energy than estimated — often in ${cats}.`,
      action: "Schedule recovery blocks before similar work, or break objectives into smaller chunks.",
    });
  }

  const highFocusDrain = completed.filter(
    (t) => t.focusRequired === "high" && (t.energySpent ?? 0) > 35
  );
  if (highFocusDrain.length >= 1) {
    insights.push({
      id: "deep-work",
      title: "Deep focus is expensive for you",
      detail: `High-attention tasks average ${Math.round(
        highFocusDrain.reduce((s, t) => s + (t.energySpent ?? 0), 0) / highFocusDrain.length
      )} energy points — plan them when Play Energy is above 60%.`,
      action: "Use Astra Autoplan when your Ganglion shows strong concentration.",
    });
  }

  const healthTasks = completed.filter((t) => t.category === "Health");
  if (healthTasks.length >= 1) {
    const avg = Math.round(
      healthTasks.reduce((s, t) => s + (t.energySpent ?? 0), 0) / healthTasks.length
    );
    insights.push({
      id: "recovery",
      title: "Recovery tasks are working",
      detail: `Health and reset tasks average ${avg} energy — ${avg < 20 ? "low cost" : "moderate cost"} on your nervous system.`,
      action: avg > 25 ? "Try shorter breathing resets between heavy cognitive blocks." : "Keep stacking micro-recovery between deep work.",
    });
  }

  if (manaLevel < 40 && pending.some((t) => t.focusRequired === "high")) {
    insights.push({
      id: "low-mana",
      title: "Energy reserve is low",
      detail: `Play Energy is at ${manaLevel}%. High-focus pending tasks may deplete you further today.`,
      action: "Tackle Admin or Health tasks first, or postpone algorithmic work until tomorrow morning.",
    });
  }

  const accurate = completed.filter(
    (t) => Math.abs((t.energySpent ?? 0) - t.manaCost) <= t.manaCost * 0.2
  );
  if (accurate.length >= 2 && insights.length < 3) {
    insights.push({
      id: "calibrated",
      title: "Estimates are aligning with reality",
      detail: "Your predicted stamina costs match measured neural drain — I'll use this to plan smarter days.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "steady",
      title: "Steady energy pattern",
      detail: "No strong anomalies yet. Keep completing tasks with the headset on to refine daily scheduling.",
    });
  }

  return insights.slice(0, 4);
}

export function energyBarColor(spent: number, estimated: number): string {
  const ratio = spent / Math.max(estimated, 1);
  if (ratio > 1.3) return "bg-rose-500";
  if (ratio > 1.05) return "bg-amber-500";
  return "bg-zinc-900";
}
