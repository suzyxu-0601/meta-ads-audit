import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCampaignAudit } from "./facebookApi.js";
import type { AuditRequest } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3000;
const TOKEN = process.env.META_SYSTEM_USER_TOKEN;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

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

app.listen(PORT, () => {
  console.log(`Meta Ads audit app running at http://localhost:${PORT}`);
});
