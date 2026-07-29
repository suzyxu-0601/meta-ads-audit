import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCampaignAudit } from "./facebookApi.js";
import type { AuditRequest, AuditResponse } from "./types.js";
import { createJob, subscribeToJob, cancelJob, getJob, markDownloaded } from "./jobManager.js";
import { verifyGoogleToken, createSession, getSession, destroySession } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3000;
const TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/assets", express.static(path.join(__dirname, "..", "assets")));

app.get("/api/auth/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID ?? null });
});

app.post("/api/auth/google", async (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: "GOOGLE_CLIENT_ID is not set in .env" });
    return;
  }

  const credential = req.body?.credential as string | undefined;
  if (!credential) {
    res.status(400).json({ error: "credential is required" });
    return;
  }

  try {
    const user = await verifyGoogleToken(credential, GOOGLE_CLIENT_ID);
    const sessionId = createSession(user);
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_MS,
    });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/auth/logout", (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId) destroySession(sessionId);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const user = sessionId ? getSession(sessionId) : null;
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(user);
});

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const user = sessionId ? getSession(sessionId) : null;
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  next();
}

app.use("/api/insights", requireAuth);
app.use("/api/deck", requireAuth);

app.post("/api/insights", async (req, res) => {
  if (!TOKEN) {
    res.status(500).json({ error: "META_SYSTEM_USER_TOKEN is not set in .env" });
    return;
  }

  const body = req.body as Partial<AuditRequest>;
  if (!body.account) {
    res.status(400).json({ error: "account is required" });
    return;
  }

  try {
    const result = await runCampaignAudit(body as AuditRequest, TOKEN);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/deck/start", (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set in .env" });
    return;
  }

  const insights = req.body?.insights as AuditResponse | undefined;
  if (!insights) {
    res.status(400).json({ error: "insights is required" });
    return;
  }

  const jobId = createJob(insights);
  res.status(202).json({ jobId });
});

app.get("/api/deck/stream/:jobId", (req, res) => {
  const ok = subscribeToJob(req.params.jobId, res);
  if (!ok) {
    res.status(404).end();
  }
});

app.post("/api/deck/cancel/:jobId", (req, res) => {
  const cancelled = cancelJob(req.params.jobId);
  res.json({ cancelled });
});

app.get("/api/deck/:jobId/pptx", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job || job.status !== "completed" || !job.pptxPath) {
    res.status(404).json({ error: "Deck not ready" });
    return;
  }
  markDownloaded(req.params.jobId);
  res.download(job.pptxPath, "GR0-Audit-Deck.pptx");
});

app.listen(PORT, () => {
  console.log(`Meta Ads audit app running at http://localhost:${PORT}`);
});
