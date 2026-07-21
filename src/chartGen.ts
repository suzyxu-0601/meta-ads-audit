import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MonthlyAggregate } from "./monthlyAggregate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const PYTHON_BIN = path.join(PROJECT_ROOT, ".venv", "bin", "python3");
const CHART_SCRIPT = path.join(PROJECT_ROOT, "scripts", "generate_charts.py");

export interface ChartPaths {
  spend: string;
  roasCpa: string;
  cpmFreq: string;
}

export async function generateCharts(
  monthly: MonthlyAggregate[],
  outputDir: string
): Promise<ChartPaths> {
  await fs.mkdir(outputDir, { recursive: true });
  const inputPath = path.join(outputDir, "input.json");
  await fs.writeFile(inputPath, JSON.stringify({ monthly }));

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [CHART_SCRIPT, inputPath, outputDir]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Chart generation failed (exit ${code}): ${stderr}`));
    });
  });

  return {
    spend: path.join(outputDir, "chart_spend.png"),
    roasCpa: path.join(outputDir, "chart_roas_cpa.png"),
    cpmFreq: path.join(outputDir, "chart_cpm_freq.png"),
  };
}
