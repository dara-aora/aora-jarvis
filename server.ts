import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure Gemini is initialized correctly with safety checks
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    console.warn("GEMINI_API_KEY is not defined. Jarvis AI suggestions will run on backup simulated guidance.");
  }
} catch (err) {
  console.error("Error initializing GoogleGenAI client:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Check Status
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Jarvis Cognitive Reasoning Endpoint
  app.post("/api/jarvis/chat", async (req, res) => {
    try {
      const { message, eegStats, tasks, chatHistory } = req.body;

      if (!ai) {
        // Fallback simulated intelligent response if API key is not ready yet
        const simulatedReplies = [
          `Splendid task request, Sir. Given your current attention factor of ${(eegStats?.focusScore || 75)}% and remaining mental mana at ${(eegStats?.mana || 80)} pts, I advocate focusing on quick administrative items, then dedicating 20 minutes to a neural reset before proceeding.`,
          `Acknowledged, Sir. Right ear feedback reports moderately elevated beta rhythms, indicating intensive focus. You have ${(eegStats?.mana || 80)} mana remaining, which allows roughly 2 hours of premium logical reasoning. I have aligned your task queue accordingly.`,
          `A rational inquiry, Sir. Analytically, your temporal lobes are currently generating tranquil alpha waves. This is a brilliant window for strategic scheduling or creative blueprinting. I am here to assist.`,
          `I recommend standard caution, Sir. Sustained cognitive density over the past hour has drawn your mana pool to ${(eegStats?.mana || 80)}%. Let us postpone the complex analytical tasks and engage in high-leverage light organization.`
        ];
        const randomSim = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];
        return res.json({
          response: `[SIMULATED COMPANION] ${randomSim}\n\n*(Note: To activate genuine Gemini advice, configure your GEMINI_API_KEY in the Secrets panel)*`
        });
      }

      // Format task state to provide full context to Jarvis
      const tasksSummary = Array.isArray(tasks) 
        ? tasks.map((t: any) => `- [${t.completed ? 'COMPLETED' : 'PENDING'}] ${t.title} (Est. Mana cost: ${t.manaCost} pts, Focus req: ${t.focusRequired})`).join("\n")
        : "No active task queue loaded.";

      // Incorporate current EEG metrics
      const focusText = eegStats 
        ? `Focus Score: ${eegStats.focusScore}%, Relaxation: ${eegStats.relaxScore}%, Left Ear (Behind): ${eegStats.leftEarBand}, Right Ear (Behind): ${eegStats.rightEarBand}, Mental Mana: ${eegStats.mana}/100. Average cognitive state indicator: ${eegStats.state || "Balanced"}.`
        : "Electrodes disconnected or initializing.";

      const systemInstruction = 
        `You are J.A.R.V.I.S., the user's elite cybernetic neural health assistant and cognitive supervisor. 
        The app is running on a beautiful futuristic dashboard visualizing live EEG data from an OpenBCI Ganglion board (2 behind-the-ear channels, 1 earlobe ground reference).
        Your speaking tone is exceptionally polite, analytical, elegant, slightly British, and deeply supportive of their cognitive wellbeing. You call the user 'Sir' or 'Ma'am' (or just keep it refined and respectful).
        
        Using the user's message, their live EEG statistics, and their active Task Queue, provide a hyper-intelligent feedback loop.
        - Analyze how much 'Mana' (cognitive energy) they have left today (maximum is 100 points). Advise them how to plan around their current state.
        - Highlight if they have high mental fatigue (elevated beta/theta ratio, or sustained drop in focus index) and tell them when a break or neural reset is mandatory.
        - Give clear task-scheduling guidance (e.g., 'I recommend tackling your highest-priority task now while focus waves are peak' or 'We should defer intensive logic tasks; your temporal lobes show cognitive saturation').
        - Format your response with beautiful, neat markdown, keeping it brief (2 short paragraphs, or a few direct bullet points). Avoid lengthy paragraphs. Use bold terms to create structural readability.`;

      // Construct previous chat history context if any
      const contentsList: any[] = [];
      if (Array.isArray(chatHistory)) {
        chatHistory.slice(-6).forEach(h => {
          contentsList.push({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        });
      }
      
      // Add current request with context payload
      const currentPromptText = 
`--- LIVE SYSTEM LOGS ---
EEG State: ${focusText}
Current Tasks Queue:
${tasksSummary}

--- USER REQUEST ---
"${message}"`;

      contentsList.push({
        role: "user",
        parts: [{ text: currentPromptText }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsList,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ response: response.text });
    } catch (error: any) {
      console.error("Jarvis backend query error:", error);
      res.status(500).json({ error: "Failed to communicate with the Jarvis system core.", raw: error?.message });
    }
  });

  // Vite Integration for Full-Stack Hot Reloading & Production Static Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Jarvis Centralized Intelligence server online on port ${PORT}`);
  });
}

startServer();
