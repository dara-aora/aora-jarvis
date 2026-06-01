import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckSquare,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
  Zap,
  TrendingDown,
  Target,
} from "lucide-react";
import { Task, LiveMetrics } from "../types";
import {
  energyBarColor,
  getTaskEnergyInsights,
  summarizeTaskEnergy,
} from "../utils/taskEnergy";
import { countMeasuredTasks, isDemoTaskId } from "../data/mockTaskEnergy";

interface TaskAgentPageProps {
  tasks: Task[];
  metrics: LiveMetrics;
  isSimulated: boolean;
  onAddTask: (task: Omit<Task, "id" | "createdAt" | "priority">) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAutoplanTasks: () => void;
  onLoadMockEnergy: () => void;
}

export default function TaskAgentPage({
  tasks,
  metrics,
  isSimulated,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onAutoplanTasks,
  onLoadMockEnergy,
}: TaskAgentPageProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Task["category"]>("Coding");
  const [manaCost, setManaCost] = useState(20);
  const [focusRequired, setFocusRequired] = useState<"low" | "medium" | "high">("medium");

  const summary = summarizeTaskEnergy(tasks);
  const insights = getTaskEnergyInsights(tasks, metrics.manaLevel);
  const completed = tasks.filter((t) => t.completed);
  const pending = tasks.filter((t) => !t.completed);
  const hasDemoRows = tasks.some((t) => isDemoTaskId(t.id));
  const measuredCount = countMeasuredTasks(tasks);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask({
      title: title.trim(),
      completed: false,
      category,
      manaCost: Number(manaCost),
      focusRequired,
    });
    setTitle("");
    setManaCost(20);
  };

  const getCategoryColor = (cat: Task["category"]) => {
    const map = {
      Coding: "text-blue-700 bg-blue-50 border-blue-100",
      Review: "text-amber-700 bg-amber-50 border-amber-100",
      Health: "text-emerald-700 bg-emerald-50 border-emerald-100",
      Creative: "text-purple-700 bg-purple-50 border-purple-100",
      Admin: "text-zinc-650 bg-zinc-50 border-zinc-150",
    };
    return map[cat] || "text-zinc-600 border-zinc-200 bg-zinc-50";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans">
      <header className="border-b border-zinc-200/50 bg-white/70 backdrop-blur-md px-6 md:px-12 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cockpit
            </Link>
            <div className="h-4 w-px bg-zinc-200 hidden sm:block" />
            <div>
              <h1 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Task Energy Agent
              </h1>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {isSimulated ? "Simulated EEG" : "Live Ganglion"} · learns from your neural drain per task
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLoadMockEnergy}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200 bg-white text-zinc-800 text-[10.5px] font-semibold hover:bg-zinc-50 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Load sample energy
            </button>
            <button
              onClick={onAutoplanTasks}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 text-white text-[10.5px] font-semibold hover:bg-zinc-800 transition-colors"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              Autoplan queue
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-10 flex flex-col gap-8 animate-fade-in">
        {(hasDemoRows || measuredCount > 0) && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 text-[11px] text-amber-900">
            <p>
              {hasDemoRows ? (
                <>
                  <strong>Sample energy data</strong> — {measuredCount} completed tasks show estimated vs measured
                  drain (e.g. KiCad audit used <strong className="font-mono">34</strong> vs est.{" "}
                  <strong className="font-mono">20</strong>).
                </>
              ) : (
                <>
                  <strong>{measuredCount} measured tasks.</strong> Click &quot;Load sample energy&quot; to add demo
                  history for the agent.
                </>
              )}
            </p>
            {!hasDemoRows && (
              <button
                type="button"
                onClick={onLoadMockEnergy}
                className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-800 hover:text-amber-950"
              >
                Load samples →
              </button>
            )}
          </div>
        )}

        {/* Summary strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-zinc-200/50 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Energy spent today</p>
            <p className="text-2xl font-bold text-zinc-900 mt-2 font-mono">{summary.totalSpent}</p>
            <p className="text-[10px] text-zinc-400 mt-1">{summary.completedCount} tasks measured</p>
          </div>
          <div className="bg-white border border-zinc-200/50 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Avg per task</p>
            <p className="text-2xl font-bold text-zinc-900 mt-2 font-mono">{summary.avgSpent || "—"}</p>
            <p className="text-[10px] text-zinc-400 mt-1">neural energy points</p>
          </div>
          <div className="bg-white border border-zinc-200/50 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Estimate accuracy</p>
            <p className="text-2xl font-bold text-zinc-900 mt-2 font-mono">{summary.accuracyPct}%</p>
            <p className="text-[10px] text-zinc-400 mt-1">predicted vs measured</p>
          </div>
          <div className="bg-white border border-zinc-200/50 rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Play energy now</p>
            <p className="text-2xl font-bold text-zinc-900 mt-2 font-mono">{metrics.manaLevel}%</p>
            <p className="text-[10px] text-zinc-400 mt-1">remaining capacity</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Agent insights */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-zinc-900 text-white rounded-3xl p-6 md:p-8 shadow-lg flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Actionable agent
                </h2>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                I compare how much energy each task <em>should</em> cost with how much your brainwaves show it
                actually took — so we can improve your daily schedule over time.
              </p>
              <ul className="flex flex-col gap-4">
                {insights.map((insight) => (
                  <li
                    key={insight.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2"
                  >
                    <p className="text-xs font-semibold text-white">{insight.title}</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{insight.detail}</p>
                    {insight.action && (
                      <p className="text-[10px] text-amber-200/90 font-medium flex items-start gap-1.5 mt-1">
                        <Target className="w-3 h-3 shrink-0 mt-0.5" />
                        {insight.action}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <form
              onSubmit={handleSubmit}
              className="bg-white border border-zinc-200/50 rounded-3xl p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-zinc-900" />
                <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Add task</h2>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you need to do?"
                className="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Task["category"])}
                  className="bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 text-xs"
                >
                  <option value="Coding">Coding</option>
                  <option value="Review">Review</option>
                  <option value="Health">Health</option>
                  <option value="Creative">Creative</option>
                  <option value="Admin">Admin</option>
                </select>
                <select
                  value={focusRequired}
                  onChange={(e) => setFocusRequired(e.target.value as Task["focusRequired"])}
                  className="bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 text-xs"
                >
                  <option value="low">Low focus</option>
                  <option value="medium">Medium</option>
                  <option value="high">High focus</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between text-[9px] text-zinc-400 uppercase tracking-widest mb-1">
                  <span>Estimated energy</span>
                  <span className="font-mono font-bold text-zinc-800">{manaCost} pts</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={manaCost}
                  onChange={(e) => setManaCost(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-zinc-900 text-white text-xs font-medium py-3 rounded-2xl hover:bg-zinc-800"
              >
                Enqueue task
              </button>
            </form>
          </section>

          {/* Energy ledger */}
          <section className="lg:col-span-7 bg-white border border-zinc-200/50 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-zinc-900" />
                <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
                  Energy ledger
                </h2>
              </div>
              <span className="text-[10px] text-zinc-400">{pending.length} pending · {completed.length} done</span>
            </div>

            {summary.highestDrain && (
              <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-[11px]">
                <TrendingDown className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-rose-800">
                  <strong>Highest drain:</strong> "{summary.highestDrain.title.slice(0, 60)}
                  {summary.highestDrain.title.length > 60 ? "…" : ""}" used{" "}
                  <strong className="font-mono">{summary.highestDrain.energySpent}</strong> energy (estimated{" "}
                  {summary.highestDrain.manaCost}).
                </p>
              </div>
            )}

            {tasks.length === 0 ? (
              <p className="text-center text-xs text-zinc-400 py-12">No tasks yet — add one to start tracking energy.</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-[520px] overflow-y-auto pr-1">
                {tasks.map((task) => {
                  const spent = task.energySpent;
                  const hasMeasured = task.completed && spent != null;
                  const maxBar = Math.max(task.manaCost, spent ?? 0, 1);

                  return (
                    <div
                      key={task.id}
                      className={`border-b border-zinc-50 py-4 ${task.completed ? "" : "opacity-90"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => onToggleComplete(task.id)}
                            className="shrink-0 mt-0.5 cursor-pointer"
                            title={task.completed ? "Mark incomplete" : "Complete & measure energy"}
                          >
                            <CheckSquare
                              className={`w-5 h-5 ${
                                task.completed
                                  ? "text-emerald-500 fill-emerald-50"
                                  : "text-zinc-300 hover:text-zinc-500"
                              }`}
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={`text-xs font-semibold text-zinc-800 ${
                                  task.completed ? "line-through text-zinc-500" : ""
                                }`}
                              >
                                {task.title}
                              </p>
                              {isDemoTaskId(task.id) && (
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Sample
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[8.5px] font-medium ${getCategoryColor(task.category)}`}
                              >
                                {task.category}
                              </span>
                              <span className="text-[9px] text-zinc-400">
                                Est. <strong className="text-zinc-600 font-mono">{task.manaCost}</strong>
                              </span>
                              {hasMeasured && (
                                <span className="text-[9px] text-zinc-600 font-semibold">
                                  Used <strong className="font-mono text-zinc-900">{spent}</strong> energy
                                </span>
                              )}
                              {!task.completed && (
                                <span className="text-[9px] text-zinc-400 italic">
                                  Complete with headset on to measure
                                </span>
                              )}
                            </div>

                            {/* Dual bar: estimate vs actual */}
                            <div className="mt-3 space-y-2">
                              <div>
                                <div className="flex justify-between text-[8px] text-zinc-400 uppercase tracking-wider mb-1">
                                  <span>Estimated</span>
                                  <span className="font-mono">{task.manaCost}</span>
                                </div>
                                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-zinc-300 rounded-full transition-all"
                                    style={{ width: `${(task.manaCost / maxBar) * 100}%` }}
                                  />
                                </div>
                              </div>
                              {hasMeasured && (
                                <div>
                                  <div className="flex justify-between text-[8px] text-zinc-400 uppercase tracking-wider mb-1">
                                    <span>Measured (you)</span>
                                    <span className="font-mono">{spent}</span>
                                  </div>
                                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${energyBarColor(spent!, task.manaCost)}`}
                                      style={{ width: `${(spent! / maxBar) * 100}%` }}
                                    />
                                  </div>
                                  {task.energyAtCompletion && (
                                    <p className="text-[9px] text-zinc-400 mt-1.5">
                                      At completion: focus {task.energyAtCompletion.focus}% · relax{" "}
                                      {task.energyAtCompletion.relax}% · stress{" "}
                                      {task.energyAtCompletion.stress}%
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="text-zinc-300 hover:text-rose-500 p-1.5 rounded-full hover:bg-rose-50 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] text-zinc-400 border-t border-zinc-100 pt-4">
              <ListTodo className="w-3.5 h-3.5" />
              <span>
                Mark tasks complete on this page or in the Cockpit — energy is captured from your EEG at that moment.
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
