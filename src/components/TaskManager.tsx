import React, { useState } from "react";
import { Task } from "../types";
import { ListTodo, CheckSquare, Plus, BrainCircuit, Trash2, Sliders, Calendar } from "lucide-react";

interface TaskManagerProps {
  tasks: Task[];
  manaLevel: number;
  onAddTask: (task: Omit<Task, "id" | "createdAt" | "priority">) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAutoplanTasks: () => void;
}

export default function TaskManager({
  tasks,
  manaLevel,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
  onAutoplanTasks,
}: TaskManagerProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Task["category"]>("Coding");
  const [manaCost, setManaCost] = useState(20);
  const [focusRequired, setFocusRequired] = useState<"low" | "medium" | "high">("medium");

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

      {/* 1. Left half (Intake / Task Creation Form) inside white Apple space */}
      <div className="lg:col-span-5 bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5 animate-fade-in">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-zinc-900" />
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.25em] font-sans">Task Generator</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Main Title Input */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Objective Name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Code hardware doc schemas..."
              className="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-800 text-xs focus:ring-1 focus:ring-zinc-400 focus:outline-none placeholder:text-zinc-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category selection */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Workspace Domain</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Task["category"])}
                className="bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 text-zinc-700 text-xs focus:outline-none"
              >
                <option value="Coding">Coding</option>
                <option value="Review">Review</option>
                <option value="Health">Health Recovery</option>
                <option value="Creative">Creative</option>
                <option value="Admin">Admin Duties</option>
              </select>
            </div>

            {/* Neural energy score select */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Energy Effort</span>
              <select
                value={focusRequired}
                onChange={(e) => setFocusRequired(e.target.value as "low" | "medium" | "high")}
                className="bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2.5 text-zinc-700 text-xs focus:outline-none"
              >
                <option value="low">Low (Routine)</option>
                <option value="medium">Medium (Deep Work)</option>
                <option value="high">High (Algorithmic)</option>
              </select>
            </div>
          </div>

          {/* Energy Cost slider block */}
          <div className="flex flex-col gap-1 bg-zinc-50/50 p-4 rounded-2xl border border-zinc-150">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Estimated Stamina Cost</span>
              <span className="text-xs font-bold text-zinc-800 font-mono">{manaCost} pts</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={manaCost}
              onChange={(e) => setManaCost(Number(e.target.value))}
              className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-zinc-900 hover:bg-zinc-850 text-white font-medium text-xs py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Enqueue Objective</span>
          </button>
        </form>
      </div>

      {/* 2. Right half (Active Task lists) */}
      <div className="lg:col-span-7 bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5 animate-fade-in">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-zinc-900" />
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.25em] font-sans">Objective Checklist</h2>
          </div>

          <button
            onClick={onAutoplanTasks}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-800 text-[10.5px] font-medium hover:bg-zinc-55 transition-colors cursor-pointer shadow-sm"
            title="Auto-reallocate upcoming queue item sequences automatically"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-zinc-500" />
            <span>Jarvis Autoplan</span>
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-5 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
            <Sliders className="w-6 h-6 text-zinc-400 mb-2" />
            <p className="text-xs text-zinc-800 font-medium">Clear workstation slate.</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Use the generator module to assign new work tasks.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[300px] pr-1">
            <div className="divide-y divide-zinc-100">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between py-3 px-1 transition-all ${
                    task.completed ? "opacity-45" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                    <button
                      onClick={() => onToggleComplete(task.id)}
                      className="text-zinc-300 hover:text-zinc-655 transition-colors shrink-0 cursor-pointer"
                    >
                      <CheckSquare
                        className={`w-5 h-5 transition-all ${task.completed ? "text-emerald-500 fill-emerald-50" : "text-zinc-300 hover:text-zinc-400"}`}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-sans font-semibold text-zinc-800 truncate ${task.completed ? "line-through text-zinc-400" : ""}`}>
                        {task.title}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 font-sans text-[9px] text-zinc-400">
                        <span className={`px-2 py-0.5 rounded-full border text-[8.5px] font-medium tracking-wide ${getCategoryColor(task.category)}`}>
                          {task.category}
                        </span>
                        <span>•</span>
                        <span>Attention Level: <strong className="text-zinc-600 font-medium">{task.focusRequired}</strong></span>
                        <span>•</span>
                        <span>Cost: <strong className="text-zinc-700 font-semibold font-mono">{task.manaCost} EP</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="text-zinc-300 hover:text-rose-500 p-2 rounded-full hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-zinc-400 border-t border-zinc-100 pt-3 font-sans">
          <span>{tasks.filter(t => !t.completed).length} items pending</span>
          <span>Budget Remaining: <strong className="text-zinc-800">{manaLevel} Energy Points</strong></span>
        </div>

      </div>

    </div>
  );
}
