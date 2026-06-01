import React, { useEffect, useRef, useState } from "react";
import { Radio, Wind, Target, Zap, CheckCircle2, Sparkles, ArrowRight, Cpu, FlaskConical } from "lucide-react";
import { ChatMessage } from "../types";

export type CalStateKey = "relaxation" | "concentration" | "stress";

export interface CalStep {
  key: CalStateKey;
  label: string;
  emoji: string;
  visual: string;
  visualLabel: string;
  instruction: string;
  astraCue: string;
  breatheIn: number;
  breatheOut: number;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  glowColor: string;
}

export const CAL_SEQUENCE: CalStep[] = [
  {
    key: "relaxation",
    label: "RELAXED",
    emoji: "🌊",
    visual: "🌿",
    visualLabel: "Forest · Ocean · Peace",
    instruction: "Close your eyes · breathe slowly · clear your mind completely",
    astraCue: "Sir, let's begin with relaxation. Close your eyes and breathe with the rhythm. I am mapping your alpha wave baseline.",
    breatheIn: 4,
    breatheOut: 6,
    color: "#059669",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    textClass: "text-emerald-700",
    glowColor: "rgba(16,185,129,0.15)",
  },
  {
    key: "concentration",
    label: "FOCUSED",
    emoji: "🎯",
    visual: "🔢",
    visualLabel: "Numbers · Logic · Precision",
    instruction: "Eyes open · solve 300 − 7 − 7 − 7… keep going · stay locked in",
    astraCue: "Excellent. Now focus intently — mental arithmetic, eyes open. I am recording your beta concentration signature.",
    breatheIn: 4,
    breatheOut: 4,
    color: "#2563eb",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    textClass: "text-blue-700",
    glowColor: "rgba(37,99,235,0.15)",
  },
  {
    key: "stress",
    label: "STRESSED",
    emoji: "⚡",
    visual: "⏱",
    visualLabel: "Deadline · Urgency · Tension",
    instruction: "Feel a real deadline · heart racing · pressure building now",
    astraCue: "Final phase — invoke genuine pressure. Imagine a deadline approaching. One more minute and your profile is complete.",
    breatheIn: 2,
    breatheOut: 2,
    color: "#e11d48",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    glowColor: "rgba(225,29,72,0.15)",
  },
];

function BreathPacer({ inSec, outSec, color, active }: { inSec: number; outSec: number; color: string; active: boolean }) {
  const [phase, setPhase] = useState<"inhale" | "exhale">("inhale");
  const [progress, setProgress] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!active) { setProgress(0); setPhase("inhale"); return; }
    let start: number | null = null;
    let currentPhase: "inhale" | "exhale" = "inhale";
    const tick = (ts: number) => {
      if (!start) start = ts;
      const duration = (currentPhase === "inhale" ? inSec : outSec) * 1000;
      const p = Math.min((ts - start) / duration, 1);
      setProgress(p);
      setPhase(currentPhase);
      if (p >= 1) { currentPhase = currentPhase === "inhale" ? "exhale" : "inhale"; start = ts; }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, inSec, outSec]);

  const size = 80 + progress * (phase === "inhale" ? 32 : -32) * (active ? 1 : 0);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-full flex items-center justify-center transition-all duration-100"
        style={{ width: size, height: size, backgroundColor: `${color}18`, border: `2px solid ${color}55`, boxShadow: active ? `0 0 ${16 + progress * 24}px ${color}50` : "none" }}
      >
        <div className="rounded-full opacity-60" style={{ width: size * 0.35, height: size * 0.35, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color }}>
        {active ? (phase === "inhale" ? `Inhale ${inSec}s` : `Exhale ${outSec}s`) : "Follow the rhythm"}
      </span>
    </div>
  );
}

function AstraOrb({ color, speaking }: { color: string; speaking: boolean }) {
  return (
    <div className={`w-36 h-36 mx-auto transition-all duration-500 ${speaking ? "animate-pulse" : "animate-float"}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
        <circle cx="50" cy="50" r="38" fill={color} opacity="0.08" />
        <circle cx="50" cy="50" r="28" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
        <circle cx="50" cy="50" r="18" fill={color} opacity="0.25" />
        <circle cx="50" cy="50" r="8" fill={color} opacity="0.9" />
        {speaking && (
          <>
            <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" className="animate-ping" />
          </>
        )}
      </svg>
    </div>
  );
}

function LiveWaveCanvas({ buffer, color, label }: { buffer: number[]; color: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || buffer.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    buffer.forEach((v, i) => {
      const x = (i / (buffer.length - 1)) * w;
      const y = h / 2 - (v / 80) * (h / 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.fillText(label, 8, 14);
  }, [buffer, color, label]);

  return <canvas ref={canvasRef} width={320} height={64} className="w-full rounded-xl border border-zinc-100" />;
}

interface CalibrationSessionProps {
  phase: "connecting" | "calibrating" | "complete";
  calState?: CalStateKey;
  calProgress?: number;
  calCountdown?: number;
  calSamples?: number;
  calDone: Partial<Record<CalStateKey, boolean>>;
  ch1Buffer: number[];
  ch2Buffer: number[];
  chatHistory: ChatMessage[];
  serverUnreachable?: boolean;
  hardwareError?: string;
  hardwareDetail?: string;
  onUseMockGanglion?: () => void;
  onSkipSimulator?: () => void;
  onEnterApp?: () => void;
  /** Recording length per calibration step (default 40s for hardware server). */
  calStepDurationSec?: number;
}

export default function CalibrationSession({
  phase,
  calState,
  calProgress = 0,
  calCountdown = 0,
  calSamples = 0,
  calDone,
  ch1Buffer,
  ch2Buffer,
  chatHistory,
  serverUnreachable,
  hardwareError,
  hardwareDetail,
  onUseMockGanglion,
  onSkipSimulator,
  onEnterApp,
  calStepDurationSec = 40,
}: CalibrationSessionProps) {
  const current = CAL_SEQUENCE.find((s) => s.key === calState);
  const completedCount = CAL_SEQUENCE.filter((s) => calDone[s.key]).length;
  const isRecording = calProgress > 0 && calProgress < 1;
  const overallProgress = (completedCount + calProgress) / 3;

  const [localCountdown, setLocalCountdown] = useState(0);
  useEffect(() => {
    if (calCountdown > 0 && calProgress === 0 && phase === "calibrating") {
      setLocalCountdown(calCountdown);
      const interval = setInterval(() => {
        setLocalCountdown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
      }, 1000);
      return () => clearInterval(interval);
    }
    if (calProgress > 0) setLocalCountdown(0);
  }, [calState, calCountdown, calProgress, phase]);

  const showCountdown = localCountdown > 0 && calProgress === 0;
  const recentAstra = [...chatHistory].reverse().find((m) => m.sender === "astra" || (m.sender as string) === "jarvis");
  const accentColor = current?.color ?? "#059669";

  if (phase === "complete") {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-lg w-full text-center border border-emerald-100 animate-fade-in">
          <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Neural Profile Locked In</h1>
          <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
            Your relaxation, focus, and stress baselines are calibrated. Astra is ready to collaborate with live EEG data from your Ganglion.
          </p>
          <button
            onClick={onEnterApp}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-8 py-3 rounded-full text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            Enter Companion <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200/50 bg-white/80 backdrop-blur-md px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h1 className="text-xs font-bold text-zinc-900 uppercase tracking-[0.25em]">Aora Companion</h1>
            <p className="text-[9.5px] text-zinc-400 mt-0.5">Neural Calibration Session</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hidden sm:block">
            {phase === "connecting" ? "Linking Ganglion…" : `Step ${Math.min(completedCount + 1, 3)} of 3`}
          </span>
          <div className="w-32 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.round(overallProgress * 100)}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Astra collaboration panel */}
        <div className="bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-8 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Astra · Neural Guide</span>
          </div>

          <div
            className="rounded-2xl p-6 transition-all duration-500"
            style={{ backgroundColor: current?.glowColor ?? "rgba(6,182,212,0.08)" }}
          >
            <AstraOrb color={accentColor} speaking={phase === "calibrating" && isRecording} />
            <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: accentColor }}>
              {phase === "connecting" ? "Establishing Link" : current?.label ?? "Stand By"}
            </p>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-5 border border-zinc-100 min-h-[100px]">
            <p className="text-sm text-zinc-700 leading-relaxed">
              {phase === "connecting"
                ? "Good day, Sir. I am connecting to your OpenBCI Ganglion electrodes. Once linked, we'll run a brief 2-minute calibration so I can read your brainwaves accurately."
                : recentAstra?.text.replace(/\*\*/g, "") ?? current?.astraCue ?? "Follow the prompts on the right."}
            </p>
          </div>

          {/* Step pills */}
          <div className="flex gap-2">
            {CAL_SEQUENCE.map((step) => {
              const done = calDone[step.key];
              const active = calState === step.key;
              return (
                <div
                  key={step.key}
                  className={`flex-1 rounded-xl p-3 text-center border transition-all ${
                    done ? `${step.bgClass} ${step.borderClass}` : active ? `${step.bgClass} ${step.borderClass} ring-2 ring-offset-1` : "bg-zinc-50 border-zinc-100 opacity-50"
                  }`}
                  style={active && !done ? { ringColor: step.color } as React.CSSProperties : undefined}
                >
                  <div className="text-lg">{step.emoji}</div>
                  <div className={`text-[7px] font-bold tracking-wider mt-1 ${done || active ? step.textClass : "text-zinc-400"}`}>
                    {done ? "✓" : active ? "● REC" : step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calibration action panel */}
        <div className="flex flex-col gap-6">
          {phase === "connecting" && (
            <div className="bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-10 text-center">
              <div className="w-14 h-14 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-lg font-semibold text-zinc-800 mb-2">Connecting to Ganglion</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {hardwareDetail ?? (
                  <>
                    Waiting for EEG server at <code className="text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">ws://localhost:8765</code>
                    <br />Make sure <code className="text-zinc-600">npm run eeg</code> is running with your board powered on.
                  </>
                )}
              </p>
              {hardwareError && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mt-4 max-w-md mx-auto leading-relaxed">
                  {hardwareError}
                  <span className="block text-xs text-rose-500 mt-1">Retrying automatically…</span>
                </p>
              )}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                {onUseMockGanglion && (
                  <button
                    type="button"
                    onClick={onUseMockGanglion}
                    className="inline-flex items-center gap-2 text-sm font-medium text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-5 py-2.5 rounded-full transition-colors"
                  >
                    <FlaskConical className="w-4 h-4" /> Run test one
                  </button>
                )}
                {serverUnreachable && onSkipSimulator && (
                  <button
                    type="button"
                    onClick={onSkipSimulator}
                    className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 border border-zinc-200 px-5 py-2.5 rounded-full transition-colors"
                  >
                    <Cpu className="w-4 h-4" /> Skip to simulator
                  </button>
                )}
              </div>
              {onUseMockGanglion && (
                <p className="text-[10px] text-zinc-400 mt-4 max-w-sm mx-auto leading-relaxed">
                  Runs the full calibration flow with synthetic EEG — no board or Python server required.
                </p>
              )}
            </div>
          )}

          {phase === "calibrating" && (
            <>
              {showCountdown && current && (
                <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-10 text-center">
                  <div className="text-6xl font-bold text-amber-500 font-mono tabular-nums">{localCountdown}</div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-3">Get ready · {current.label}</p>
                </div>
              )}

              {current && !showCountdown && (
                <div className={`rounded-3xl p-8 border shadow-sm ${current.bgClass} ${current.borderClass} flex flex-col gap-6`}>
                  <div className="text-center">
                    <div className="text-6xl mb-2">{current.visual}</div>
                    <p className={`text-[10px] font-bold tracking-widest uppercase ${current.textClass}`}>{current.visualLabel}</p>
                  </div>

                  <div className="flex items-start gap-3 bg-white/70 rounded-2xl p-5 border border-white">
                    {current.key === "relaxation" && <Wind className="w-5 h-5 shrink-0 mt-0.5" style={{ color: current.color }} />}
                    {current.key === "concentration" && <Target className="w-5 h-5 shrink-0 mt-0.5" style={{ color: current.color }} />}
                    {current.key === "stress" && <Zap className="w-5 h-5 shrink-0 mt-0.5" style={{ color: current.color }} />}
                    <p className="text-base text-zinc-800 leading-relaxed font-medium">{current.instruction}</p>
                  </div>

                  {(current.key === "relaxation" || isRecording) && (
                    <div className="flex justify-center py-2">
                      <BreathPacer inSec={current.breatheIn} outSec={current.breatheOut} color={current.color} active={isRecording || current.key === "relaxation"} />
                    </div>
                  )}

                  <div>
                    <div className="h-2.5 bg-white/80 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-linear"
                        style={{ width: `${Math.round(calProgress * 100)}%`, backgroundColor: current.color, boxShadow: `0 0 14px ${current.color}70` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                      <span>{calSamples} neural samples</span>
                      <span>{Math.round(calProgress * calStepDurationSec)}s / {calStepDurationSec}s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Live electrode feed during calibration */}
              <div className="bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <Radio className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Live Temporal Signal</span>
                </div>
                <LiveWaveCanvas buffer={ch1Buffer} color="#6366f1" label="Ch1 · Mastoid" />
                <LiveWaveCanvas buffer={ch2Buffer} color="#0891b2" label="Ch2 · T8 Primary" />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
