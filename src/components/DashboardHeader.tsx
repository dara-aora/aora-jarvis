import React, { useEffect, useState } from "react";
import { Cpu, Radio, Eye } from "lucide-react";
import { EegPhase } from "../utils/eegWebSocketClient";

interface DashboardHeaderProps {
  isSimulated: boolean;
  isConnected: boolean;
  eegPhase?: EegPhase;
  calLabel?: string;
  calProgress?: number;
  mentalState?: string;
  onToggleMode: () => void;
  onTriggerBlink: () => void;
  onTriggerClench: (clenched: boolean) => void;
  impedanceCh1: string;
  impedanceCh2: string;
}

function impedanceLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function impedanceDot(level: string) {
  if (level === "excellent") return "bg-emerald-500";
  if (level === "good") return "bg-lime-500";
  if (level === "poor") return "bg-amber-500";
  return "bg-rose-500";
}

export default function DashboardHeader({
  isSimulated,
  isConnected,
  eegPhase = "connecting",
  calLabel,
  calProgress,
  mentalState,
  onToggleMode,
  onTriggerBlink,
  onTriggerClench,
  impedanceCh1,
  impedanceCh2,
}: DashboardHeaderProps) {
  const [timeStr, setTimeStr] = useState("");
  const [isClenched, setIsClenched] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClenchPress = () => {
    const next = !isClenched;
    setIsClenched(next);
    onTriggerClench(next);
  };

  const liveLabel =
    eegPhase === "calibrating"
      ? `Calibrating${calLabel ? `: ${calLabel}` : ""}${calProgress != null ? ` ${Math.round(calProgress * 100)}%` : ""}`
      : eegPhase === "live"
      ? `Ganglion Live${mentalState ? ` · ${mentalState}` : ""}`
      : "Connecting…";

  return (
    <header className="border-b border-zinc-200/50 bg-white/70 backdrop-blur-md px-6 md:px-12 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
      
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${isSimulated ? "bg-zinc-900" : isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
        <div>
          <h1 className="text-xs font-bold text-zinc-900 uppercase tracking-[0.25em] font-sans">
            Aora Companion
          </h1>
          <p className="text-[9.5px] text-zinc-400 font-sans mt-0.5 font-medium">BTE Temporal EEG Signal Processor</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 text-[10px] text-zinc-500 font-sans">
        <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200/50 px-4 py-1.5 rounded-full">
          <span className="text-zinc-400 font-medium">Electrodes:</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1 h-1 rounded-full ${impedanceDot(impedanceCh1)}`} />
            <span className="text-zinc-700">Left ({impedanceLabel(impedanceCh1)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1 h-1 rounded-full ${impedanceDot(impedanceCh2)}`} />
            <span className="text-zinc-700">Right ({impedanceLabel(impedanceCh2)})</span>
          </div>
        </div>

        <div className="text-zinc-800 font-mono font-medium tracking-wider min-w-[70px] text-center">
          {timeStr || "00:00:00"}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isSimulated && (
          <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/50 p-1.5 rounded-full">
            <button
              onClick={onTriggerBlink}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-zinc-100 text-zinc-700 transition-colors border border-zinc-200 shadow-sm text-[9.5px] font-medium"
              title="Simulate ocular eye blink peak"
            >
              <Eye className="w-2.5 h-2.5 text-zinc-500" />
              <span>Blink</span>
            </button>
            <button
              onClick={handleClenchPress}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all text-[9.5px] font-medium border ${
                isClenched 
                  ? "bg-rose-50 border-rose-200 text-rose-600 font-semibold" 
                  : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 shadow-sm"
              }`}
              title="Simulate jaw clench pressure"
            >
              <span>Clench</span>
            </button>
          </div>
        )}

        <button
          onClick={onToggleMode}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all border ${
            isSimulated 
              ? "bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800" 
              : "bg-emerald-50 border-emerald-150 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {isSimulated ? (
            <>
              <Cpu className="w-3 h-3" />
              <span>Simulated Core</span>
            </>
          ) : (
            <>
              <Radio className="w-3 h-3 animate-ping text-emerald-600" />
              <span>{liveLabel}</span>
            </>
          )}
        </button>
      </div>

    </header>
  );
}
