import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." }
}));

const client = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "put_your_api_key_here"
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(client),
    model: process.env.OPENAI_MODEL || "gpt-6-astra"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        error: "AI is not configured yet. Add your API key to the .env file, then restart the app."
      });
    }

    const { messages, webSearch = false } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
      return res.status(400).json({ error: "Send between 1 and 30 chat messages." });
    }

    const cleanMessages = messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));

    if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "The last message must be from the user." });
    }

    const instructions = [
      "You are SatyaAI, a helpful, honest, friendly AI assistant.",
      "Reply in the language the user uses. If they use Hinglish, you may use natural Hinglish.",
      "Explain things clearly and step by step when useful.",
      "Do not pretend you accessed the internet unless live web search was enabled and actually used.",
      "When using web search, cite reliable sources with clickable source links when possible.",
      "If unsure, say so instead of inventing facts."
    ].join(" ");

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-astra",
      instructions,
      input: cleanMessages,
      ...(webSearch ? {
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"]
      } : {})
    });

    const sources = [];
    for (const item of (response.output || [])) {
      if (item.type === "message") {
        for (const part of (item.content || [])) {
          for (const annotation of (part.annotations || [])) {
            if (annotation.type === "url_citation" && annotation.url) {
              sources.push({
                title: annotation.title || annotation.url,
                url: annotation.url
              });
            }
          }
        }
      }
      if (item.type === "web_search_call" && item.action?.sources) {
        for (const source of item.action.sources) {
          if (source.url) sources.push({ title: source.title || source.url, url: source.url });
        }
      }
    }

    const uniqueSources = [...new Map(sources.map(s => [s.url, s])).values()].slice(0, 8);
    res.json({
      reply: response.output_text || "I couldn't generate a text response. Please try again.",
      sources: uniqueSources
    });
  } catch (error) {
    console.error("Chat API error:", error?.message || error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    let message = "Something went wrong while contacting the AI service.";
    if (status === 401) message = "The API key was rejected. Check the key in your .env file.";
    else if (status === 429) message = "The AI service rate limit or account quota was reached. Check your API account and billing.";
    else if (status === 400) message = "The AI service rejected the request. Check the model name in your .env file.";
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
});

app.get("*path", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`SatyaAI is running at http://localhost:${port}`);
});
