import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

const JARVIS_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025";

dotenv.config({ path: ".env.local" });
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
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Check Status
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Ephemeral token for Gemini Live (voice + real-time EEG context)
  app.post("/api/jarvis/live-token", async (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured. Add it to .env to enable live voice.",
      });
    }

    try {
      const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const authTokens = (ai as { authTokens?: { create: (opts: unknown) => Promise<{ name?: string }> } })
        ?.authTokens;

      if (authTokens?.create) {
        const token = await authTokens.create({
          config: {
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
              model: JARVIS_LIVE_MODEL,
              config: { responseModalities: ["AUDIO"] },
            },
            httpOptions: { apiVersion: "v1alpha" },
          },
        });
        if (token?.name) {
          return res.json({ token: token.name, model: JARVIS_LIVE_MODEL, ephemeral: true });
        }
      }

      // REST fallback when SDK authTokens helper is unavailable
      const restRes = await fetch(
        "https://generativelanguage.googleapis.com/v1alpha/authTokens",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            config: {
              uses: 1,
              expireTime,
              newSessionExpireTime,
              liveConnectConstraints: {
                model: JARVIS_LIVE_MODEL,
                config: { responseModalities: ["AUDIO"] },
              },
            },
          }),
        }
      );

      if (restRes.ok) {
        const data = (await restRes.json()) as { name?: string };
        if (data.name) {
          return res.json({ token: data.name, model: JARVIS_LIVE_MODEL, ephemeral: true });
        }
      }

      // Local dev: direct key (never expose in production builds)
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[Jarvis Live] Using API key fallback — configure ephemeral tokens for production."
        );
        return res.json({ token: apiKey, model: JARVIS_LIVE_MODEL, ephemeral: false });
      }

      return res.status(502).json({
        error: "Could not create ephemeral live token. Check GEMINI_API_KEY permissions.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Live token error";
      console.error("[Jarvis Live] token error:", error);
      res.status(500).json({ error: message });
    }
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
      server: {
        middlewareMode: true,
        hmr: { strictPort: false },
      },
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Jarvis Centralized Intelligence server online on port ${PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\nPort ${PORT} is already in use. Another dev server is probably already running.\n` +
          `  → Open http://localhost:${PORT} in your browser, or stop the other process first:\n` +
          `    lsof -ti :${PORT} | xargs kill\n`
      );
      process.exit(1);
    }
    throw err;
  });
}

startServer();
