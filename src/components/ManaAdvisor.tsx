import React, { useState, useEffect } from "react";
import { Zap, Clock, Compass, HelpCircle, Activity } from "lucide-react";

interface ManaAdvisorProps {
  manaLevel: number;
  focusScore: number;
  relaxScore: number;
  onReplenishMana: (amount: number) => void;
}

export default function ManaAdvisor({
  manaLevel,
  focusScore,
  relaxScore,
  onReplenishMana,
}: ManaAdvisorProps) {
  const [breathingStep, setBreathingStep] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathingProgress, setBreathingProgress] = useState(0); 
  const [resetFinishedCounter, setResetFinishedCounter] = useState(0);
  const [isResetRunning, setIsResetRunning] = useState(false);

  // Guided diaphragmatic breathing to restore Stamina points
  useEffect(() => {
    if (!isResetRunning) return;

    let progressInterval = setInterval(() => {
      setBreathingProgress((prev) => {
        if (prev >= 100) {
          setBreathingStep((current) => {
            if (current === "inhale") return "hold";
            if (current === "hold") return "exhale";
            
            // Reclaimed points on full cycle completion
            onReplenishMana(8); 
            setResetFinishedCounter((c) => c + 1);
            return "inhale";
          });
          return 0;
        }
        return prev + 2.5; 
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isResetRunning]);

  const toggleResetSession = () => {
    setIsResetRunning(!isResetRunning);
    setBreathingProgress(0);
    setBreathingStep("inhale");
  };

  const getManaRecommendation = () => {
    if (manaLevel > 75) {
      return {
        title: "Optimal Work Phase",
        description: "Your temporal energy level is peak. This constitutes the ideal time window to tackle complex algorithmic tasks, schema design, or KiCad footprint placement.",
        badge: "PEAK OUTPUT"
      };
    } else if (manaLevel > 40) {
      return {
        title: "Stable Work Flow",
        description: "Stamina level is comfortable. Continue documenting hardware modules. Take minor pauses to prevent reaching the exhaustion threshold.",
        badge: "SUSTAINABLE"
      };
    } else {
      return {
        title: "Exhaustion Warning",
        description: "Low stamina levels detected by temporal lobe signals. A brief box breath recharge cycle is recommended to restore cognitive capacity.",
        badge: "RECHARGE ADVISE"
      };
    }
  };

  const rec = getManaRecommendation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

      {/* 1. Left Circle Capacity Card */}
      <div className="bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-6 justify-between animate-fade-in">
        <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-900" />
            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Cognitive Reserves</h2>
          </div>
          <span className="text-[8.5px] font-mono text-zinc-400 uppercase font-semibold">Active State</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 py-1">
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="41" stroke="#f4f4f5" strokeWidth="6" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="41"
                stroke="#1d1d1f"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray="257.6"
                strokeDashoffset={257.6 - (257.6 * manaLevel) / 100}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-sans">
              <span className="text-2xl font-bold text-zinc-900 leading-none">{manaLevel}</span>
              <span className="text-[8.5px] text-zinc-400 font-medium uppercase tracking-wider mt-1">EP LEVEL</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 font-sans text-xs w-full">
            <div className="flex justify-between border-b border-zinc-100 pb-1.5">
              <span className="text-zinc-400 font-medium">Status</span>
              <span className="font-semibold text-zinc-800">
                {manaLevel > 75 ? "Optimal capacity" : manaLevel > 40 ? "Stable balance" : "Exhausted (Low)"}
              </span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 pb-1.5">
              <span className="text-zinc-400 font-medium">Estimated Work Range</span>
              <span className="font-semibold text-zinc-800">{Math.round(manaLevel * 2.5)} mins</span>
            </div>
            <div className="flex justify-between pb-0.5">
              <span className="text-zinc-400 font-medium">Wearable Synced</span>
              <span className="text-emerald-600 font-medium">Verified Active</span>
            </div>
          </div>
        </div>

        {/* Timeline block */}
        <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex flex-col gap-2 font-sans text-xs">
          <div className="flex items-center gap-1.5 text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Optimum Work Timeline Guidance</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-center mt-0.5 text-[9px]">
            <div className="bg-white border border-zinc-200/60 p-2 rounded-xl">
              <div className="text-zinc-800 font-bold uppercase text-[7.5px] tracking-wider">MANDATE</div>
              <div className="text-[10px] text-zinc-900 font-medium mt-1">9AM-12PM</div>
            </div>
            <div className="bg-white border border-zinc-200/60 p-2 rounded-xl">
              <div className="text-zinc-800 font-bold uppercase text-[7.5px] tracking-wider">CHECKLIST</div>
              <div className="text-[10px] text-zinc-900 font-medium mt-1">1PM-4PM</div>
            </div>
            <div className="bg-white border border-zinc-200/60 p-2 rounded-xl">
              <div className="text-rose-600 font-bold uppercase text-[7.5px] tracking-wider">REST</div>
              <div className="text-[10px] text-zinc-900 font-medium mt-1">4PM-6PM</div>
            </div>
            <div className="bg-white border border-zinc-200/60 p-2 rounded-xl">
              <div className="text-zinc-800 font-bold uppercase text-[7.5px] tracking-wider">CREATIVE</div>
              <div className="text-[10px] text-zinc-900 font-medium mt-1">8PM-10PM</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Right Advisor / Guided Breathing Card */}
      <div className="bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-6 justify-between animate-fade-in">
        <div className="flex items-center gap-2 border-b border-zinc-150 pb-3">
          <Compass className="w-4 h-4 text-zinc-900" />
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Cognitive Advice</h2>
        </div>

        {/* Recommendation bubble */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150 flex flex-col gap-1 text-xs">
          <div className="flex justify-between font-sans items-center">
            <span className="text-[9px] font-bold text-zinc-800 uppercase tracking-widest">{rec.title}</span>
            <span className="text-[8.5px] font-semibold bg-white border border-zinc-200 text-zinc-500 px-2 py-0.5 rounded-full uppercase">
              {rec.badge}
            </span>
          </div>
          <p className="mt-1.5 text-zinc-500 font-sans leading-relaxed italic">"{rec.description}"</p>
        </div>

        {/* Guided Breathing module */}
        <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex flex-col gap-3 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-zinc-950" />
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Biometric Alpha Reset</span>
            </div>
            {resetFinishedCounter > 0 && (
              <span className="text-[8px] font-semibold bg-white border border-zinc-200 text-zinc-650 px-2 py-0.5 rounded-full uppercase tracking-wider">
                COMPLETED: {resetFinishedCounter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full bg-white border border-zinc-250 flex items-center justify-center shrink-0 shadow-sm">
              <div 
                className={`absolute rounded-full transition-all duration-300 ${
                  breathingStep === "inhale" ? "bg-zinc-100 border-zinc-300" :
                  breathingStep === "hold" ? "bg-amber-50 border-amber-200" : "bg-zinc-200 border-zinc-400"
                } border`}
                style={{ 
                  width: `${30 + (isResetRunning ? (breathingProgress * 0.65) : 10)}%`, 
                  height: `${30 + (isResetRunning ? (breathingProgress * 0.65) : 10)}%` 
                }}
              />
              <span className="text-[8.5px] font-bold text-zinc-700 uppercase tracking-wider relative z-10 select-none">
                {isResetRunning ? breathingStep : "READY"}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <p className="text-[11px] text-zinc-500 leading-normal font-sans">
                {isResetRunning 
                  ? `Keep constant pacing. Gently ${breathingStep === "hold" ? "Hold" : breathingStep} in unison with the expanding circle bubble.`
                  : "Diaphragmatic breathing spikes Alpha waves instantly, restoring play stamina."
                }
              </p>
              <button
                onClick={toggleResetSession}
                className="w-fit bg-zinc-900 text-white hover:bg-zinc-850 px-3 py-1.5 rounded-xl text-[9.5px] font-medium transition-colors cursor-pointer"
              >
                {isResetRunning ? "Stop Breathing Cycle" : "Commence Box Breathing (+8 EP)"}
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
