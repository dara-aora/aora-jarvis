import React, { useState, useEffect, useRef, useCallback } from "react";
import DashboardHeader from "./components/DashboardHeader";
import EEGVisualizer from "./components/EEGVisualizer";
import ManaAdvisor from "./components/ManaAdvisor";
import TaskManager from "./components/TaskManager";
import JarvisCompanion from "./components/JarvisCompanion";
import CalibrationSession, { CalStateKey, CAL_SEQUENCE } from "./components/CalibrationSession";

import { Task, ChatMessage, BrainwavePowerBands, LiveMetrics, HistoricalFocusData } from "./types";
import { EEGSimulator } from "./utils/eegSimulator";
import { EegWebSocketClient, EegPhase } from "./utils/eegWebSocketClient";
import { getEnergyAdvisory, scoresFromPercent } from "./utils/eegEnergy";
import { useGeminiLive } from "./hooks/useGeminiLive";

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
    text: "Good day, Sir. Before we begin our collaboration, I need to calibrate your OpenBCI Ganglion electrodes. This takes about two minutes — I'll guide you through three mental states so I can read your brainwaves accurately.",
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
  const [sessionReady, setSessionReady] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [eegPhase, setEegPhase] = useState<EegPhase>("connecting");
  const [calState, setCalState] = useState<CalStateKey | undefined>();
  const [calLabel, setCalLabel] = useState<string | undefined>();
  const [calInstruction, setCalInstruction] = useState<string | undefined>();
  const [calProgress, setCalProgress] = useState<number | undefined>();
  const [calCountdown, setCalCountdown] = useState<number>(0);
  const [calSamples, setCalSamples] = useState<number>(0);
  const [calDone, setCalDone] = useState<Partial<Record<CalStateKey, boolean>>>({});
  const [showCalComplete, setShowCalComplete] = useState(false);
  const [mentalState, setMentalState] = useState<string | undefined>();
  const lastCalStateRef = useRef<string | undefined>();
  
  const [ch1Buffer, setCh1Buffer] = useState<number[]>([]);
  const [ch2Buffer, setCh2Buffer] = useState<number[]>([]);
  const [bands, setBands] = useState<BrainwavePowerBands>({ delta: 15, theta: 25, alpha: 35, beta: 25 });
  const [metrics, setMetrics] = useState<LiveMetrics>({
    focusScore: 75,
    relaxScore: 50,
    stressScore: 25,
    noiseLevel: 25,
    impedanceCh1: "excellent",
    impedanceCh2: "excellent",
    ch1Microvolts: 0.0,
    ch2Microvolts: 0.0,
    manaLevel: 72,
    dominantBand: "Alpha"
  });
  const lastAdvisoryRef = useRef<string>("");

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
  const eegClientRef = useRef<EegWebSocketClient | null>(null);
  const wsConnectedRef = useRef(false);

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
          setMetrics(sample.metrics);

          setCh1Buffer([...ch1Accumulator.current]);
          setCh2Buffer([...ch2Accumulator.current]);
        }
        // Live Ganglion buffers are driven by WebSocket — do not overwrite here
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

  const speakJarvis = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 0.95;
    window.speechSynthesis.speak(u);
  };

  const resetCalState = () => {
    setCalState(undefined);
    setCalLabel(undefined);
    setCalInstruction(undefined);
    setCalProgress(undefined);
    setCalCountdown(0);
    setCalSamples(0);
    setCalDone({});
    setShowCalComplete(false);
    lastCalStateRef.current = undefined;
  };

  const handleEegUpdate = useCallback((update: Partial<import("./utils/eegWebSocketClient").EegLiveUpdate>) => {
    setServerUnreachable(false);
    wsConnectedRef.current = true;
    if (update.phase) {
      setEegPhase(update.phase);
      const connected = update.phase !== "connecting";
      wsConnectedRef.current = connected;
      setIsConnected(connected);
    }
    if (update.calState) {
      setCalState(update.calState as CalStateKey);
      if (update.calState !== lastCalStateRef.current) {
        lastCalStateRef.current = update.calState;
        const step = CAL_SEQUENCE.find((s) => s.key === update.calState);
        if (step) {
          speakJarvis(step.jarvisCue);
          setChatHistory((prev) => [...prev, {
            id: crypto.randomUUID(),
            sender: "jarvis",
            text: `**${step.label} Phase**\n\n${step.jarvisCue}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }]);
        }
      }
    }
    if (update.calLabel !== undefined) setCalLabel(update.calLabel);
    if (update.calInstruction !== undefined) setCalInstruction(update.calInstruction);
    if (update.calProgress !== undefined) setCalProgress(update.calProgress);
    if (update.calCountdown !== undefined) setCalCountdown(update.calCountdown);
    if (update.calSamples !== undefined) setCalSamples(update.calSamples);
    if (update.calDone) setCalDone(update.calDone);
    if (update.calComplete) {
      setShowCalComplete(true);
      speakJarvis("Calibration complete, Sir. Your neural profile is locked in. Enter the companion when you're ready.");
      setChatHistory((prev) => [...prev, {
        id: crypto.randomUUID(),
        sender: "jarvis",
        text: "**Calibration complete.** Your personal baselines are set. Click **Enter Companion** to begin our collaboration with live EEG.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    }
    if (update.mentalState) setMentalState(update.mentalState);
    if (update.ch1Buffer?.length) {
      ch1Accumulator.current = update.ch1Buffer;
      setCh1Buffer([...update.ch1Buffer]);
    }
    if (update.ch2Buffer?.length) {
      ch2Accumulator.current = update.ch2Buffer;
      setCh2Buffer([...update.ch2Buffer]);
    }
    if (update.bands) setBands(update.bands);
    if (update.metrics) {
      setMetrics(update.metrics);
    }
  }, []);

  const handleConnectGanglion = useCallback(() => {
    eegClientRef.current?.disconnect();
    ch1Accumulator.current = [];
    ch2Accumulator.current = [];
    resetCalState();
    setServerUnreachable(false);
    wsConnectedRef.current = false;

    eegClientRef.current = new EegWebSocketClient(
      "ws://localhost:8765",
      handleEegUpdate,
      (err) => console.error("[Ganglion EEG]", err)
    );
    eegClientRef.current.connect();
    setIsSimulated(false);
    setIsStreaming(true);
  }, [handleEegUpdate]);

  // Auto-connect to EEG server on app launch
  useEffect(() => {
    handleConnectGanglion();
    const timeout = setTimeout(() => {
      if (!wsConnectedRef.current) setServerUnreachable(true);
    }, 10000);
    return () => {
      clearTimeout(timeout);
      eegClientRef.current?.disconnect();
    };
  }, [handleConnectGanglion]);

  const handleDisconnectGanglion = () => {
    eegClientRef.current?.disconnect();
    eegClientRef.current = null;
    setIsConnected(false);
    setIsSimulated(true);
    setIsStreaming(true);
    setEegPhase("connecting");
    resetCalState();
    setMentalState(undefined);
  };

  const handleSkipToSimulator = () => {
    eegClientRef.current?.disconnect();
    eegClientRef.current = null;
    setIsSimulated(true);
    setIsConnected(false);
    setIsStreaming(true);
    setSessionReady(true);
    resetCalState();
  };

  const handleEnterApp = () => {
    setSessionReady(true);
    setShowCalComplete(false);
  };

  const handleToggleMode = () => {
    if (!isSimulated) {
      handleDisconnectGanglion();
      setSessionReady(false);
      handleConnectGanglion();
    } else {
      setSessionReady(false);
      handleConnectGanglion();
    }
  };

  // Jarvis advisory when EEG energy state shifts (stress / relaxed / flow)
  useEffect(() => {
    if (!sessionReady || isSimulated) return;
    const advisory = getEnergyAdvisory(
      scoresFromPercent(metrics.focusScore, metrics.relaxScore, metrics.stressScore)
    );
    if (advisory.type === lastAdvisoryRef.current) return;
    lastAdvisoryRef.current = advisory.type;

    if (advisory.type === "ok") return;

    setChatHistory((prev) => [...prev, {
      id: crypto.randomUUID(),
      sender: "jarvis",
      text: `**${advisory.title}**\n\n${advisory.message}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
  }, [metrics.focusScore, metrics.relaxScore, metrics.stressScore, sessionReady, isSimulated]);

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
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAutoplanTasks = () => {
    setTasks((prev) => {
      const pending = prev.filter((t) => !t.completed);
      const completed = prev.filter((t) => t.completed);

      const isHighFocused = metrics.focusScore > 65;
      const isStressed = metrics.stressScore > 55;

      const sortedPending = [...pending].sort((a, b) => {
        if (isStressed) {
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

    const planReview = metrics.stressScore > 55
      ? "Sir, elevated stress is showing on your Ganglion. I reordered rest and recovery tasks to the front of your queue."
      : metrics.relaxScore > 55 && metrics.focusScore < 40
      ? "You're in a relaxed state, Sir. I've surfaced your focus-required tasks — pick one and concentrate to build momentum."
      : "Schedule reordered, Sir. Concentration signals are strong. Deep work tasks have been promoted.";

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

  const handleAddChatMessage = (msg: ChatMessage) => {
    setChatHistory((prev) => [...prev, msg]);
  };

  const [jarvisSpeaking, setJarvisSpeaking] = useState(false);

  const geminiLive = useGeminiLive({
    metrics,
    bands,
    tasks,
    isSimulated,
    mentalState,
    onAddChatMessage: handleAddChatMessage,
    onSpeakingChange: setJarvisSpeaking,
  });

  const energyAdvisory = getEnergyAdvisory(
    scoresFromPercent(metrics.focusScore, metrics.relaxScore, metrics.stressScore)
  );

  const onboardingPhase = showCalComplete
    ? "complete"
    : eegPhase === "calibrating"
    ? "calibrating"
    : "connecting";

  if (!sessionReady) {
    return (
      <CalibrationSession
        phase={onboardingPhase}
        calState={calState}
        calProgress={calProgress ?? 0}
        calCountdown={calCountdown}
        calSamples={calSamples}
        calDone={calDone}
        ch1Buffer={ch1Buffer}
        ch2Buffer={ch2Buffer}
        chatHistory={chatHistory}
        serverUnreachable={serverUnreachable}
        onSkipSimulator={handleSkipToSimulator}
        onEnterApp={handleEnterApp}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans selection:bg-zinc-200 selection:text-zinc-900 overflow-x-hidden relative">
      
      {/* Prime Top Navigation bar styled like Apple header */}
      <DashboardHeader
        isSimulated={isSimulated}
        isConnected={isConnected}
        eegPhase={eegPhase}
        calLabel={calLabel}
        calProgress={calProgress}
        mentalState={mentalState}
        onToggleMode={handleToggleMode}
        onTriggerBlink={handleTriggerBlink}
        onTriggerClench={handleTriggerClench}
        impedanceCh1={metrics.impedanceCh1}
        impedanceCh2={metrics.impedanceCh2}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-12 flex flex-col gap-10 relative z-10 animate-fade-in">
        
        {/* Play Energy — driven by Ganglion relaxation / concentration / stress */}
        <div className="bg-white border border-zinc-200/50 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5 max-w-3xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-zinc-900" />
              <div className="text-left">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Play Energy</span>
                <p className="text-sm font-semibold text-zinc-800 mt-0.5">{metrics.manaLevel}% · {energyAdvisory.badge}</p>
              </div>
            </div>

            <div className="relative flex-1 sm:flex-initial w-full sm:w-56 h-8 bg-zinc-100 rounded-3xl border border-zinc-200 p-1 overflow-hidden">
              <div
                className={`h-full rounded-2xl transition-all duration-500 ease-out ${
                  metrics.manaLevel > 70 ? "bg-zinc-900" : metrics.manaLevel > 40 ? "bg-zinc-500" : "bg-rose-500 animate-pulse"
                }`}
                style={{ width: `${metrics.manaLevel}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-sans text-[10.5px] font-bold text-zinc-550 select-none">
                {metrics.manaLevel}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Relax</p>
              <p className="text-lg font-bold text-emerald-800 mt-1">{metrics.relaxScore}%</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Focus</p>
              <p className="text-lg font-bold text-blue-800 mt-1">{metrics.focusScore}%</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3">
              <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Stress</p>
              <p className="text-lg font-bold text-rose-800 mt-1">{metrics.stressScore}%</p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed text-center italic">"{energyAdvisory.message}"</p>
        </div>

        {/* Core Layout Grid: Left (Floating Jarvis Skin Terminal) vs Right (Checklists) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* COLUMN A: Jarvis — full width during live analysis */}
          <div
            className={`flex flex-col gap-6 ${
              geminiLive.isLiveActive ? "lg:col-span-12" : "lg:col-span-5"
            }`}
          >
            <JarvisCompanion
              metrics={metrics}
              bands={bands}
              mentalState={mentalState}
              tasks={tasks}
              chatHistory={chatHistory}
              onAddChatMessage={handleAddChatMessage}
              isSimulated={isSimulated}
              geminiLive={geminiLive}
              jarvisSpeaking={jarvisSpeaking}
              onAddTask={handleAddTask}
              onAutoplanTasks={handleAutoplanTasks}
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
              onToggleMode={handleToggleMode}
            />
          </div>

          {/* COLUMN B: Task Checklist — tucked below during live session */}
          <div
            className={`lg:col-span-12 ${
              geminiLive.isLiveActive ? "xl:col-span-12" : "xl:col-span-7"
            }`}
          >
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
                  onConnectBLE={handleConnectGanglion}
                  isSimulated={isSimulated}
                  onTriggerBlink={handleTriggerBlink}
                />
              </section>

              <section>
                <ManaAdvisor
                  manaLevel={metrics.manaLevel}
                  focusScore={metrics.focusScore}
                  relaxScore={metrics.relaxScore}
                  stressScore={metrics.stressScore}
                />
              </section>
            </div>
          )}
        </div>

        {/* Minimal Footnote Status bar */}
        <footer className="border-t border-zinc-200 mt-2 pt-5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-zinc-400 gap-3 font-sans font-medium">
          <span>
            COGNITIVE CORE SYNC STATUS:{" "}
            {isSimulated ? (
              <span className="text-zinc-500 font-semibold font-mono">SIMULATED</span>
            ) : eegPhase === "connecting" ? (
              <span className="text-amber-600 font-semibold font-mono animate-pulse">CONNECTING TO GANGLION…</span>
            ) : eegPhase === "calibrating" ? (
              <span className="text-amber-600 font-semibold font-mono">CALIBRATING ({calLabel ?? "…"})</span>
            ) : (
              <span className="text-emerald-600 font-semibold font-mono">
                LIVE — GANGLION{mentalState ? ` (${mentalState.toUpperCase()})` : ""}
              </span>
            )}
          </span>
          <span>AORA COMPANION v6.0 • DESIGNED FOR ZEN</span>
        </footer>

      </main>
    </div>
  );
}
