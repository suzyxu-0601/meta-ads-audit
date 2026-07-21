import PptxGenJS from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratedSlide,
  PerformanceOverviewContent,
  ChallengesSolutionsContent,
  ThreeMonthOutlookContent,
  CampaignArchitectureContent,
  CreativeRoadmapContent,
  ChannelRoadmapContent,
} from "./deckTypes.js";
import type { KpiSummary } from "./monthlyAggregate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "..", "assets");

const BACKGROUND_IMAGE = path.join(ASSETS_DIR, "Arrangement-Dark-1.png");
const LOGO_IMAGE = path.join(ASSETS_DIR, "GR0_Logo_white.png");

const BRAND = {
  blue: "0163C3",
  orange: "F86120",
  textPrimary: "FFFFFF",
  textSecondary: "C9CDD6",
  cardFill: "1A2036",
};

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MIN_FONT = 12;
const FONT = "Arial";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

function roasX(n: number): string {
  return `${n.toFixed(2)}x`;
}

function addBrandChrome(slide: PptxGenJS.Slide) {
  slide.background = { path: BACKGROUND_IMAGE };
  slide.addImage({ path: LOGO_IMAGE, x: SLIDE_W - 0.85, y: SLIDE_H - 0.65, w: 0.5, h: 0.46 });
}

function addTitle(slide: PptxGenJS.Slide, title: string, subtitle?: string) {
  slide.addText(title, {
    x: 0.5,
    y: 0.32,
    w: SLIDE_W - 1.5,
    h: 0.6,
    fontSize: 26,
    bold: true,
    color: BRAND.textPrimary,
    fontFace: FONT,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.88,
      w: SLIDE_W - 1.5,
      h: 0.35,
      fontSize: MIN_FONT,
      bold: true,
      color: BRAND.orange,
      fontFace: FONT,
    });
  }
}

function bulletList(
  slide: PptxGenJS.Slide,
  heading: string,
  items: string[],
  opts: { x: number; y: number; w: number; h: number }
) {
  slide.addText(heading, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: BRAND.orange,
    fontFace: FONT,
  });
  slide.addText(
    items.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
    {
      x: opts.x,
      y: opts.y + 0.4,
      w: opts.w,
      h: opts.h - 0.4,
      fontSize: MIN_FONT,
      color: BRAND.textSecondary,
      fontFace: FONT,
      valign: "top",
      paraSpaceAfter: 8,
    }
  );
}

function buildPerformanceOverview(
  pptx: PptxGenJS,
  slide: GeneratedSlide,
  kpi: KpiSummary | null
) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);

  if (kpi) {
    const stats: [string, string][] = [
      ["Total Spend", money(kpi.totalSpend)],
      ["Peak ROAS", `${roasX(kpi.peakRoas.value)} (${kpi.peakRoas.month})`],
      ["Current ROAS", roasX(kpi.currentRoas)],
      ["CPM Change", pct(kpi.cpmChangePct)],
      ["CPA Change", pct(kpi.cpaChangePct)],
    ];
    const boxW = (SLIDE_W - 1 - 0.4 * 4) / 5;
    stats.forEach(([label, value], i) => {
      const x = 0.5 + i * (boxW + 0.4);
      s.addShape("roundRect", {
        x,
        y: 1.15,
        w: boxW,
        h: 1.05,
        fill: { color: BRAND.cardFill, transparency: 15 },
        line: { color: BRAND.blue, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(value, {
        x,
        y: 1.22,
        w: boxW,
        h: 0.55,
        fontSize: 18,
        bold: true,
        color: BRAND.orange,
        align: "center",
        fontFace: FONT,
      });
      s.addText(label, {
        x,
        y: 1.75,
        w: boxW,
        h: 0.35,
        fontSize: MIN_FONT,
        color: BRAND.textSecondary,
        align: "center",
        fontFace: FONT,
      });
    });
  }

  if (slide.chartPaths) {
    const chartW = (SLIDE_W - 1 - 0.3 * 2) / 3;
    const chartY = 2.45;
    const chartH = chartW * (3.4 / 6.2);
    [slide.chartPaths.spend, slide.chartPaths.roasCpa, slide.chartPaths.cpmFreq].forEach(
      (imgPath, i) => {
        s.addImage({ path: imgPath, x: 0.5 + i * (chartW + 0.3), y: chartY, w: chartW, h: chartH });
      }
    );
  }

  const content = slide.content as PerformanceOverviewContent;
  const bottomY = 5.35;
  bulletList(s, "Insights", content.insights, { x: 0.5, y: bottomY, w: (SLIDE_W - 1.3) / 2, h: 1.9 });
  bulletList(s, "Recommendations", content.recommendations, {
    x: 0.5 + (SLIDE_W - 1.3) / 2 + 0.3,
    y: bottomY,
    w: (SLIDE_W - 1.3) / 2,
    h: 1.9,
  });
}

function buildChallengesSolutions(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);

  const content = slide.content as ChallengesSolutionsContent;
  const colW = (SLIDE_W - 1 - 0.35 * 2) / 3;

  content.columns.slice(0, 3).forEach((col, i) => {
    const x = 0.5 + i * (colW + 0.35);
    s.addShape("roundRect", {
      x,
      y: 1.25,
      w: colW,
      h: 5.6,
      fill: { color: BRAND.cardFill, transparency: 15 },
      line: { color: BRAND.blue, width: 1 },
      rectRadius: 0.08,
    });
    s.addText(col.theme, {
      x: x + 0.2,
      y: 1.4,
      w: colW - 0.4,
      h: 0.6,
      fontSize: 16,
      bold: true,
      color: BRAND.orange,
      fontFace: FONT,
    });
    s.addText("CHALLENGE", {
      x: x + 0.2,
      y: 2.05,
      w: colW - 0.4,
      h: 0.3,
      fontSize: MIN_FONT,
      bold: true,
      color: BRAND.blue,
      fontFace: FONT,
    });
    s.addText(col.challenge, {
      x: x + 0.2,
      y: 2.35,
      w: colW - 0.4,
      h: 1.7,
      fontSize: MIN_FONT,
      color: BRAND.textSecondary,
      fontFace: FONT,
      valign: "top",
    });
    s.addText("SOLUTION", {
      x: x + 0.2,
      y: 4.15,
      w: colW - 0.4,
      h: 0.3,
      fontSize: MIN_FONT,
      bold: true,
      color: BRAND.blue,
      fontFace: FONT,
    });
    s.addText(col.solution, {
      x: x + 0.2,
      y: 4.45,
      w: colW - 0.4,
      h: 2.2,
      fontSize: MIN_FONT,
      color: BRAND.textSecondary,
      fontFace: FONT,
      valign: "top",
    });
  });
}

function buildThreeMonthOutlook(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  const content = slide.content as ThreeMonthOutlookContent;
  addTitle(s, slide.title, `North star: ${content.northStar}`);

  const headerRow: PptxGenJS.TableRow = [
    "Month",
    "Campaign Structure",
    "Creative Testing",
    "Channel Expansion",
    "KPI Targets",
  ].map((text) => ({
    text,
    options: { bold: true, color: BRAND.orange, fill: { color: BRAND.cardFill }, fontSize: MIN_FONT },
  }));

  const rows: PptxGenJS.TableRow[] = content.months.map((m) => [
    { text: m.title, options: { bold: true, color: BRAND.blue, fontSize: MIN_FONT } },
    { text: m.campaignChanges, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: m.creativeTesting, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: m.channelExpansion, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: m.kpiTargets, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
  ]);

  s.addTable([headerRow, ...rows], {
    x: 0.5,
    y: 1.5,
    w: SLIDE_W - 1,
    colW: [1.7, 2.65, 2.65, 2.65, 2.65],
    fontFace: FONT,
    valign: "top",
    border: { type: "solid", color: BRAND.blue, pt: 0.5 },
    fill: { color: "10142A" },
    autoPage: false,
  });
}

function buildCampaignArchitecture(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);
  const content = slide.content as CampaignArchitectureContent;

  const fields: [string, (st: CampaignArchitectureContent["stages"][number]) => string][] = [
    ["Budget Split", (st) => `${st.budgetSplitPct}%`],
    ["Campaigns", (st) => st.campaignNames.join(", ")],
    ["Targeting", (st) => st.targeting],
    ["Creative Types", (st) => st.creativeTypes],
    ["CPA Target", (st) => st.cpaTarget],
    ["ROAS Target", (st) => st.roasTarget],
  ];

  const headerRow: PptxGenJS.TableRow = [
    { text: "", options: { fill: { color: BRAND.cardFill } } },
    ...content.stages.map((st) => ({
      text: st.stage,
      options: {
        bold: true,
        color: BRAND.orange,
        fill: { color: BRAND.cardFill },
        fontSize: MIN_FONT,
        align: "center" as const,
      },
    })),
  ];

  const rows: PptxGenJS.TableRow[] = fields.map(([label, getValue]) => [
    { text: label, options: { bold: true, color: BRAND.blue, fontSize: MIN_FONT } },
    ...content.stages.map((st) => ({
      text: getValue(st),
      options: { color: BRAND.textSecondary, fontSize: MIN_FONT },
    })),
  ]);

  s.addTable([headerRow, ...rows], {
    x: 0.5,
    y: 1.3,
    w: SLIDE_W - 1,
    colW: [1.7, 3.54, 3.54, 3.55],
    fontFace: FONT,
    valign: "top",
    border: { type: "solid", color: BRAND.blue, pt: 0.5 },
    fill: { color: "10142A" },
    autoPage: false,
  });
}

function buildCreativeTestingRoadmap(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);
  const content = slide.content as CreativeRoadmapContent;

  const headerRow: PptxGenJS.TableRow = [
    "Persona",
    "Hooks",
    "Angle",
    "Format",
    "Creator",
    "Target CPA / Thumbstop",
  ].map((text) => ({
    text,
    options: { bold: true, color: BRAND.orange, fill: { color: BRAND.cardFill }, fontSize: MIN_FONT },
  }));

  const rows: PptxGenJS.TableRow[] = content.personas.map((p) => [
    { text: p.name, options: { bold: true, color: BRAND.blue, fontSize: MIN_FONT } },
    { text: p.hooks.map((h) => `• ${h}`).join("\n"), options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: p.angle, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: p.format, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: p.creator, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: `${p.targetCpa} / ${p.targetThumbstop}`, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
  ]);

  s.addTable([headerRow, ...rows], {
    x: 0.5,
    y: 1.4,
    w: SLIDE_W - 1,
    colW: [1.6, 4.0, 1.7, 1.6, 1.6, 1.83],
    fontFace: FONT,
    valign: "top",
    border: { type: "solid", color: BRAND.blue, pt: 0.5 },
    fill: { color: "10142A" },
    autoPage: false,
  });
}

function buildChannelExpansionRoadmap(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);
  const content = slide.content as ChannelRoadmapContent;

  const statusTag = (status: string) => `[${status.toUpperCase()}]`;

  const headerRow: PptxGenJS.TableRow = ["Channel", "Month 1", "Month 2", "Month 3"].map((text) => ({
    text,
    options: { bold: true, color: BRAND.orange, fill: { color: BRAND.cardFill }, fontSize: MIN_FONT },
  }));

  const rows: PptxGenJS.TableRow[] = content.channels.map((ch) => [
    {
      text: `${ch.name}\n\nBudget: ${ch.budgetRange}\nCreative: ${ch.creativeFormats}\nTargeting: ${ch.targetingApproach}\nType: ${ch.campaignType}`,
      options: { bold: true, color: BRAND.blue, fontSize: MIN_FONT },
    },
    { text: `${statusTag(ch.month1.status)}\n${ch.month1.actions}`, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: `${statusTag(ch.month2.status)}\n${ch.month2.actions}`, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
    { text: `${statusTag(ch.month3.status)}\n${ch.month3.actions}`, options: { color: BRAND.textSecondary, fontSize: MIN_FONT } },
  ]);

  s.addTable([headerRow, ...rows], {
    x: 0.5,
    y: 1.4,
    w: SLIDE_W - 1,
    colW: [3.0, 3.11, 3.11, 3.11],
    fontFace: FONT,
    valign: "top",
    border: { type: "solid", color: BRAND.blue, pt: 0.5 },
    fill: { color: "10142A" },
    autoPage: false,
  });
}

export async function buildDeck(
  slides: GeneratedSlide[],
  kpiSummary: KpiSummary | null,
  outputPath: string
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "GR0_WIDE", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "GR0_WIDE";

  for (const slide of slides) {
    switch (slide.id) {
      case "performance-overview":
        buildPerformanceOverview(pptx, slide, kpiSummary);
        break;
      case "challenges-solutions":
        buildChallengesSolutions(pptx, slide);
        break;
      case "three-month-outlook":
        buildThreeMonthOutlook(pptx, slide);
        break;
      case "campaign-architecture":
        buildCampaignArchitecture(pptx, slide);
        break;
      case "creative-testing-roadmap":
        buildCreativeTestingRoadmap(pptx, slide);
        break;
      case "channel-expansion-roadmap":
        buildChannelExpansionRoadmap(pptx, slide);
        break;
    }
  }

  await pptx.writeFile({ fileName: outputPath });
}
