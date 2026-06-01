import { Task, TaskEnergySnapshot } from "../types";

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const snap = (focus: number, relax: number, stress: number, mana: number): TaskEnergySnapshot => ({
  focus,
  relax,
  stress,
  mana,
});

/** Patch energy fields onto existing starter tasks by id. */
export const MOCK_ENERGY_BY_TASK_ID: Record<
  string,
  Pick<Task, "completed" | "energySpent" | "completedAt" | "energyAtCompletion">
> = {
  "task-2": {
    completed: true,
    energySpent: 12,
    completedAt: hoursAgo(2),
    energyAtCompletion: snap(68, 72, 18, 78),
  },
};

/** Extra completed tasks shown when few real measurements exist. */
export const MOCK_DEMO_COMPLETED_TASKS: Task[] = [
  {
    id: "demo-task-kiad",
    title: "KiCad copper layer audit & shielding documentation",
    completed: true,
    priority: "high",
    manaCost: 20,
    category: "Review",
    focusRequired: "high",
    createdAt: hoursAgo(26),
    completedAt: hoursAgo(4),
    energySpent: 34,
    energyAtCompletion: snap(82, 41, 38, 58),
  },
  {
    id: "demo-task-standup",
    title: "Team standup and sprint backlog grooming",
    completed: true,
    priority: "medium",
    manaCost: 12,
    category: "Admin",
    focusRequired: "low",
    createdAt: hoursAgo(30),
    completedAt: hoursAgo(6),
    energySpent: 9,
    energyAtCompletion: snap(55, 68, 22, 71),
  },
  {
    id: "demo-task-api",
    title: "Implement WebSocket reconnect logic for Ganglion stream",
    completed: true,
    priority: "high",
    manaCost: 25,
    category: "Coding",
    focusRequired: "high",
    createdAt: hoursAgo(48),
    completedAt: hoursAgo(8),
    energySpent: 41,
    energyAtCompletion: snap(88, 35, 44, 52),
  },
  {
    id: "demo-task-walk",
    title: "15-minute outdoor walk — circadian reset",
    completed: true,
    priority: "low",
    manaCost: 8,
    category: "Health",
    focusRequired: "low",
    createdAt: hoursAgo(20),
    completedAt: hoursAgo(1),
    energySpent: 6,
    energyAtCompletion: snap(48, 85, 12, 84),
  },
  {
    id: "demo-task-wireframes",
    title: "Companion UI wireframes for energy dashboard",
    completed: true,
    priority: "medium",
    manaCost: 18,
    category: "Creative",
    focusRequired: "medium",
    createdAt: hoursAgo(72),
    completedAt: hoursAgo(20),
    energySpent: 22,
    energyAtCompletion: snap(71, 58, 28, 64),
  },
];

const MIN_MEASURED_FOR_DEMO = 3;

export function countMeasuredTasks(tasks: Task[]): number {
  return tasks.filter((t) => t.completed && t.energySpent != null).length;
}

/** Merge mock energy onto saved tasks; append demo rows if needed. */
export function ensureMockEnergyDemo(tasks: Task[]): Task[] {
  const merged = tasks.map((t) => {
    const patch = MOCK_ENERGY_BY_TASK_ID[t.id];
    if (!patch) return t;
    if (t.energySpent != null) return t;
    return { ...t, ...patch };
  });

  const measured = countMeasuredTasks(merged);
  if (measured >= MIN_MEASURED_FOR_DEMO) return merged;

  const ids = new Set(merged.map((t) => t.id));
  const extras = MOCK_DEMO_COMPLETED_TASKS.filter((t) => !ids.has(t.id));
  return [...merged, ...extras];
}

export function isDemoTaskId(id: string): boolean {
  return id.startsWith("demo-task-");
}

/** Replace / append full sample dataset (Task Agent “Load samples” button). */
export function applyFullMockEnergyDataset(tasks: Task[]): Task[] {
  const withoutDemo = tasks.filter((t) => !isDemoTaskId(t.id));
  const patched = withoutDemo.map((t) => {
    const patch = MOCK_ENERGY_BY_TASK_ID[t.id];
    if (!patch) return t;
    return { ...t, ...patch };
  });
  const ids = new Set(patched.map((t) => t.id));
  const extras = MOCK_DEMO_COMPLETED_TASKS.filter((t) => !ids.has(t.id));
  return [...patched, ...extras];
}

/** Full starter list with mock measurements (fresh installs). */
export function getInitialTasksWithMockEnergy(): Task[] {
  return ensureMockEnergyDemo([
    {
      id: "task-1",
      title: "Complete hardware compliance spec drafts about Aora Nano's internal routing schema",
      completed: false,
      priority: "high",
      manaCost: 20,
      category: "Review",
      focusRequired: "high",
      createdAt: new Date().toISOString(),
    },
    {
      id: "task-2",
      title: "Verify contact impedance behind left temporal earlobe relative to GND pins",
      completed: true,
      priority: "medium",
      manaCost: 15,
      category: "Health",
      focusRequired: "low",
      createdAt: hoursAgo(24),
    },
    {
      id: "task-3",
      title: "Conduct 4-4-4 diaphragmatic breathing neural reset to restore battery power",
      completed: false,
      priority: "low",
      manaCost: 10,
      category: "Health",
      focusRequired: "low",
      createdAt: new Date().toISOString(),
    },
  ]);
}
