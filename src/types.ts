export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  manaCost: number; // 0 to 100 representing depletion impact
  category: "Coding" | "Review" | "Health" | "Creative" | "Admin";
  focusRequired: "low" | "medium" | "high";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "jarvis";
  text: string;
  timestamp: string;
}

export interface BrainwavePowerBands {
  delta: number; // Deep sleep / absolute rest (1-4 Hz)
  theta: number; // Deep relaxation / daydreams / drowsiness (4-8 Hz)
  alpha: number; // Calm attention / quiet focus / relaxed wakefulness (8-12 Hz)
  beta: number;  // Active alert focus / logical calculation (12-30 Hz)
}

export interface LiveMetrics {
  focusScore: number;       // concentration 0-100% from Ganglion
  relaxScore: number;       // relaxation 0-100% from Ganglion
  stressScore: number;      // stress 0-100% from Ganglion
  noiseLevel: number;        // muscle artifact EMG level (primarily masseter teeth clench)
  impedanceCh1: "excellent" | "good" | "poor" | "disconnected"; // Ch1 Left temporal contact resistance
  impedanceCh2: "excellent" | "good" | "poor" | "disconnected"; // Ch2 Right temporal contact resistance
  ch1Microvolts: number;    // live voltage reading
  ch2Microvolts: number;    // live voltage reading
  manaLevel: number;        // mental capacity resource remaining today 0-100
  dominantBand: "Delta" | "Theta" | "Alpha" | "Beta";
}

export interface HistoricalFocusData {
  timeLabel: string; // e.g. "09:00", "10:00"
  focusScore: number;
  relaxScore: number;
  manaScore: number;
}
