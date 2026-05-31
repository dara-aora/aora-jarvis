import React, { useEffect, useState } from "react";
import { Activity, Radio, Cpu, Zap, Eye } from "lucide-react";

interface DashboardHeaderProps {
  isSimulated: boolean;
  isConnected: boolean;
  onToggleMode: () => void;
  onTriggerBlink: () => void;
  onTriggerClench: (clenched: boolean) => void;
  impedanceCh1: string;
  impedanceCh2: string;
}

export default function DashboardHeader({
  isSimulated,
  isConnected,
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
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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

  return (
    <header className="border-b border-zinc-200/50 bg-white/70 backdrop-blur-md px-6 md:px-12 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
      
      {/* Tiny Logo / Clean Brand Headings */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
        <div>
          <h1 className="text-xs font-bold text-zinc-900 uppercase tracking-[0.25em] font-sans">
            Aora Companion
          </h1>
          <p className="text-[9.5px] text-zinc-400 font-sans mt-0.5 font-medium">BTE Temporal EEG Signal Processor</p>
        </div>
      </div>

      {/* Center Row: Clean Active Signal Indicators (very quiet, Apple style) */}
      <div className="flex flex-wrap items-center gap-5 text-[10px] text-zinc-500 font-sans">
        
        {/* Soft Electrode statuses */}
        <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200/50 px-4 py-1.5 rounded-full">
          <span className="text-zinc-400 font-medium">Electrodes:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="text-zinc-700">Left (Excellent)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="text-zinc-700">Right (Excellent)</span>
          </div>
        </div>

        {/* Minimal Digital Clock */}
        <div className="text-zinc-800 font-mono font-medium tracking-wider min-w-[70px] text-center">
          {timeStr || "00:00:00"}
        </div>
      </div>

      {/* Simulator Tools & Connect Pill handles */}
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
              <span>Active BLE Stream</span>
            </>
          )}
        </button>
      </div>

    </header>
  );
}
