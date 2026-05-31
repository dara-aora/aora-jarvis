import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality, Session } from "@google/genai";
import { BrainwavePowerBands, ChatMessage, LiveMetrics, Task } from "../types";
import { MicCapture, AudioPlaybackQueue } from "../utils/audioProcessor";
import {
  buildEegContextMessage,
  buildJarvisLiveSystemInstruction,
  buildSessionStartContext,
  JARVIS_LIVE_MODEL,
} from "../utils/jarvisLivePrompt";

export type LiveSessionStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "error";

interface UseGeminiLiveOptions {
  metrics: LiveMetrics;
  bands: BrainwavePowerBands;
  tasks: Task[];
  isSimulated: boolean;
  isMockGanglion?: boolean;
  mentalState?: string;
  onAddChatMessage: (msg: ChatMessage) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

const EEG_UPDATE_INTERVAL_MS = 12000;
const SETUP_TIMEOUT_MS = 15000;

export function useGeminiLive({
  metrics,
  bands,
  tasks,
  isSimulated,
  isMockGanglion = false,
  mentalState,
  onAddChatMessage,
  onSpeakingChange,
}: UseGeminiLiveOptions) {
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const playbackRef = useRef<AudioPlaybackQueue | null>(null);
  const eegIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metricsRef = useRef(metrics);
  const bandsRef = useRef(bands);
  const tasksRef = useRef(tasks);
  const isSimulatedRef = useRef(isSimulated);
  const isMockGanglionRef = useRef(isMockGanglion);
  const mentalStateRef = useRef(mentalState);
  const lastInputTranscriptRef = useRef("");
  const lastOutputTranscriptRef = useRef("");
  const startingRef = useRef(false);
  const userStoppedRef = useRef(false);

  useEffect(() => {
    metricsRef.current = metrics;
    bandsRef.current = bands;
    tasksRef.current = tasks;
    isSimulatedRef.current = isSimulated;
    isMockGanglionRef.current = isMockGanglion;
    mentalStateRef.current = mentalState;
  }, [metrics, bands, tasks, isSimulated, isMockGanglion, mentalState]);

  const pushTranscript = useCallback(
    (sender: "user" | "jarvis", text: string) => {
      if (!text.trim()) return;
      onAddChatMessage({
        id: crypto.randomUUID(),
        sender,
        text: sender === "user" ? `🎙️ ${text}` : text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    },
    [onAddChatMessage]
  );

  const sendEegUpdate = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    const update = buildEegContextMessage(
      metricsRef.current,
      bandsRef.current,
      tasksRef.current,
      mentalStateRef.current
    );
    session.sendRealtimeInput({ text: update });
  }, []);

  const cleanupResources = useCallback(() => {
    if (eegIntervalRef.current) {
      clearInterval(eegIntervalRef.current);
      eegIntervalRef.current = null;
    }

    micRef.current?.stop();
    micRef.current = null;

    playbackRef.current?.close();
    playbackRef.current = null;

    try {
      sessionRef.current?.close();
    } catch {
      /* already closed */
    }
    sessionRef.current = null;
    onSpeakingChange?.(false);
  }, [onSpeakingChange]);

  const stopLive = useCallback(() => {
    userStoppedRef.current = true;
    cleanupResources();
    startingRef.current = false;
    setStatus("idle");
    setError(null);
  }, [cleanupResources]);

  const failLive = useCallback(
    (message: string) => {
      console.error("[Gemini Live]", message);
      cleanupResources();
      startingRef.current = false;
      setError(message);
      setStatus("error");
    },
    [cleanupResources]
  );

  const waitForSetup = (resolveSetup: () => void, rejectSetup: (err: Error) => void) => {
    const timer = setTimeout(() => {
      rejectSetup(new Error("Timed out waiting for Gemini Live session setup."));
    }, SETUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  };

  const startLive = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    setStatus("connecting");
    setError(null);

    let clearSetupTimer: (() => void) | undefined;

    try {
      const tokenRes = await fetch("/api/jarvis/live-token", { method: "POST" });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        throw new Error(tokenData.error || tokenData.raw || "Failed to obtain live session token");
      }

      if (!tokenData.token) {
        throw new Error("Server returned an empty live token.");
      }

      const liveModel = tokenData.model || JARVIS_LIVE_MODEL;
      const ephemeral = Boolean(tokenData.ephemeral ?? String(tokenData.token).startsWith("auth_tokens/"));

      const playback = new AudioPlaybackQueue();
      playbackRef.current = playback;
      await playback.resume();

      const systemInstruction = buildJarvisLiveSystemInstruction(
        tasksRef.current,
        isSimulatedRef.current,
        isMockGanglionRef.current
      );

      let resolveSetup!: () => void;
      let rejectSetup!: (err: Error) => void;
      const setupReady = new Promise<void>((resolve, reject) => {
        resolveSetup = resolve;
        rejectSetup = reject;
      });
      clearSetupTimer = waitForSetup(resolveSetup, rejectSetup);

      const ai = new GoogleGenAI({
        apiKey: tokenData.token,
        httpOptions: ephemeral ? { apiVersion: "v1alpha" } : undefined,
      });

      const session = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          enableAffectiveDialog: true,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus("ready");
          },
          onmessage: (message) => {
            if (message.setupComplete) {
              resolveSetup();
            }

            if (message.serverContent?.interrupted) {
              playback.interrupt();
              onSpeakingChange?.(false);
              setStatus("listening");
            }

            const inputText = message.serverContent?.inputTranscription?.text;
            if (inputText && inputText !== lastInputTranscriptRef.current) {
              lastInputTranscriptRef.current = inputText;
              pushTranscript("user", inputText);
              setStatus("listening");
            }

            const outputText = message.serverContent?.outputTranscription?.text;
            if (outputText && outputText !== lastOutputTranscriptRef.current) {
              lastOutputTranscriptRef.current = outputText;
              pushTranscript("jarvis", outputText);
            }

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  void playback.enqueueBase64Pcm(part.inlineData.data);
                  onSpeakingChange?.(true);
                  setStatus("speaking");
                }
              }
            }

            if (message.serverContent?.turnComplete) {
              onSpeakingChange?.(false);
              setStatus("listening");
              lastOutputTranscriptRef.current = "";
            }
          },
          onerror: (event) => {
            const detail =
              event instanceof ErrorEvent && event.message
                ? event.message
                : "Live session connection error";
            failLive(detail);
          },
          onclose: (event) => {
            if (userStoppedRef.current) {
              userStoppedRef.current = false;
              return;
            }
            if (sessionRef.current) {
              const reason = event.reason ? `: ${event.reason}` : "";
              failLive(`Live session closed unexpectedly${reason}`);
            }
          },
        },
      });

      sessionRef.current = session;

      await setupReady;
      clearSetupTimer?.();

      const mic = new MicCapture();
      micRef.current = mic;
      await mic.start((base64Pcm) => {
        session.sendRealtimeInput({
          audio: {
            data: base64Pcm,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      });

      session.sendRealtimeInput({
        text: buildSessionStartContext(
          metricsRef.current,
          bandsRef.current,
          tasksRef.current,
          mentalStateRef.current
        ),
      });
      sendEegUpdate();
      eegIntervalRef.current = setInterval(sendEegUpdate, EEG_UPDATE_INTERVAL_MS);

      startingRef.current = false;
      setStatus("listening");

      onAddChatMessage({
        id: crypto.randomUUID(),
        sender: "jarvis",
        text: "🎧 **Live voice channel open.** I can hear you now, Sir — speak whenever you're ready. I'm monitoring your EEG telemetry in the background.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err: unknown) {
      clearSetupTimer?.();
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to start live session. Check microphone permission and GEMINI_API_KEY.";
      failLive(msg);
    }
  }, [failLive, onAddChatMessage, onSpeakingChange, pushTranscript, sendEegUpdate]);

  const sendTextMessage = useCallback((text: string) => {
    const session = sessionRef.current;
    if (!session || !text.trim()) return;
    session.sendRealtimeInput({ text: text.trim() });
  }, []);

  const toggleLive = useCallback(async () => {
    if (status === "idle" || status === "error") {
      await startLive();
    } else {
      stopLive();
    }
  }, [startLive, status, stopLive]);

  useEffect(() => {
    return () => {
      cleanupResources();
      startingRef.current = false;
    };
  }, [cleanupResources]);

  const isLiveActive =
    status === "ready" || status === "listening" || status === "speaking" || status === "connecting";

  return {
    status,
    error,
    isLiveActive,
    startLive,
    stopLive,
    toggleLive,
    sendTextMessage,
  };
}
