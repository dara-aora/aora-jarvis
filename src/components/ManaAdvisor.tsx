import React from "react";
import { Zap, Activity } from "lucide-react";
import { getEnergyAdvisory, scoresFromPercent } from "../utils/eegEnergy";

interface ManaAdvisorProps {
  manaLevel: number;
  focusScore: number;
  relaxScore: number;
  stressScore: number;
}

export default function ManaAdvisor({
  manaLevel,
  focusScore,
  relaxScore,
  stressScore,
}: ManaAdvisorProps) {
  const advisory = getEnergyAdvisory(scoresFromPercent(focusScore, relaxScore, stressScore));

  const badgeColor =
    advisory.type === "rest"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : advisory.type === "focus"
      ? "bg-blue-50 border-blue-200 text-blue-700"
      : advisory.type === "flow"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : "bg-zinc-50 border-zinc-200 text-zinc-600";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-900" />
            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Play Energy</h2>
          </div>
          <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full border uppercase ${badgeColor}`}>
            {advisory.badge}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 py-1">
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="41" stroke="#f4f4f5" strokeWidth="6" fill="transparent" />
              <circle
                cx="50" cy="50" r="41"
                stroke={advisory.type === "rest" ? "#e11d48" : advisory.type === "flow" ? "#059669" : "#1d1d1f"}
                strokeWidth="6" fill="transparent"
                strokeDasharray="257.6"
                strokeDashoffset={257.6 - (257.6 * manaLevel) / 100}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-sans">
              <span className="text-2xl font-bold text-zinc-900 leading-none">{manaLevel}</span>
              <span className="text-[8.5px] text-zinc-400 font-medium uppercase tracking-wider mt-1">ENERGY</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 font-sans text-xs w-full">
            <div className="flex justify-between border-b border-zinc-100 pb-1.5">
              <span className="text-zinc-400 font-medium">Relaxation</span>
              <span className="font-semibold text-emerald-700">{relaxScore}%</span>
            </div>
            <div className="flex justify-between border-b border-zinc-100 pb-1.5">
              <span className="text-zinc-400 font-medium">Concentration</span>
              <span className="font-semibold text-blue-700">{focusScore}%</span>
            </div>
            <div className="flex justify-between pb-0.5">
              <span className="text-zinc-400 font-medium">Stress</span>
              <span className="font-semibold text-rose-700">{stressScore}%</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-zinc-400 text-center">
          Energy is computed live from your Ganglion EEG — not from voice or manual input.
        </p>
      </div>

      <div className="bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center gap-2 border-b border-zinc-150 pb-3">
          <Activity className="w-4 h-4 text-zinc-900" />
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Astra Advisory</h2>
        </div>

        <div className={`p-5 rounded-2xl border flex flex-col gap-2 ${badgeColor}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest">{advisory.title}</span>
          <p className="text-sm leading-relaxed">{advisory.message}</p>
        </div>

        {advisory.type === "rest" && (
          <p className="text-xs text-zinc-500 italic">
            Tip: Close your eyes, slow your breathing, and step away from screens until stress drops below 55%.
          </p>
        )}
        {advisory.type === "focus" && (
          <p className="text-xs text-zinc-500 italic">
            Tip: Choose one task from your checklist and work on it for 25 minutes to shift into concentration.
          </p>
        )}
      </div>
    </div>
  );
}
