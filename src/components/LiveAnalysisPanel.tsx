import React, { useEffect, useRef } from "react";
import {
  Activity,
  Brain,
  Briefcase,
  Coffee,
  MessageSquare,
  Moon,
  Radio,
  Waves,
} from "lucide-react";
import { BrainwavePowerBands, ChatMessage, LiveMetrics } from "../types";
import { LiveSessionStatus } from "../hooks/useGeminiLive";
import {
  getCircadianGuidance,
  primaryTimingHeadline,
  verdictStyles,
} from "../utils/circadianGuidance";
import { getEnergyAdvisory, scoresFromPercent } from "../utils/eegEnergy";

const LIVE_STATUS_LABEL: Record<LiveSessionStatus, string> = {
  idle: "Offline",
  connecting: "Connecting…",
  ready: "Ready",
  listening: "Listening",
  speaking: "Jarvis speaking",
  error: "Error",
};

function formatChatText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^🎙️\s*/, "").trim();
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums text-zinc-700">{value}%</span>
      </div>
      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TimingCard({
  icon: Icon,
  label,
  verdict,
  title,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  verdict: "optimal" | "good" | "fair" | "avoid";
  title: string;
  detail: string;
}) {
  const styles = verdictStyles(verdict);
  return (
    <div className={`rounded-2xl border p-4 bg-white/80 ring-1 ${styles.ring}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 shrink-0 ${styles.icon}`} />
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
        </div>
        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${styles.pill}`}>
          {verdict}
        </span>
      </div>
      <p className="text-sm font-semibold text-zinc-900 leading-snug">{title}</p>
      <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{detail}</p>
    </div>
  );
}

interface LiveAnalysisPanelProps {
  metrics: LiveMetrics;
  bands: BrainwavePowerBands;
  mentalState?: string;
  chatMessages: ChatMessage[];
  liveStatus: LiveSessionStatus;
  jarvisSpeaking: boolean;
  isLoading?: boolean;
}

export default function LiveAnalysisPanel({
  metrics,
  bands,
  mentalState,
  chatMessages,
  liveStatus,
  jarvisSpeaking,
  isLoading,
}: LiveAnalysisPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const guidance = getCircadianGuidance(metrics, bands, mentalState);
  const energy = getEnergyAdvisory(
    scoresFromPercent(metrics.focusScore, metrics.relaxScore, metrics.stressScore)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, liveStatus, jarvisSpeaking, isLoading]);

  const statusColor =
    liveStatus === "speaking" || jarvisSpeaking
      ? "bg-violet-500"
      : liveStatus === "listening"
        ? "bg-emerald-500 animate-pulse"
        : liveStatus === "connecting"
          ? "bg-amber-500 animate-pulse"
          : "bg-zinc-400";

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Session header */}
      <div className="rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
              Live neural analysis
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-[10px] font-medium text-zinc-200">
              {jarvisSpeaking ? "Jarvis speaking" : LIVE_STATUS_LABEL[liveStatus]}
            </span>
          </div>
        </div>
        <p className="text-base font-semibold leading-snug">{primaryTimingHeadline(guidance)}</p>
        <p className="text-[11px] text-zinc-400 mt-1">{guidance.feelSummary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: metrics & timing */}
        <div className="flex flex-col gap-3">
          <TimingCard
            icon={Briefcase}
            label="Work window"
            verdict={guidance.work.verdict}
            title={guidance.work.title}
            detail={guidance.work.detail}
          />
          <TimingCard
            icon={Moon}
            label="Sleep window"
            verdict={guidance.sleep.verdict}
            title={guidance.sleep.title}
            detail={guidance.sleep.detail}
          />

          {guidance.breakNow && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3">
              <Coffee className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Break suggested</p>
                <p className="text-[11px] text-amber-900/80 mt-0.5 leading-relaxed">{guidance.breakDetail}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Live EEG snapshot
              </span>
            </div>
            <MetricBar label="Focus" value={metrics.focusScore} color="#2563eb" />
            <MetricBar label="Relax" value={metrics.relaxScore} color="#059669" />
            <MetricBar label="Stress" value={metrics.stressScore} color="#e11d48" />
            <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Play energy</span>
              <span className="text-sm font-bold text-zinc-900 tabular-nums">{metrics.manaLevel}%</span>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px]">
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                {metrics.dominantBand} dominant
              </span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                β {bands.beta}% · α {bands.alpha}%
              </span>
              {mentalState && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-medium border border-cyan-100">
                  {mentalState}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 italic leading-relaxed border-t border-zinc-50 pt-2">
              {energy.message}
            </p>
          </div>
        </div>

        {/* Right: live transcript */}
        <div className="flex flex-col gap-2 min-h-[280px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                Session transcript
              </span>
            </div>
            <span className="text-[9px] text-zinc-400 tabular-nums">{chatMessages.length} messages</span>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 min-h-[260px] max-h-[420px] scroll-smooth"
          >
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-8 gap-2">
                <Brain className="w-8 h-8 text-zinc-300" />
                <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                  Speak or type — Jarvis will analyze your signals and respond here.
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 max-w-[92%] ${
                    msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  <span className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-wide">
                    {msg.sender === "user" ? "You" : "Jarvis"} · {msg.timestamp}
                  </span>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-zinc-900 text-white rounded-tr-sm"
                        : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {formatChatText(msg.text)}
                  </div>
                </div>
              ))
            )}

            {(liveStatus === "listening" && !jarvisSpeaking) && (
              <div className="self-start flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-dashed border-emerald-200">
                <Waves className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-700 font-medium">Listening…</span>
              </div>
            )}

            {(jarvisSpeaking || liveStatus === "speaking") && (
              <div className="self-start flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-violet-50 border border-violet-100">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:0.12s]" />
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:0.24s]" />
                <span className="text-[10px] text-violet-700 font-medium ml-1">Jarvis responding…</span>
              </div>
            )}

            {isLoading && (
              <div className="self-start text-[10px] text-zinc-400 animate-pulse">Thinking…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
