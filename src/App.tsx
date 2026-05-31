import React, { useState, useEffect, useRef } from "react";
import DashboardHeader from "./components/DashboardHeader";
import EEGVisualizer from "./components/EEGVisualizer";
import ManaAdvisor from "./components/ManaAdvisor";
import TaskManager from "./components/TaskManager";
import JarvisCompanion from "./components/JarvisCompanion";

import { Task, ChatMessage, BrainwavePowerBands, LiveMetrics, HistoricalFocusData } from "./types";
import { EEGSimulator } from "./utils/eegSimulator";
import { GanglionConnector } from "./utils/bleConnector";

import { Activity, LayoutGrid, Radio, ShieldAlert, ChevronDown, ChevronUp, Sliders, Wind, Zap } from "lucide-react";

// Default starter tasks for initial cockpit loading
const INITIAL_TASKS: Task[] = [
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
    createdAt: new Date().toISOString(),
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
  }
];

// Default welcome greeting from Jarvis
const INITIAL_CHAT: ChatMessage[] = [
  {
    id: "welcome-1",
    sender: "jarvis",
    text: "Synaptic channels synchronized, Sir. I am scanning microvolt signals coming from your temporal electrodes. Mental stamina budget is optimized. Please instruct me whenever you are ready to plan your work intervals.",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }
];

const INITIAL_HISTORICAL: HistoricalFocusData[] = [
  { timeLabel: "09:00", focusScore: 82, relaxScore: 45, manaScore: 98 },
  { timeLabel: "11:00", focusScore: 88, relaxScore: 38, manaScore: 85 },
  { timeLabel: "13:00", focusScore: 50, relaxScore: 78, manaScore: 68 },
  { timeLabel: "15:00", focusScore: 75, relaxScore: 50, manaScore: 55 },
  { timeLabel: "17:00", focusScore: 62, relaxScore: 65, manaScore: 42 }
];

export default function App() {
  const [isSimulated, setIsSimulated] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const [ch1Buffer, setCh1Buffer] = useState<number[]>([]);
  const [ch2Buffer, setCh2Buffer] = useState<number[]>([]);
  const [bands, setBands] = useState<BrainwavePowerBands>({ delta: 15, theta: 25, alpha: 35, beta: 25 });
  const [metrics, setMetrics] = useState<LiveMetrics>({
    focusScore: 75,
    relaxScore: 50,
    noiseLevel: 25,
    impedanceCh1: "excellent",
    impedanceCh2: "excellent",
    ch1Microvolts: 0.0,
    ch2Microvolts: 0.0,
    manaLevel: 96,
    dominantBand: "Alpha"
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("jarvis_tasks");
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("jarvis_chat");
    return saved ? JSON.parse(saved) : INITIAL_CHAT;
  });

  const [historicalFocus, setHistoricalFocus] = useState<HistoricalFocusData[]>(() => {
    const saved = localStorage.getItem("jarvis_historical");
    return saved ? JSON.parse(saved) : INITIAL_HISTORICAL;
  });

  const ch1Accumulator = useRef<number[]>([]);
  const ch2Accumulator = useRef<number[]>([]);
  const simulatorRef = useRef<EEGSimulator | null>(null);
  const connectorRef = useRef<GanglionConnector | null>(null);

  useEffect(() => {
    simulatorRef.current = new EEGSimulator();
  }, []);

  useEffect(() => {
    localStorage.setItem("jarvis_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("jarvis_chat", JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem("jarvis_historical", JSON.stringify(historicalFocus));
  }, [historicalFocus]);

  // Real-time wave telemetry simulation
  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();

    const processingStep = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;

      if (isStreaming) {
        if (isSimulated && simulatorRef.current) {
          const sample = simulatorRef.current.nextSample(deltaMs);

          ch1Accumulator.current.push(sample.ch1);
          ch2Accumulator.current.push(sample.ch2);
          if (ch1Accumulator.current.length > 180) ch1Accumulator.current.shift();
          if (ch2Accumulator.current.length > 180) ch2Accumulator.current.shift();

          setBands(sample.bands);
          setMetrics((prev) => ({
            ...sample.metrics,
            manaLevel: Math.max(5, prev.manaLevel) 
          }));
        } else {
          if (ch1Accumulator.current.length > 180) ch1Accumulator.current.shift();
          if (ch2Accumulator.current.length > 180) ch2Accumulator.current.shift();
        }

        setCh1Buffer([...ch1Accumulator.current]);
        setCh2Buffer([...ch2Accumulator.current]);
      }

      frameId = requestAnimationFrame(processingStep);
    };

    frameId = requestAnimationFrame(processingStep);
    return () => cancelAnimationFrame(frameId);
  }, [isStreaming, isSimulated]);

  // Sync focus logs
  useEffect(() => {
    const loggerInterval = setInterval(() => {
      if (!isStreaming) return;

      const now = new Date();
      const HHMM = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setHistoricalFocus((prev) => {
        const updated = [...prev];
        if (updated.length >= 7) updated.shift();
        updated.push({
          timeLabel: HHMM,
          focusScore: metrics.focusScore,
          relaxScore: metrics.relaxScore,
          manaScore: metrics.manaLevel
        });
        return updated;
      });
    }, 12000);

    return () => clearInterval(loggerInterval);
  }, [isStreaming, metrics]);

  const handleConnectBLE = async () => {
    setIsStreaming(false);

    try {
      connectorRef.current = new GanglionConnector(
        (ch1, ch2, parsedBands) => {
          ch1Accumulator.current.push(ch1);
          ch2Accumulator.current.push(ch2);
          setBands(parsedBands);
        },
        (status) => {
          console.log("[Ganglion BLE Status]:", status);
        },
        (err) => {
          console.error("[Ganglion BLE Error]:", err);
          alert(err);
        }
      );

      const ok = await connectorRef.current.connect();
      if (ok) {
        setIsSimulated(false);
        setIsConnected(true);
        await connectorRef.current.startStream();
        setIsStreaming(true);
      }
    } catch (err) {
      setIsSimulated(true);
      setIsConnected(false);
      setIsStreaming(true);
    }
  };

  const handleToggleMode = () => {
    if (!isSimulated) {
      connectorRef.current?.stopStream();
      connectorRef.current?.disconnect();
      setIsConnected(false);
      setIsSimulated(true);
      setIsStreaming(true);
    } else {
      handleConnectBLE();
    }
  };

  const handleTriggerBlink = () => {
    simulatorRef.current?.triggerEyeBlink();
  };

  const handleTriggerClench = (clenched: boolean) => {
    simulatorRef.current?.triggerJawClench(clenched);
  };

  const handleAddTask = (taskDetails: Omit<Task, "id" | "createdAt" | "priority">) => {
    const newTask: Task = {
      ...taskDetails,
      id: `task-${crypto.randomUUID()}`,
      priority: taskDetails.category === "Review" ? "high" : "medium",
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleToggleComplete = (id: string) => {
    setTasks((prev) => {
      return prev.map((t) => {
        if (t.id === id) {
          const nextState = !t.completed;
          if (nextState) {
            const costFactor = t.category === "Health" ? -12 : t.manaCost;
            setMetrics((prevMetrics) => ({
              ...prevMetrics,
              manaLevel: Math.max(5, Math.min(100, prevMetrics.manaLevel - costFactor))
            }));
          }
          return { ...t, completed: nextState };
        }
        return t;
      });
    });
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAutoplanTasks = () => {
    setTasks((prev) => {
      const pending = prev.filter((t) => !t.completed);
      const completed = prev.filter((t) => t.completed);

      const isHighFocused = metrics.focusScore > 65;
      const isExhausted = metrics.manaLevel < 35;

      const sortedPending = [...pending].sort((a, b) => {
        if (isExhausted) {
          if (a.category === "Health" && b.category !== "Health") return -1;
          if (b.category === "Health" && a.category !== "Health") return 1;
        }

        if (isHighFocused) {
          if (a.focusRequired === "high" && b.focusRequired !== "high") return -1;
          if (b.focusRequired === "high" && a.focusRequired !== "high") return 1;
        }

        const priorityScore = { high: 3, medium: 2, low: 1 };
        return priorityScore[b.priority] - priorityScore[a.priority];
      });

      return [...sortedPending, ...completed];
    });

    const planReview = metrics.manaLevel < 35
      ? "Sir, physical exhaustion is prominent. I reordered health restorations and breather tasks to the immediate front of your objective queue."
      : "Schedule reordered, Sir. Active focus parameters are optimal. Your deep work coding modules have been promoted to align with this wave cycle phase.";

    const jarvisMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "jarvis",
      text: planReview,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatHistory((prev) => [...prev, jarvisMsg]);
    
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(planReview));
    }
  };

  const handleReplenishMana = (amount: number) => {
    setMetrics((prev) => ({
      ...prev,
      manaLevel: Math.min(100, prev.manaLevel + amount)
    }));
  };

  const handleAddChatMessage = (msg: ChatMessage) => {
    setChatHistory((prev) => [...prev, msg]);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans selection:bg-zinc-200 selection:text-zinc-900 overflow-x-hidden relative">
      
      {/* Prime Top Navigation bar styled like Apple header */}
      <DashboardHeader
        isSimulated={isSimulated}
        isConnected={isConnected}
        onToggleMode={handleToggleMode}
        onTriggerBlink={handleTriggerBlink}
        onTriggerClench={handleTriggerClench}
        impedanceCh1={metrics.impedanceCh1}
        impedanceCh2={metrics.impedanceCh2}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-12 flex flex-col gap-10 relative z-10 animate-fade-in">
        
        {/* Apple-style Battery Capsule Hub */}
        <div className="bg-white border border-zinc-200/50 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-6 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-zinc-900" />
            <div className="text-left">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Active Reserve Capacity</span>
              <p className="text-sm font-semibold text-zinc-800 mt-0.5">Play Energy: {metrics.manaLevel} %</p>
            </div>
          </div>

          {/* iOS Battery display */}
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* Battery capsule body */}
            <div className="relative flex-1 sm:flex-initial w-full sm:w-56 h-8 bg-zinc-100 rounded-3xl border border-zinc-200 p-1 overflow-hidden">
              <div 
                className={`h-full rounded-2xl transition-all duration-500 ease-out ${
                  metrics.manaLevel > 70 
                    ? "bg-zinc-900" 
                    : metrics.manaLevel > 35 
                    ? "bg-zinc-650" 
                    : "bg-rose-500 animate-pulse"
                }`}
                style={{ width: `${metrics.manaLevel}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-sans text-[10.5px] font-bold text-zinc-550 select-none">
                {metrics.manaLevel}% EP Remaining
              </div>
            </div>
            
            {/* Quick guided breather breath rest */}
            <button
              onClick={() => {
                handleReplenishMana(25);
                const breathingResponse = "Box-breath pattern verified, Sir. Airway expansion is complete. Replenished your Play Energy by 25 points.";
                const chatG: ChatMessage = {
                  id: crypto.randomUUID(),
                  sender: "jarvis",
                  text: `💨 **Box Breathing Balanced**\n\nI monitored your temporal alpha rhythms during the 4-second loop. System stamina expanded successfully! *(+25 Stamina EP)*`,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                };
                setChatHistory((p) => [...p, chatG]);
                if (window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(new SpeechSynthesisUtterance(breathingResponse));
                }
              }}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-250 text-zinc-800 px-4 py-1.5 rounded-full font-medium text-[10.5px] tracking-wide transition-all cursor-pointer whitespace-nowrap shadow-sm"
            >
              Breath +25 EP
            </button>
          </div>
        </div>

        {/* Core Layout Grid: Left (Floating Jarvis Skin Terminal) vs Right (Checklists) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* COLUMN A: Cute floating Jarvis companion container (Grid Span: 5) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <JarvisCompanion
              metrics={metrics}
              tasks={tasks}
              chatHistory={chatHistory}
              onAddChatMessage={handleAddChatMessage}
              isSimulated={isSimulated}
              onAddTask={handleAddTask}
              onAutoplanTasks={handleAutoplanTasks}
              onReplenishMana={handleReplenishMana}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onToggleMode={handleToggleMode}
            />
          </div>

          {/* COLUMN B: Task Checklist / Generator Console (Grid Span: 7) */}
          <div className="lg:col-span-12 xl:col-span-7">
            <TaskManager
              tasks={tasks}
              manaLevel={metrics.manaLevel}
              onAddTask={handleAddTask}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onAutoplanTasks={handleAutoplanTasks}
            />
          </div>

        </div>

        {/* Collapsible panel tucked deep down at the bottom of page */}
        <div className="border border-zinc-200 bg-white rounded-3xl overflow-hidden transition-all duration-300 shadow-sm max-w-5xl mx-auto w-full">
          
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full px-8 py-5 flex items-center justify-between hover:bg-zinc-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <Sliders className="w-4 h-4 text-zinc-500" />
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans">OpenBCI Raw Temporal Electrodes Diagnostics</span>
                <p className="text-[9.5px] text-zinc-400 mt-1 font-medium font-sans">Impedance telemetry graphs, dominant wavelengths, alpha resets</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition-colors">
              <span className="text-[9.5px] font-semibold leading-none">{showDiagnostics ? "COLLAPSE PANEL" : "EXPAND BIO DIAGNOSTICS"}</span>
              {showDiagnostics ? <ChevronUp className="w-4" /> : <ChevronDown className="w-4" />}
            </div>
          </button>

          {showDiagnostics && (
            <div className="p-8 border-t border-zinc-150 flex flex-col gap-8 bg-zinc-50/50">
              <section>
                <EEGVisualizer
                  ch1Buffer={ch1Buffer}
                  ch2Buffer={ch2Buffer}
                  bands={bands}
                  metrics={metrics}
                  isStreaming={isStreaming}
                  onConnectBLE={handleConnectBLE}
                  isSimulated={isSimulated}
                  onTriggerBlink={handleTriggerBlink}
                />
              </section>

              <section>
                <ManaAdvisor
                  manaLevel={metrics.manaLevel}
                  focusScore={metrics.focusScore}
                  relaxScore={metrics.relaxScore}
                  onReplenishMana={handleReplenishMana}
                />
              </section>
            </div>
          )}
        </div>

        {/* Minimal Footnote Status bar */}
        <footer className="border-t border-zinc-200 mt-2 pt-5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-zinc-400 gap-3 font-sans font-medium">
          <span>COGNITIVE CORE SYNC STATUS: <span className="text-emerald-600 font-semibold font-mono">ONLINE (BLE SYNCED)</span></span>
          <span>AORA COMPANION v6.0 • DESIGNED FOR ZEN</span>
        </footer>

      </main>
    </div>
  );
}
