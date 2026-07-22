import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js/auto";
import fs from "node:fs/promises";
import path from "node:path";
import type { MonthlyAggregate } from "./monthlyAggregate.js";

export interface ChartPaths {
  spend: string;
  roasCpa: string;
  cpmFreq: string;
}

// Same pixel size as the old matplotlib figures (6.2in x 3.4in @ 200dpi).
const WIDTH = 1240;
const HEIGHT = 680;

const GR0_BLUE = "#0163C3";
const GR0_ORANGE = "#F86120";
const TEXT_COLOR = "#E6E6E6";
const GRID_COLOR = "#3A4260";
const GRID_COLOR_SOFT = "rgba(58, 66, 96, 0.5)";
const GRID_COLOR_SOFTER = "rgba(58, 66, 96, 0.4)";

// Base tick font was 15px — 3x larger and bold, per request.
const TICK_FONT = { size: 45, weight: "bold" as const };
// Base axis title font was 15px — 4x larger, per request.
const TITLE_FONT = { size: 60 };
const MAX_Y_TICKS = 6;
// Base line width was 2.2 — 3x thicker for the two dual-axis charts.
const DUAL_AXIS_LINE_WIDTH = 6.6;

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "transparent",
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = "Arial, Helvetica, sans-serif";
    ChartJS.defaults.font.size = 15;
  },
});

function moneyLabel(value: number): string {
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

async function renderChart(configuration: ChartConfiguration, outPath: string): Promise<void> {
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration, "image/png");
  await fs.writeFile(outPath, buffer);
}

function spendChartConfig(monthly: MonthlyAggregate[]): ChartConfiguration {
  const labels = monthly.map((m) => m.monthShort);
  const spend = monthly.map((m) => m.spend);

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: spend,
          backgroundColor: spend.map((_, i) => (i === spend.length - 1 ? GR0_ORANGE : GR0_BLUE)),
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: TEXT_COLOR, font: TICK_FONT },
          grid: { display: false },
          border: { color: GRID_COLOR },
        },
        y: {
          ticks: {
            color: TEXT_COLOR,
            font: TICK_FONT,
            maxTicksLimit: MAX_Y_TICKS,
            callback: (v) => moneyLabel(Number(v)),
          },
          grid: { color: GRID_COLOR_SOFT, lineWidth: 0.6 },
          border: { color: GRID_COLOR },
          title: { display: true, text: "Spend", color: TEXT_COLOR, font: TITLE_FONT },
        },
      },
    },
  };
}

function dualAxisConfig(
  monthly: MonthlyAggregate[],
  leftAccessor: (m: MonthlyAggregate) => number,
  rightAccessor: (m: MonthlyAggregate) => number,
  leftLabel: string,
  rightLabel: string
): ChartConfiguration {
  const labels = monthly.map((m) => m.monthShort);

  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: leftLabel,
          data: monthly.map(leftAccessor),
          borderColor: GR0_BLUE,
          backgroundColor: GR0_BLUE,
          pointBackgroundColor: GR0_BLUE,
          yAxisID: "y",
          borderWidth: DUAL_AXIS_LINE_WIDTH,
          pointRadius: 4,
          tension: 0,
        },
        {
          label: rightLabel,
          data: monthly.map(rightAccessor),
          borderColor: GR0_ORANGE,
          backgroundColor: GR0_ORANGE,
          pointBackgroundColor: GR0_ORANGE,
          yAxisID: "y1",
          borderWidth: DUAL_AXIS_LINE_WIDTH,
          pointRadius: 4,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: TEXT_COLOR, font: TICK_FONT },
          grid: { display: false },
          border: { color: GRID_COLOR },
        },
        y: {
          type: "linear",
          position: "left",
          ticks: { color: GR0_BLUE, font: TICK_FONT, maxTicksLimit: MAX_Y_TICKS },
          grid: { color: GRID_COLOR_SOFTER, lineWidth: 0.6 },
          border: { color: GRID_COLOR },
          title: { display: true, text: leftLabel, color: GR0_BLUE, font: TITLE_FONT },
        },
        y1: {
          type: "linear",
          position: "right",
          ticks: { color: GR0_ORANGE, font: TICK_FONT, maxTicksLimit: MAX_Y_TICKS },
          grid: { display: false },
          border: { color: GRID_COLOR },
          title: { display: true, text: rightLabel, color: GR0_ORANGE, font: TITLE_FONT },
        },
      },
    },
  };
}

export async function generateCharts(
  monthly: MonthlyAggregate[],
  outputDir: string
): Promise<ChartPaths> {
  await fs.mkdir(outputDir, { recursive: true });

  const spendPath = path.join(outputDir, "chart_spend.png");
  const roasCpaPath = path.join(outputDir, "chart_roas_cpa.png");
  const cpmFreqPath = path.join(outputDir, "chart_cpm_freq.png");

  await Promise.all([
    renderChart(spendChartConfig(monthly), spendPath),
    renderChart(dualAxisConfig(monthly, (m) => m.roas, (m) => m.cpa, "ROAS", "CPA ($)"), roasCpaPath),
    renderChart(
      dualAxisConfig(monthly, (m) => m.cpm, (m) => m.frequency, "CPM ($)", "Frequency"),
      cpmFreqPath
    ),
  ]);

  return { spend: spendPath, roasCpa: roasCpaPath, cpmFreq: cpmFreqPath };
}
