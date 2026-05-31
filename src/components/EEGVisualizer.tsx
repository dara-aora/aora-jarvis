import React, { useEffect, useRef } from "react";
import { BrainwavePowerBands, LiveMetrics } from "../types";
import { Info, Wifi, Sliders, Zap } from "lucide-react";

interface EEGVisualizerProps {
  ch1Buffer: number[];
  ch2Buffer: number[];
  bands: BrainwavePowerBands;
  metrics: LiveMetrics;
  isStreaming: boolean;
  onConnectBLE: () => void;
  isSimulated: boolean;
  onTriggerBlink: () => void;
}

export default function EEGVisualizer({
  ch1Buffer,
  ch2Buffer,
  bands,
  metrics,
  isStreaming,
  onConnectBLE,
  isSimulated,
  onTriggerBlink,
}: EEGVisualizerProps) {
  const ch1CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ch2CanvasRef = useRef<HTMLCanvasElement | null>(null);

  // High-performance canvas drawing loop tailored to gorgeous Apple Health style light graphs
  useEffect(() => {
    const drawWave = (canvas: HTMLCanvasElement, buffer: number[], color: string, label: string) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clean pure white surface
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Delicate horizontal grid lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.04)";
      ctx.lineWidth = 1;

      const gridLines = [-50, -25, 0, 25, 50];
      gridLines.forEach((uV) => {
        const y = height / 2 - (uV / 100) * (height / 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        if (uV !== 0) {
          ctx.fillStyle = "rgba(100, 116, 139, 0.5)";
          ctx.font = "8px sans-serif";
          ctx.fillText(`${uV > 0 ? "+" : ""}${uV}uV`, 8, y + 3);
        }
      });

      // Medium gray baseline
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (buffer.length === 0 || !isStreaming) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("STANDBY - FEED OFFLINE", width / 2, height / 2 + 4);
        return;
      }

      // Smooth custom waveform curve matching the specified channel color
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      ctx.beginPath();

      const step = width / (buffer.length - 1);
      buffer.forEach((val, i) => {
        const clampedVal = Math.max(-120, Math.min(120, val));
        const x = i * step;
        const y = height / 2 - (clampedVal / 100) * (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Channel title badge overlay in dark charcoal
      ctx.fillStyle = "#1d1d1f";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${label}: ${buffer[buffer.length - 1]?.toFixed(1)} uV`, 10, 16);
    };

    const c1 = ch1CanvasRef.current;
    if (c1) drawWave(c1, ch1Buffer, "#0ea5e9", "CH 1 (LEFT)"); // Cyan/Sky blue

    const c2 = ch2CanvasRef.current;
    if (c2) drawWave(c2, ch2Buffer, "#8b5cf6", "CH 2 (RIGHT)"); // Indigo
  }, [ch1Buffer, ch2Buffer, isStreaming]);

  // Support canvas resizing safely
  useEffect(() => {
    const handleResize = () => {
      [ch1CanvasRef.current, ch2CanvasRef.current].forEach((c) => {
        if (!c) return;
        const rect = c.parentElement?.getBoundingClientRect();
        if (rect) {
          c.width = rect.width * (window.devicePixelRatio || 1);
          c.height = 140 * (window.devicePixelRatio || 1);
          const ctx = c.getContext("2d");
          ctx?.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        }
      });
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (ch1CanvasRef.current?.parentElement) ro.observe(ch1CanvasRef.current.parentElement);
    window.addEventListener("resize", handleResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      
      {/* 1. Left Waveforms Card Section */}
      <div className="lg:col-span-8 bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-zinc-900" />
            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Live Microvolt Oscilloscope</h2>
          </div>
          <div className="text-[9.5px] text-zinc-400 font-sans font-medium">
            ±100 uV SAFE RESOLUTION
          </div>
        </div>

        {/* Channel 1 Graph */}
        <div className="relative rounded-2xl overflow-hidden border border-zinc-150 bg-white">
          <div className="w-full h-[140px]">
            <canvas ref={ch1CanvasRef} className="w-full h-full block" />
          </div>
          <div className="absolute top-2.5 right-3 bg-zinc-900 text-[8.5px] font-semibold text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            L-EAR MODULE
          </div>
        </div>

        {/* Channel 2 Graph */}
        <div className="relative rounded-2xl overflow-hidden border border-zinc-150 bg-white">
          <div className="w-full h-[140px]">
            <canvas ref={ch2CanvasRef} className="w-full h-full block" />
          </div>
          <div className="absolute top-2.5 right-3 bg-zinc-900 text-[8.5px] font-semibold text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            R-EAR MODULE
          </div>
        </div>

        {/* Diagnostic indexes bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2xl">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Focus Ratio</span>
            <div className="text-lg font-bold text-zinc-800 font-sans mt-0.5">{metrics.focusScore}%</div>
          </div>
          <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2xl">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Quiet Index</span>
            <div className="text-lg font-bold text-zinc-800 font-sans mt-0.5">{metrics.relaxScore}%</div>
          </div>
          <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2xl">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Artifact Limit</span>
            <div className="text-lg font-bold text-zinc-800 font-sans mt-0.5">{metrics.noiseLevel} uV</div>
          </div>
          <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2xl">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Signature Peak</span>
            <div className="text-lg font-bold text-zinc-800 font-sans mt-0.5">{metrics.dominantBand}</div>
          </div>
        </div>
      </div>

      {/* 2. Right Spectral / Anatomical Guides */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Brainwave Bars */}
        <div className="bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-zinc-700" />
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Power Wavebands</span>
          </div>

          <div className="flex flex-col gap-3 font-sans mt-1">
            {/* Beta */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10.5px]">
                <span className="text-zinc-500">BETA (Focused Task flow)</span>
                <span className="text-zinc-800 font-bold">{bands.beta}%</span>
              </div>
              <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-zinc-900 h-full rounded-full transition-all duration-300" style={{ width: `${bands.beta}%` }} />
              </div>
            </div>

            {/* Alpha */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10.5px]">
                <span className="text-zinc-500">ALPHA (Guided Breathing recovery)</span>
                <span className="text-zinc-800 font-bold">{bands.alpha}%</span>
              </div>
              <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-zinc-500 h-full rounded-full transition-all duration-300" style={{ width: `${bands.alpha}%` }} />
              </div>
            </div>

            {/* Theta */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10.5px]">
                <span className="text-zinc-500">THETA (Relaxation sleep state)</span>
                <span className="text-zinc-800 font-bold">{bands.theta}%</span>
              </div>
              <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-zinc-305 h-full rounded-full transition-all duration-300" style={{ width: `${bands.theta}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Electrode placement guide */}
        <div className="bg-white border border-zinc-200/50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-4 flex-1 justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-zinc-700" />
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Electrode Map</span>
          </div>

          <div className="flex items-center justify-center relative my-2">
            <svg viewBox="0 0 160 160" className="w-[110px] h-[110px]">
              <circle cx="80" cy="80" r="54" fill="none" stroke="#e4e4e7" strokeWidth="1.5" strokeDasharray="3 3"/>
              <path d="M 80,15 L 75,25 L 85,25 Z" fill="#71717a" />
              <circle cx="16" cy="91" r="5.5" fill="#10b981" />
              <circle cx="34" cy="92" r="5.5" fill="#3b82f6" />
              <circle cx="126" cy="92" r="5.5" fill="#8b5cf6" />
            </svg>

            <div className="absolute bottom-1 right-1 text-[8.5px] leading-relaxed text-zinc-400 font-sans p-2 bg-zinc-50 border border-zinc-150 rounded-xl">
              <strong className="text-emerald-600">● GND:</strong> Noise filter<br />
              <strong className="text-blue-500">● Ch1/2:</strong> Temporal lobes
            </div>
          </div>

          <span className="text-[9.5px] text-zinc-500 text-center leading-normal">
            BTE OpenBCI sensors map bio-voltages to corresponding play stamina rates instantly.
          </span>
        </div>

      </div>

    </div>
  );
}
