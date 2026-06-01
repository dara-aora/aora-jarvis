import React, { useState, useEffect, useRef } from "react";
import { BrainwavePowerBands, ChatMessage, LiveMetrics, Task } from "../types";
import LiveAnalysisPanel from "./LiveAnalysisPanel";
import { 
  Volume2, VolumeX, Send, Mic, MicOff, HelpCircle, Sparkles, 
  Play, CheckCircle2, ChevronRight, RefreshCw, Cpu, Star, Laptop, ArrowRight,
  Radio, Loader2
} from "lucide-react";

interface GeminiLiveControls {
  status: LiveSessionStatus;
  error: string | null;
  isLiveActive: boolean;
  toggleLive: () => Promise<void>;
  sendTextMessage: (text: string) => void;
}

interface JarvisCompanionProps {
  metrics: LiveMetrics;
  bands: BrainwavePowerBands;
  mentalState?: string;
  tasks: Task[];
  chatHistory: ChatMessage[];
  onAddChatMessage: (msg: ChatMessage) => void;
  isSimulated: boolean;
  isMockGanglion?: boolean;
  geminiLive: GeminiLiveControls;
  astraSpeaking?: boolean;
  onAddTask: (task: Omit<Task, "id" | "createdAt" | "priority">) => void;
  onAutoplanTasks: () => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleMode: () => void;
}

type AvatarSkin = "neo-orb" | "vibe-kitty" | "aora-chibi" | "lotus-zen" | "retro-crt";

interface SkinPreset {
  id: AvatarSkin;
  name: string;
  themeColor: string;
  glowColor: string;
  accentClass: string;
  avatarLabel: string;
}

const SKIN_PRESETS: SkinPreset[] = [
  { id: "neo-orb", name: "Neo Orb", themeColor: "cyan", glowColor: "rgba(6,182,212,0.12)", accentClass: "text-cyan-650 bg-cyan-50 border-cyan-100", avatarLabel: "QUANTUM CORE" },
  { id: "vibe-kitty", name: "Cyber Kitty", themeColor: "fuchsia", glowColor: "rgba(217,70,239,0.12)", accentClass: "text-fuchsia-650 bg-fuchsia-50 border-fuchsia-100", avatarLabel: "CUTE KITTEN" },
  { id: "aora-chibi", name: "Aora Chibi", themeColor: "emerald", glowColor: "rgba(16,185,129,0.12)", accentClass: "text-emerald-650 bg-emerald-50 border-emerald-100", avatarLabel: "CHIBI BUDDY" },
  { id: "lotus-zen", name: "Lotus Zen", themeColor: "amber", glowColor: "rgba(245,158,11,0.12)", accentClass: "text-amber-650 bg-amber-50 border-amber-100", avatarLabel: "ZEN MANDALA" },
  { id: "retro-crt", name: "Retro CRT", themeColor: "indigo", glowColor: "rgba(99,102,241,0.12)", accentClass: "text-indigo-650 bg-indigo-50 border-indigo-100", avatarLabel: "RETRO HELPER" }
];

export default function JarvisCompanion({
  metrics,
  bands,
  mentalState,
  tasks,
  chatHistory,
  onAddChatMessage,
  isSimulated,
  isMockGanglion,
  geminiLive,
  astraSpeaking = false,
  onAddTask,
  onAutoplanTasks,
  onToggleComplete,
  onDeleteTask,
  onToggleMode,
}: JarvisCompanionProps) {
  const { status: liveStatus, error: liveError, isLiveActive, toggleLive, sendTextMessage } = geminiLive;
  const [inputText, setInputText] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Avatar skin and Interactive States
  const [currentSkin, setCurrentSkin] = useState<AvatarSkin>("neo-orb");
  const [avatarEmotion, setAvatarEmotion] = useState<"idle" | "thinking" | "speaking" | "celebrating" | "exhausted">("idle");
  
  // Custom Agent Action / KiCad Quest Simulator States
  const [questState, setQuestState] = useState<"idle" | "connecting" | "reviewing" | "documenting" | "completed">("idle");
  const [questLogs, setQuestLogs] = useState<string[]>([]);
  const [activeQuestTitle, setActiveQuestTitle] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const [liveChatStartIndex, setLiveChatStartIndex] = useState<number | null>(null);

  useEffect(() => {
    if (liveStatus === "connecting" && liveChatStartIndex === null) {
      setLiveChatStartIndex(chatHistory.length);
    }
    if (!isLiveActive && liveStatus === "idle") {
      setLiveChatStartIndex(null);
    }
  }, [liveStatus, isLiveActive, chatHistory.length, liveChatStartIndex]);

  const liveSessionMessages =
    liveChatStartIndex !== null ? chatHistory.slice(liveChatStartIndex) : chatHistory;

  // Auto-adapt emotions based on EEG + live voice state
  useEffect(() => {
    if (astraSpeaking || liveStatus === "speaking") {
      setAvatarEmotion("speaking");
    } else if (liveStatus === "connecting" || isLoading) {
      setAvatarEmotion("thinking");
    } else if (metrics.stressScore > 55) {
      setAvatarEmotion("exhausted");
    } else if (isLiveActive && liveStatus === "listening") {
      setAvatarEmotion("idle");
    } else {
      setAvatarEmotion("idle");
    }
  }, [metrics.stressScore, isLoading, astraSpeaking, liveStatus, isLiveActive]);

  // Auto-scroll chat dialogs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading, questLogs]);

  // Clean vocalized announcements
  const speakText = (text: string) => {
    if (isLiveActive || !voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const cleanedText = text
      .replace(/\[SIMULATED COMPANION\]/gi, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/- /g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    const voices = window.speechSynthesis.getVoices();
    
    const englishVoice = voices.find(v => v.lang.includes("en-GB") || v.name.toLowerCase().includes("google uk english")) || 
                         voices.find(v => v.lang.includes("en-US")) || 
                         voices[0];
                         
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    // Apple Siri style high premium frequencies
    utterance.pitch = currentSkin === "aora-chibi" ? 1.3 : currentSkin === "vibe-kitty" ? 1.15 : 1.0;
    utterance.rate = 1.0;

    utterance.onstart = () => setAvatarEmotion("speaking");
    utterance.onend = () => {
      setAvatarEmotion(metrics.stressScore > 55 ? "exhausted" : "idle");
    };

    window.speechSynthesis.speak(utterance);
  };

  // Setup Web Speech API for cute voice commands
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setListening(true);
      setMicError(null);
      setAvatarEmotion("thinking");
    };

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text && text.trim()) {
        handleVoiceCommand(text);
      }
    };

    rec.onerror = (event: any) => {
      console.warn("Speech recognition note:", event.error);
      if (event.error === "not-allowed") {
        setMicError("Microphone access is locked.");
      } else {
        setMicError(`Access code: ${event.error}`);
      }
      setListening(false);
      setAvatarEmotion("idle");
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
  }, [metrics.stressScore]);

  const toggleListening = () => {
    if (!voiceSupported || !recognitionRef.current) {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: "astra",
        text: "My mic module is locked by your browser settings. Please type into the command line below, and I will execute immediately.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      onAddChatMessage(msg);
      speakText(msg.text);
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
    } else {
      try {
        setMicError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Apple-grade simulation quest for KiCad / Hardware Docs on Aora Nano
  const launchHardwareDocQuest = (customTitle?: string) => {
    const title = customTitle || "Aora Nano - KiCad Gerber Schema Inspection";
    setActiveQuestTitle(title);
    setAvatarEmotion("thinking");
    setQuestState("connecting");
    setQuestLogs([
      "Initiating local workspace directory mapping...",
      "Reading /src/utils/bleConnector.ts impedance pipelines...",
      "Querying local KiCad PCB pin router constraints..."
    ]);
    
    // Simulate steps gracefully with Apple-style logs
    setTimeout(() => {
      setQuestState("reviewing");
      setQuestLogs(prev => [
        ...prev,
        "Connected to board schematics. 4-layer copper routing active.",
        "Inspecting voltage bypass footprint adjacent to Ch1 analog inputs...",
        "Calculated 0.15mm trace thickness matches temporal microvolt flow limits."
      ]);
      speakText("Inspecting the Aora Nano KiCad footprint. Checking bypass capacitors and 4-layer impedance pins.");
    }, 1400);

    setTimeout(() => {
      setQuestState("documenting");
      setQuestLogs(prev => [
        ...prev,
        "Formulating engineering document notes in Markdown...",
        "Adding temporal signal shielding guidance for 60Hz ambient noise filtering...",
        "Output spec successfully drafted."
      ]);
    }, 2800);

    setTimeout(() => {
      setQuestState("completed");
      setAvatarEmotion("celebrating");
      setQuestLogs(prev => [
        ...prev,
        "File compiled: /docs/aora_nano_hardware_spec.md (Certified Compliant)",
        "Staggered work task completed with clean schematic layout verification."
      ]);

      // Complete or create the corresponding task
      const matchTask = tasks.find(t => t.title.toLowerCase().includes("kicad") || t.title.toLowerCase().includes("hardware doc"));
      if (matchTask) {
        onToggleComplete(matchTask.id);
      } else {
        onAddTask({
          title: "Complete hardware doc about Aora Nano's internal hardware (KiCad layout checked)",
          completed: true,
          category: "Review",
          focusRequired: "high",
          manaCost: 20
        });
      }

      // Task completed — play energy is tracked by Ganglion EEG only

      const finishSpeech = "Review compiled successfully. I checked your 4-layer power traces in KiCad and written the specification report.";
      
      const astraMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: "astra",
        text: `📊 **Aora Nano KiCad Audit Complete**\n\nI reviewed the copper layers and created your hardware documentation:\n\n* **Shielding:** Bypass filters are certified layout-adjacent.\n* **Power Loop:** Realigned 0.15uV pins perfectly.\n* **Result:** Document written successfully to output repo. *(Used 20 Energy points)*`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      onAddChatMessage(astraMsg);
      speakText(finishSpeech);
    }, 4500);
  };

  const handleVoiceCommand = (commandText: string) => {
    const text = commandText.trim().toLowerCase();
    
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text: `🎙️ "${commandText}"`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    onAddChatMessage(userMsg);

    if (text.includes("kicad") || text.includes("hardware doc") || text.includes("aora nano") || text.includes("review")) {
      launchHardwareDocQuest();
      return;
    }

    const addTaskMatch = text.match(/^(?:add|create|new)\s+task\s+(.+)$/i) || 
                         text.match(/^(?:add|create|new)\s+objective\s+(.+)$/i);
    if (addTaskMatch) {
      const title = addTaskMatch[1].trim();
      const capTitle = title.charAt(0).toUpperCase() + title.slice(1);
      
      onAddTask({
        title: capTitle,
        completed: false,
        category: "Coding",
        focusRequired: "medium",
        manaCost: 15
      });
      sendCompanionResponse(`Added task "${capTitle}" to your schedule, Sir.`);
      return;
    }

    if (text.includes("complete") || text.includes("finish") || text.includes("check")) {
      const query = text.replace("complete", "").replace("finish", "").replace("check", "").replace("task", "").trim();
      if (query.length > 2) {
        const matched = tasks.find(t => t.title.toLowerCase().includes(query));
        if (matched) {
          onToggleComplete(matched.id);
          sendCompanionResponse(`Archived task "${matched.title}". Enjoy your reclaimed energy.`);
          return;
        }
      }
    }

    if (text.includes("reorder") || text.includes("autoplan") || text.includes("prioritize")) {
      onAutoplanTasks();
      return;
    }

    for (const preset of SKIN_PRESETS) {
      if (text.includes(preset.name.toLowerCase()) || text.includes(preset.id)) {
        setCurrentSkin(preset.id);
        sendCompanionResponse(`Hologram profile switched to ${preset.name}.`);
        return;
      }
    }

    handleSendMessage(commandText);
  };

  const sendCompanionResponse = (replyText: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "astra",
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setTimeout(() => {
      onAddChatMessage(msg);
      speakText(replyText);
    }, 400);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    if (isLiveActive) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: "user",
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      onAddChatMessage(userMsg);
      setInputText("");
      sendTextMessage(textToSend);
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    onAddChatMessage(userMsg);
    setInputText("");
    setIsLoading(true);
    setAvatarEmotion("thinking");

    try {
      const response = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          eegStats: {
            focusScore: metrics.focusScore,
            relaxScore: metrics.relaxScore,
            stressScore: metrics.stressScore,
            leftEarBand: `${metrics.dominantBand} (Ch1)`,
            rightEarBand: `${metrics.dominantBand} (Ch2)`,
            mana: metrics.manaLevel,
            state: metrics.stressScore > 55 ? "Stressed" : metrics.relaxScore > 55 && metrics.focusScore < 40 ? "Relaxed" : metrics.focusScore > 50 ? "Focused" : "Balanced"
          },
          tasks: tasks,
          chatHistory: chatHistory
        }),
      });

      const data = await response.json();
      if (response.ok && data.response) {
        const jMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sender: "astra",
          text: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        onAddChatMessage(jMsg);
        speakText(data.response);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.warn(err);
      const standardResponse = "Temporal flow balanced. Let's focus on completing your upcoming Aora hardware checklist items.";
      const jMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: "astra",
        text: standardResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      onAddChatMessage(jMsg);
      speakText(standardResponse);
    } finally {
      setIsLoading(false);
    }
  };

  // Premium, super precise minimalist SVG vector avatars
  const renderAvatarGraphic = () => {
    const isSpeaking = avatarEmotion === "speaking";
    const isThinking = avatarEmotion === "thinking" || isSpeaking;
    const isExhausted = avatarEmotion === "exhausted";
    const isDancing = avatarEmotion === "celebrating";

    // Clean CSS float classes with very soft ambient reflections (Apple design)
    const motionClass = `w-32 h-32 mx-auto transition-all duration-500 ease-in-out ${
      isDancing ? "animate-bounce" : "animate-float"
    }`;

    switch (currentSkin) {
      case "vibe-kitty":
        return (
          <div className={motionClass}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Outer soft orbit circle */}
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              {/* Main cute kitten shape in pristine Apple visual style */}
              <path d="M 28,48 Q 23,24 40,32 Q 50,26 60,32 Q 77,24 72,48 Q 75,66 50,74 Q 25,66 28,48 Z" fill="#FAFAFA" stroke="#E2E8F0" strokeWidth="2" />
              {/* Ears */}
              <polygon points="29,40 27,29 37,33" fill="#FEE2E2" />
              <polygon points="71,40 73,29 63,33" fill="#FEE2E2" />
              {/* Eyes */}
              {isExhausted ? (
                <>
                  <line x1="36" y1="50" x2="44" y2="50" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="56" y1="50" x2="64" y2="50" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                </>
              ) : isThinking ? (
                <>
                  <circle cx="40" cy="50" r="3.5" fill="#3B82F6" className="animate-pulse" />
                  <circle cx="60" cy="50" r="3.5" fill="#3B82F6" className="animate-pulse" />
                </>
              ) : (
                <>
                  <circle cx="40" cy="50" r="4" fill="#1F2937" />
                  <circle cx="40" cy="48.5" r="1.5" fill="#FFFFFF" />
                  <circle cx="60" cy="50" r="4" fill="#1F2937" />
                  <circle cx="60" cy="48.5" r="1.5" fill="#FFFFFF" />
                </>
              )}
              {/* Smile mouth */}
              <path d="M 46,59 Q 50,62 54,59" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        );

      case "aora-chibi":
        return (
          <div className={motionClass}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              {/* Helmet shell */}
              <rect x="28" y="28" width="44" height="40" rx="14" fill="#FAFAFA" stroke="#E2E8F0" strokeWidth="2" />
              {/* Visor shield */}
              <rect x="33" y="34" width="34" height="24" rx="8" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" />
              {/* Eyes */}
              {isExhausted ? (
                <path d="M 38,48 L 44,45 M 62,48 L 56,45" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
              ) : isThinking ? (
                <rect x="42" y="44" width="16" height="4" rx="2" fill="#10B981" className="animate-pulse" />
              ) : (
                <>
                  <circle cx="42" cy="46" r="3" fill="#10B981" />
                  <circle cx="58" cy="46" r="3" fill="#10B981" />
                  {/* Cheeks */}
                  <circle cx="38" cy="52" r="2" fill="#FDA4AF" opacity="0.6" />
                  <circle cx="62" cy="52" r="2" fill="#FDA4AF" opacity="0.6" />
                </>
              )}
              <line x1="50" y1="28" x2="50" y2="18" stroke="#94A3B8" strokeWidth="1.5" />
              <circle cx="50" cy="18" r="3" fill="#10B981" />
            </svg>
          </div>
        );

      case "lotus-zen":
        return (
          <div className={motionClass}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#E5E7EB" strokeWidth="1" />
              {/* Balanced Geometric Petals (Minimal Mandala) */}
              <path d="M 50,18 Q 57,34 50,50 Q 43,34 50,18 Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M 50,82 Q 57,66 50,50 Q 43,66 50,82 Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M 18,50 Q 34,43 50,50 Q 34,57 18,50 Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2" />
              <path d="M 82,50 Q 66,43 50,50 Q 66,57 82,50 Z" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2" />
              {/* Golden Core */}
              <circle cx="50" cy="50" r="10" fill="#FFFBEB" stroke="#D97706" strokeWidth="2" />
              <circle cx="50" cy="50" r="6" fill={isSpeaking ? "#10B981" : "#D97706"} className="animate-pulse" />
            </svg>
          </div>
        );

      case "retro-crt":
        return (
          <div className={motionClass}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <rect x="25" y="26" width="50" height="46" rx="6" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
              <rect x="29" y="30" width="42" height="34" rx="4" fill="#0F172A" />
              {/* Clean text expression face */}
              <text 
                x="50" 
                y="52" 
                fill="#38BDF8" 
                fontSize="11" 
                fontFamily="monospace" 
                fontWeight="bold" 
                textAnchor="middle"
              >
                {isExhausted ? "(-_-)" : isThinking ? "(•_•)" : isSpeaking ? "(^o^)" : "(^_^)"}
              </text>
              {/* Legs */}
              <path d="M 40,72 L 36,83 L 64,83 L 60,72 Z" fill="#E2E8F0" />
            </svg>
          </div>
        );

      default:
        // Neo Orb - default slick particle bubble (extremely modern, white background style)
        return (
          <div className={motionClass}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#E5E7EB" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="36" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 6" className="animate-rotate" />
              {/* Floating inner sphere with beautiful soft gradient */}
              <defs>
                <radialGradient id="siriGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.02" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="28" fill="url(#siriGlow)" />
              <circle cx="50" cy="50" r="14" fill="#F0F9FF" stroke="#0ea5e9" strokeWidth="1.5" />
              <circle cx="50" cy="50" r="6" fill={isSpeaking ? "#EC4899" : "#0EA5E9"} className="animate-pulse" />
            </svg>
          </div>
        );
    }
  };

  const currentSkinPreset = SKIN_PRESETS.find(s => s.id === currentSkin) || SKIN_PRESETS[0];

  return (
    <div className="bg-white border border-zinc-200/50 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col gap-6 w-full animate-fade-in">
      
      {/* Visual Identity / Tiny Skin preset pills */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] font-sans">
            AI Assistant
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-1.5 rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 ${showHelp ? 'text-zinc-900 bg-zinc-100':''}`}
            title="Helper Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-1.5 rounded-full transition-all text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800`}
            title={voiceEnabled ? "Mute audio" : "Unmute audio"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Live analysis layout — expanded when voice session is active */}
      {isLiveActive ? (
        <>
          <div className="flex items-center justify-center gap-3 py-3">
            <div className="scale-75 origin-center">{renderAvatarGraphic()}</div>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Astra · Live</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {astraSpeaking || liveStatus === "speaking"
                  ? "Analyzing & responding…"
                  : "EEG + voice linked"}
              </p>
            </div>
          </div>

          <LiveAnalysisPanel
            metrics={metrics}
            bands={bands}
            mentalState={mentalState}
            chatMessages={liveSessionMessages}
            liveStatus={liveStatus}
            astraSpeaking={astraSpeaking}
            isLoading={isLoading}
          />

          <button
            type="button"
            onClick={() => void toggleLive()}
            disabled={liveStatus === "connecting"}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <Radio className="w-3.5 h-3.5" />
            End live session
          </button>
          {liveError && (
            <p className="text-[10px] text-rose-600 text-center leading-relaxed">{liveError}</p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center py-6 bg-zinc-50/50 rounded-2xl border border-zinc-100 relative">
            <div className="absolute top-3 left-3">
              <span className={`text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${currentSkinPreset.accentClass}`}>
                Skin: {currentSkinPreset.name}
              </span>
            </div>

            {renderAvatarGraphic()}

            <p className="text-[11px] text-zinc-500 font-mono tracking-wide mt-3 text-center">
              {metrics.stressScore > 55
                ? "⚡ Stress elevated — rest recommended."
                : metrics.relaxScore > 55 && metrics.focusScore < 40
                ? "🎯 Relaxed — pick a task to focus."
                : `Hologram active • ${avatarEmotion}`}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void toggleLive()}
              disabled={liveStatus === "connecting"}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-semibold tracking-wide transition-all border bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800"
            >
              {liveStatus === "connecting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
              Start live voice — talk about your signals
            </button>
            {liveError && (
              <p className="text-[10px] text-rose-600 text-center leading-relaxed">{liveError}</p>
            )}
          </div>
        </>
      )}

      {/* Compact skin selection panel — hidden during live to save space */}
      {!isLiveActive && (
      <div className="flex flex-col gap-2">
        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Select Agent Avatar Skin:</span>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {SKIN_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentSkin(p.id);
                speakText(`Hologram system switched. Presenting ${p.name}.`);
              }}
              className={`px-3 py-1 rounded-full text-[10px] tracking-wide transition-all ${
                currentSkin === p.id 
                  ? "bg-zinc-900 text-white font-medium" 
                  : "bg-zinc-105 hover:bg-zinc-100 text-zinc-650"
              }`}
            >
              • {p.name}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Guide notes */}
      {showHelp && !isLiveActive && (
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-4 text-[10.5px] text-zinc-600 leading-relaxed z-10 animate-fade-in">
          <p className="text-zinc-900 font-semibold mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Speech & Dialog Directives:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><span className="font-semibold text-zinc-800">Live voice</span> — Astra analyzes your Ganglion signals and speaks back in real time.</li>
            <li>Try: &quot;How am I feeling?&quot;, &quot;What should I work on?&quot;, &quot;Should I take a break?&quot;</li>
            <li>Type <span className="font-semibold text-zinc-800">"Review KiCad Specs"</span> for hardware doc simulation.</li>
            <li>Quick mic (when live is off) uses browser speech-to-text for commands.</li>
          </ul>
        </div>
      )}

      {/* 4. Actionable Hardware Doc & KiCad Quest Console - Simple Apple Sheet */}
      {questState !== "idle" && (
        <div className="bg-zinc-50/80 border border-zinc-200 rounded-2xl p-5 flex flex-col gap-3 font-sans animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-zinc-800 animate-pulse" />
              <span className="text-[10px] font-semibold text-zinc-800 uppercase tracking-widest">Workspace Agent Status</span>
            </div>
            <span className={`text-[8.5px] font-semibold uppercase px-2 py-0.5 rounded-full ${
              questState === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-blue-50 text-blue-700 border border-blue-50 animate-pulse"
            }`}>
              {questState}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-400">TARGET SCHEMA OBJECTIVE:</span>
            <p className="text-xs text-zinc-800 font-medium">{activeQuestTitle}</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-zinc-200/60 max-h-[120px] overflow-y-auto text-[10px] text-zinc-500 flex flex-col gap-1 leading-relaxed font-mono">
            {questLogs.map((log, idx) => (
              <div 
                key={idx} 
                className={log.includes("compiled") || log.includes("completed") ? "text-emerald-600 font-semibold" : "text-zinc-600"}
              >
                🍳 {log}
              </div>
            ))}
          </div>

          {questState !== "completed" ? (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <RefreshCw className="w-3 h-3 text-cyan-600 animate-spin" />
              <span>Analyzing circuit impedance in KiCad editor...</span>
            </div>
          ) : (
            <button
              onClick={() => setQuestState("idle")}
              className="w-full bg-zinc-900 hover:bg-zinc-850 text-white py-2 rounded-xl text-[10.5px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              Dismiss Workspace Report
            </button>
          )}
        </div>
      )}

      {/* Dialogue history — compact when not in live mode (live uses LiveAnalysisPanel transcript) */}
      {!isLiveActive && (
      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-5">
        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">Conversation:</span>
        
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 max-h-[160px] min-h-[110px] bg-zinc-50/50 p-4 rounded-2xl border border-zinc-100 scroll-smooth"
        >
          {chatHistory.slice(-6).map((msg) => (
            <div 
              key={msg.id}
              className={`flex flex-col gap-0.5 max-w-[85%] ${
                msg.sender === "user" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              <span className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-wide">
                {msg.sender === "user" ? "Dara (You)" : "Astra"} • {msg.timestamp}
              </span>

              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-zinc-900 text-white rounded-tr-none px-3.5 py-2"
                  : "bg-white border border-zinc-200/50 text-zinc-800 rounded-tl-none px-3.5 py-2 shadow-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="self-start flex flex-col gap-0.5">
              <span className="text-[8px] font-mono text-zinc-400 animate-pulse">Syncing Astra…</span>
              <div className="bg-white border border-zinc-200 px-3 py-2 rounded-2xl rounded-tl-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-450 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-zinc-450 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-zinc-450 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {micError && (
        <p className="text-[9px] font-mono text-rose-500 mb-1 text-center">{micError}</p>
      )}

      {/* Main Interaction Input and Quick Triggers */}
      <div className="flex flex-col gap-2">
        {/* Dynamic Launch Hardware Trigger */}
        {questState === "idle" && (
          <button
            onClick={() => launchHardwareDocQuest()}
            className="bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/80 rounded-2xl p-2.5 text-[10px] font-medium tracking-wide cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5 text-zinc-500" />
            <span>Verify KiCad & Generate Aora Specs Draft</span>
            <ArrowRight className="w-3" />
          </button>
        )}

        <div className="flex items-center gap-2">
          {!isLiveActive && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 ${
                listening 
                  ? "bg-rose-50 border-rose-200 text-rose-500 animate-pulse" 
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 shadow-sm"
              }`}
              title={listening ? "Listening..." : "Quick voice command"}
            >
              {listening ? <Mic className="w-4 h-4 text-rose-500" /> : <MicOff className="w-4 h-4 text-zinc-400" />}
            </button>
          )}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex-1 flex items-center gap-2 bg-zinc-50 border border-zinc-200/60 rounded-2xl px-4 py-2.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isLiveActive
                  ? "Type to Astra (live session)…"
                  : listening
                  ? "Listening verbal audio..."
                  : "Type instructions to Astra..."
              }
              disabled={listening && !isLiveActive}
              className="flex-1 bg-transparent text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-0 pr-2 border-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
