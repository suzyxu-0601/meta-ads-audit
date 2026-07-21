import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Response } from "express";
import type { AuditResponse } from "./types.js";
import { aggregateByMonth, computeKpiSummary } from "./monthlyAggregate.js";
import { generateCharts } from "./chartGen.js";
import { generateSlideJson } from "./claudeClient.js";
import { SLIDE_DEFINITIONS, SYSTEM_PROMPT, buildUserPrompt } from "./slidePrompts.js";
import { buildDeck } from "./deckBuilder.js";
import type { GeneratedSlide, PublicGeneratedSlide } from "./deckTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(__dirname, "..", "generated");

type JobStatus = "running" | "completed" | "cancelled" | "error";

interface JobEvent {
  event: string;
  data: unknown;
}

interface Job {
  id: string;
  status: JobStatus;
  insights: AuditResponse;
  controller: AbortController;
  events: JobEvent[];
  listeners: Set<Response>;
  pptxPath?: string;
}

const jobs = new Map<string, Job>();
const TOTAL_STEPS = 1 + SLIDE_DEFINITIONS.length + 1; // charts + slides + pptx assembly

function emit(job: Job, event: string, data: unknown) {
  job.events.push({ event, data });
  for (const res of job.listeners) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function closeListeners(job: Job) {
  for (const res of job.listeners) res.end();
  job.listeners.clear();
}

async function chartToDataUrl(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function toPublicSlide(slide: GeneratedSlide): Promise<PublicGeneratedSlide> {
  if (!slide.chartPaths) {
    return { id: slide.id, title: slide.title, content: slide.content };
  }
  const [spend, roasCpa, cpmFreq] = await Promise.all([
    chartToDataUrl(slide.chartPaths.spend),
    chartToDataUrl(slide.chartPaths.roasCpa),
    chartToDataUrl(slide.chartPaths.cpmFreq),
  ]);
  return {
    id: slide.id,
    title: slide.title,
    content: slide.content,
    chartDataUrls: { spend, roasCpa, cpmFreq },
  };
}

export function createJob(insights: AuditResponse): string {
  const id = randomUUID();
  const job: Job = {
    id,
    status: "running",
    insights,
    controller: new AbortController(),
    events: [],
    listeners: new Set(),
  };
  jobs.set(id, job);

  runJob(job).catch((err) => {
    if (job.status === "cancelled") return; // expected — abort() rejects the in-flight call
    job.status = "error";
    emit(job, "error", { message: err instanceof Error ? err.message : String(err) });
    closeListeners(job);
  });

  return id;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function subscribeToJob(id: string, res: Response): boolean {
  const job = jobs.get(id);
  if (!job) return false;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  for (const { event, data } of job.events) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  if (job.status === "running") {
    job.listeners.add(res);
    res.on("close", () => job.listeners.delete(res));
  } else {
    res.end();
  }
  return true;
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;
  job.status = "cancelled";
  job.controller.abort();
  emit(job, "cancelled", {});
  closeListeners(job);
  return true;
}

async function runJob(job: Job): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in .env");

  const jobDir = path.join(GENERATED_DIR, job.id);
  let completed = 0;
  const progress = (label: string) => emit(job, "progress", { completed, total: TOTAL_STEPS, label });

  emit(job, "log", { chunk: "Aggregating monthly performance data from Meta insights...\n" });
  const monthly = aggregateByMonth(job.insights.monthlyTrend);
  const kpiSummary = computeKpiSummary(monthly);
  emit(job, "kpi", kpiSummary);

  progress("Generating charts");
  emit(job, "log", { chunk: "Rendering charts with matplotlib...\n" });
  const chartPaths = await generateCharts(monthly, path.join(jobDir, "charts"));
  completed++;
  emit(job, "log", { chunk: "Charts ready.\n" });

  const slides: GeneratedSlide[] = [];

  for (const slideDef of SLIDE_DEFINITIONS) {
    if (job.controller.signal.aborted) return;

    progress(`Generating slide: ${slideDef.title}`);
    emit(job, "log", { chunk: `\n--- ${slideDef.title} ---\n` });

    const userPrompt = buildUserPrompt(slideDef.id, job.insights, monthly, kpiSummary);
    const content = await generateSlideJson({
      apiKey,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      signal: job.controller.signal,
      onText: (chunk) => emit(job, "log", { chunk }),
    });

    if (job.controller.signal.aborted) return;

    const generatedSlide: GeneratedSlide = {
      id: slideDef.id,
      title: slideDef.title,
      content,
      chartPaths: slideDef.id === "performance-overview" ? chartPaths : undefined,
    };
    slides.push(generatedSlide);
    completed++;
    emit(job, "slide", await toPublicSlide(generatedSlide));
  }

  if (job.controller.signal.aborted) return;

  progress("Assembling PPTX");
  emit(job, "log", { chunk: "\nAssembling the final PPTX...\n" });
  const pptxPath = path.join(jobDir, "GR0-Audit-Deck.pptx");
  await buildDeck(slides, kpiSummary, pptxPath);
  completed++;

  job.pptxPath = pptxPath;
  job.status = "completed";
  emit(job, "log", { chunk: "Done.\n" });
  emit(job, "progress", { completed, total: TOTAL_STEPS, label: "Done" });
  emit(job, "done", { downloadUrl: `/api/deck/${job.id}/pptx` });
  closeListeners(job);
}
