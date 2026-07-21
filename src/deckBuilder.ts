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
  darkText: "14172B",
  lightOrangeBg: "FCE9D7",
  lightBlueBg: "DCEBFB",
  statusActive: "1E8E3E",
  statusLaunch: "D32F2F",
  tagFill: "FFFFFF",
};

// We have no legitimate source for official third-party platform logos, and
// the two expansion channels vary per account (Claude proposes them), so
// platform "icons" are monogram circles rather than real brand marks — kept
// a single consistent blue rather than per-platform colors.

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MIN_FONT = 10;
const FALLBACK_FONT = MIN_FONT - 2; // used only when overflow is detected
const TABLE_BOTTOM_MARGIN = 0.35;
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

/**
 * Claude is asked for a bare number (e.g. "$110" or "3.0x"), but as a safety
 * net against it slipping in a justification clause anyway, trim anything
 * past the first punctuation/connector word down to just the leading value
 * so the CPA/ROAS stat callouts never overflow their box.
 */
function shortStat(value: string, maxLen = 14): string {
  const trimmed = value.trim();
  const cutIdx = trimmed.search(/[;,(]| - | at | as | to /i);
  const short = cutIdx > 0 ? trimmed.slice(0, cutIdx).trim() : trimmed;
  return short.length > maxLen ? `${short.slice(0, maxLen - 1)}…` : short;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateRange(period: { since: string; until: string }): string {
  return `${formatDate(period.since)} – ${formatDate(period.until)}`;
}

// ---------------------------------------------------------------------------
// Overflow estimation — pptxgenjs has no real text-layout engine, so this is a
// heuristic (average glyph width) used to decide whether a table/text block
// needs a smaller font or reweighted column widths before it overflows the
// slide's fixed 7.5" height.
// ---------------------------------------------------------------------------

function estimateWrappedLines(text: string, colWidthIn: number, fontPt: number): number {
  const avgCharWidthIn = (fontPt * 0.52) / 72;
  const usableWidthIn = Math.max(colWidthIn - 0.2, 0.3);
  const charsPerLine = Math.max(Math.floor(usableWidthIn / avgCharWidthIn), 1);
  return text
    .split("\n")
    .reduce((sum, seg) => sum + Math.max(Math.ceil(seg.length / charsPerLine), 1), 0);
}

function estimateTextBlockHeight(text: string, widthIn: number, fontPt: number): number {
  const lineHeightIn = (fontPt * 1.3) / 72;
  return estimateWrappedLines(text, widthIn, fontPt) * lineHeightIn;
}

function estimateTableHeight(rows: string[][], colWidths: number[], fontPt: number): number {
  const lineHeightIn = (fontPt * 1.25) / 72;
  const cellPaddingIn = 0.12;
  return rows.reduce((sum, row) => {
    const maxLines = row.reduce(
      (max, text, i) => Math.max(max, estimateWrappedLines(text, colWidths[i], fontPt)),
      1
    );
    return sum + maxLines * lineHeightIn + cellPaddingIn;
  }, 0);
}

function reweightColumnWidths(rows: string[][], initialWidths: number[]): number[] {
  const totalWidth = initialWidths.reduce((a, b) => a + b, 0);
  const maxLen = initialWidths.map((_, i) => Math.max(1, ...rows.map((row) => row[i]?.length ?? 0)));
  const totalLen = maxLen.reduce((a, b) => a + b, 0);
  const minWidth = totalWidth * 0.09;
  const widths = maxLen.map((len) => Math.max((totalWidth * len) / totalLen, minWidth));
  const scale = totalWidth / widths.reduce((a, b) => a + b, 0);
  return widths.map((w) => Math.round(w * scale * 100) / 100);
}

/**
 * Resolves a font size + column widths for a table so it fits the vertical
 * space available on the slide. Tries the default font size with the given
 * widths first; if that would overflow, reweights column widths toward
 * whichever columns hold the most text; if it still doesn't fit, falls back
 * to a 2pt-smaller font (the two remedies called out in the brand spec).
 */
function resolveTableFit(
  rows: string[][],
  initialColWidths: number[],
  startY: number
): { fontSize: number; colWidths: number[] } {
  const available = SLIDE_H - startY - TABLE_BOTTOM_MARGIN;

  if (estimateTableHeight(rows, initialColWidths, MIN_FONT) <= available) {
    return { fontSize: MIN_FONT, colWidths: initialColWidths };
  }

  const reweighted = reweightColumnWidths(rows, initialColWidths);
  if (estimateTableHeight(rows, reweighted, MIN_FONT) <= available) {
    return { fontSize: MIN_FONT, colWidths: reweighted };
  }

  return { fontSize: FALLBACK_FONT, colWidths: reweighted };
}

function addPlatformIcon(slide: PptxGenJS.Slide, name: string, x: number, y: number, size: number) {
  slide.addShape("ellipse", { x, y, w: size, h: size, fill: { color: BRAND.blue }, line: { type: "none" } });
  slide.addText(name.trim().charAt(0).toUpperCase(), {
    x,
    y,
    w: size,
    h: size,
    fontSize: Math.round(size * 40),
    bold: true,
    color: "FFFFFF",
    align: "center",
    valign: "middle",
    fontFace: FONT,
  });
}

/** Renders an ACTIVE/LAUNCH status as a colored pill; PLANNING gets no badge at all. */
function addStatusBadge(
  slide: PptxGenJS.Slide,
  status: string,
  x: number,
  y: number,
  fontPt: number
): number {
  if (status !== "active" && status !== "launch") return 0;
  const bg = status === "active" ? BRAND.statusActive : BRAND.statusLaunch;
  const label = status.toUpperCase();
  const w = (label.length * fontPt * 0.72) / 72 + 0.3;
  const h = (fontPt * 1.3) / 72 + 0.08;
  slide.addShape("roundRect", { x, y, w, h, fill: { color: bg }, line: { type: "none" }, rectRadius: 0.06 });
  slide.addText(label, {
    x,
    y,
    w,
    h,
    fontSize: fontPt - 1,
    bold: true,
    color: "FFFFFF",
    align: "center",
    valign: "middle",
    fontFace: FONT,
    wrap: false,
  });
  return h;
}

function estimateTagWidth(text: string, fontPt: number): number {
  return (text.length * fontPt * 0.55) / 72 + 0.24;
}

/**
 * Lays out light-blue "chip" tags left-to-right, wrapping to a new row within
 * maxWidth. A long tag that doesn't fit on one line at all is clamped to the
 * full column width and allowed to wrap internally — its height (and every
 * row's height) accounts for that, so later content is never placed on top
 * of a tag that actually rendered as 2+ lines.
 *
 * Pass `slide: null` to measure the layout (e.g. to decide a font size)
 * without drawing anything; pass a real slide to actually render it. Both
 * calls share this one layout calculation so measurement can't drift from
 * what's actually drawn.
 */
function layoutTags(
  slide: PptxGenJS.Slide | null,
  items: string[],
  x: number,
  y: number,
  maxWidth: number,
  fontPt: number
): number {
  const gapX = 0.08;
  const gapY = 0.08;
  const paddingX = 0.16;
  const paddingY = 0.12;
  const lineHeightIn = (fontPt * 1.3) / 72;

  let curX = x;
  let curY = y;
  let rowMaxH = 0;

  for (const item of items) {
    const tagW = Math.min(estimateTagWidth(item, fontPt), maxWidth);
    const textW = Math.max(tagW - paddingX, 0.3);
    const lines = estimateWrappedLines(item, textW, fontPt);
    const tagH = (lines * lineHeightIn + paddingY) * 0.7; // 30% shorter than a full-height chip

    if (curX + tagW > x + maxWidth && curX > x) {
      curX = x;
      curY += rowMaxH + gapY;
      rowMaxH = 0;
    }

    if (slide) {
      slide.addShape("roundRect", {
        x: curX,
        y: curY,
        w: tagW,
        h: tagH,
        fill: { color: BRAND.lightBlueBg },
        line: { type: "none" },
        rectRadius: 0.06,
      });
      slide.addText(item, {
        x: curX + paddingX / 2,
        y: curY,
        w: textW,
        h: tagH,
        fontSize: fontPt,
        color: BRAND.darkText,
        align: "left",
        valign: "middle",
        fontFace: FONT,
      });
    }

    curX += tagW + gapX;
    rowMaxH = Math.max(rowMaxH, tagH);
  }
  return curY + rowMaxH - y;
}

function addBrandChrome(slide: PptxGenJS.Slide) {
  slide.background = { path: BACKGROUND_IMAGE };
  slide.addImage({ path: LOGO_IMAGE, x: SLIDE_W - 0.85, y: 0.3, w: 0.5, h: 0.46 });
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

  const titleW = 4.6;
  s.addText(slide.title, {
    x: 0.5,
    y: 0.32,
    w: titleW,
    h: 0.6,
    fontSize: 26,
    bold: true,
    color: BRAND.textPrimary,
    fontFace: FONT,
  });

  if (slide.auditPeriod) {
    const periodX = 0.5 + titleW + 0.15;
    s.addText(formatDateRange(slide.auditPeriod), {
      x: periodX,
      y: 0.32,
      w: SLIDE_W - 0.85 - 0.2 - periodX,
      h: 0.6,
      fontSize: 14,
      color: BRAND.textSecondary,
      fontFace: FONT,
      valign: "middle",
    });
  }

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
  const bottomY = 4.8;
  bulletList(s, "Insights", content.insights, { x: 0.5, y: bottomY, w: (SLIDE_W - 1.3) / 2, h: 2.2 });
  bulletList(s, "Recommendations", content.recommendations, {
    x: 0.5 + (SLIDE_W - 1.3) / 2 + 0.3,
    y: bottomY,
    w: (SLIDE_W - 1.3) / 2,
    h: 2.2,
  });
}

function buildChallengesSolutions(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);

  const content = slide.content as ChallengesSolutionsContent;
  const columns = content.columns.slice(0, 3);
  const colW = (SLIDE_W - 1 - 0.35 * 2) / 3;
  const innerW = colW - 0.4;

  const themeY = 1.3;
  const themeH = 0.35;
  const labelH = 0.3;
  const boxPadding = 0.3;
  const boxGap = 0.2;
  const challengeY = themeY + themeH + 0.15;
  const budgetH = SLIDE_H - TABLE_BOTTOM_MARGIN - challengeY;

  const boxHeightsAt = (fontPt: number) =>
    columns.map((col) => ({
      challengeBoxH: Math.max(labelH + estimateTextBlockHeight(col.challenge, innerW, fontPt) + boxPadding, 1.1),
      solutionBoxH: Math.max(labelH + estimateTextBlockHeight(col.solution, innerW, fontPt) + boxPadding, 1.1),
    }));

  const fitsAt = (fontPt: number) =>
    boxHeightsAt(fontPt).every(({ challengeBoxH, solutionBoxH }) => challengeBoxH + boxGap + solutionBoxH <= budgetH);

  const fontSize = fitsAt(MIN_FONT) ? MIN_FONT : FALLBACK_FONT;

  // Last-resort proportional squeeze if even the smaller font doesn't fit.
  const heights = boxHeightsAt(fontSize).map(({ challengeBoxH, solutionBoxH }) => {
    const total = challengeBoxH + boxGap + solutionBoxH;
    if (total <= budgetH) return { challengeBoxH, solutionBoxH };
    const scale = budgetH / total;
    return { challengeBoxH: challengeBoxH * scale, solutionBoxH: solutionBoxH * scale };
  });

  columns.forEach((col, i) => {
    const x = 0.5 + i * (colW + 0.35);
    const { challengeBoxH, solutionBoxH } = heights[i];
    const solutionY = challengeY + challengeBoxH + boxGap;

    s.addText(col.theme, {
      x,
      y: themeY,
      w: colW,
      h: themeH,
      fontSize: 16,
      bold: true,
      color: BRAND.orange,
      fontFace: FONT,
    });

    s.addShape("roundRect", {
      x,
      y: challengeY,
      w: colW,
      h: challengeBoxH,
      fill: { color: BRAND.lightOrangeBg },
      line: { color: BRAND.orange, width: 0.75 },
      rectRadius: 0.08,
    });
    s.addText("CHALLENGE", {
      x: x + 0.2,
      y: challengeY + 0.08,
      w: innerW,
      h: labelH,
      fontSize,
      bold: true,
      color: BRAND.orange,
      fontFace: FONT,
    });
    s.addText(col.challenge, {
      x: x + 0.2,
      y: challengeY + 0.08 + labelH,
      w: innerW,
      h: Math.max(challengeBoxH - labelH - 0.16, 0.3),
      fontSize,
      color: BRAND.darkText,
      fontFace: FONT,
      valign: "top",
    });

    s.addShape("roundRect", {
      x,
      y: solutionY,
      w: colW,
      h: solutionBoxH,
      fill: { color: BRAND.lightBlueBg },
      line: { color: BRAND.blue, width: 0.75 },
      rectRadius: 0.08,
    });
    s.addText("SOLUTION", {
      x: x + 0.2,
      y: solutionY + 0.08,
      w: innerW,
      h: labelH,
      fontSize,
      bold: true,
      color: BRAND.blue,
      fontFace: FONT,
    });
    s.addText(col.solution, {
      x: x + 0.2,
      y: solutionY + 0.08 + labelH,
      w: innerW,
      h: Math.max(solutionBoxH - labelH - 0.16, 0.3),
      fontSize,
      color: BRAND.darkText,
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

  const months = content.months.slice(0, 3);
  const labelColW = 1.7;
  const monthColW = (SLIDE_W - 1 - labelColW) / 3;
  const pentagonY = 1.35;
  const pentagonH = 0.55;
  const pentagonGap = 0.08;
  const pentagonColors = [BRAND.blue, BRAND.blue, BRAND.orange];

  months.forEach((m, i) => {
    const x = 0.5 + labelColW + i * monthColW;
    // "homePlate" is PowerPoint's pentagon/arrow autoshape — a right-pointing
    // chevron used here to show each month flowing into the next.
    s.addShape("homePlate", {
      x,
      y: pentagonY,
      w: monthColW - pentagonGap,
      h: pentagonH,
      fill: { color: pentagonColors[i] },
      line: { type: "none" },
    });
    s.addText(m.title, {
      x: x + 0.1,
      y: pentagonY,
      w: monthColW - pentagonGap - 0.35,
      h: pentagonH,
      fontSize: MIN_FONT,
      bold: true,
      color: BRAND.textPrimary,
      valign: "middle",
      fontFace: FONT,
    });
  });

  const fields: [string, (m: ThreeMonthOutlookContent["months"][number]) => string][] = [
    ["Campaign Structure", (m) => m.campaignChanges],
    ["Creative Testing", (m) => m.creativeTesting],
    ["Channel Expansion", (m) => m.channelExpansion],
    ["KPI Targets", (m) => m.kpiTargets],
  ];

  const tableY = pentagonY + pentagonH + 0.15;
  const bodyRows = fields.map(([label, getValue]) => [label, ...months.map((m) => getValue(m))]);
  const { fontSize, colWidths } = resolveTableFit(bodyRows, [labelColW, monthColW, monthColW, monthColW], tableY);

  const rows: PptxGenJS.TableRow[] = fields.map(([label, getValue]) => [
    { text: label, options: { bold: true, color: BRAND.blue, fontSize } },
    ...months.map((m) => ({ text: getValue(m), options: { color: BRAND.textSecondary, fontSize } })),
  ]);

  s.addTable(rows, {
    x: 0.5,
    y: tableY,
    w: SLIDE_W - 1,
    colW: colWidths,
    fontFace: FONT,
    valign: "top",
    border: { type: "solid", color: BRAND.blue, pt: 0.5 },
    fill: { color: "10142A" },
    autoPage: false,
  });
}

/**
 * Lays out one stage panel's contents (name, budget, campaign tags,
 * targeting, creative types, CPA/ROAS). Pass `slide: null` to measure the
 * total height at a given font size without drawing anything, or a real
 * slide to draw — both share this exact same sequence so a measurement can
 * never drift from what's actually rendered (the bug that caused overlap:
 * the old code estimated tag height assuming one line, so anything below a
 * tag that actually wrapped to 2 lines got drawn on top of it).
 */
function layoutStagePanel(
  slide: PptxGenJS.Slide | null,
  st: CampaignArchitectureContent["stages"][number],
  x: number,
  y: number,
  innerW: number,
  fontPt: number
): number {
  const labelFont = fontPt - 1;
  let curY = y;

  if (slide) {
    slide.addText(st.stage, {
      x,
      y: curY,
      w: innerW,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: BRAND.orange,
      fontFace: FONT,
    });
  }
  curY += 0.42;

  if (slide) {
    slide.addText(`${st.budgetSplitPct}%`, {
      x,
      y: curY,
      w: innerW,
      h: 0.36,
      fontSize: 20,
      bold: true,
      color: BRAND.textPrimary,
      fontFace: FONT,
    });
    slide.addText("BUDGET SPLIT", {
      x,
      y: curY + 0.34,
      w: innerW,
      h: 0.22,
      fontSize: labelFont,
      color: BRAND.textSecondary,
      fontFace: FONT,
    });
  }
  curY += 0.68;

  if (slide) {
    slide.addText("CAMPAIGNS", {
      x,
      y: curY,
      w: innerW,
      h: 0.22,
      fontSize: labelFont,
      bold: true,
      color: BRAND.blue,
      fontFace: FONT,
    });
  }
  curY += 0.26;
  const tagsH = layoutTags(slide, st.campaignNames.slice(0, 2), x, curY, innerW, labelFont);
  curY += tagsH + 0.18;

  if (slide) {
    slide.addText("TARGETING", {
      x,
      y: curY,
      w: innerW,
      h: 0.2,
      fontSize: labelFont,
      bold: true,
      color: BRAND.blue,
      fontFace: FONT,
    });
  }
  curY += 0.24;
  const targetingH = estimateTextBlockHeight(st.targeting, innerW, fontPt) + 0.04;
  if (slide) {
    slide.addText(st.targeting, {
      x,
      y: curY,
      w: innerW,
      h: targetingH,
      fontSize: fontPt,
      color: BRAND.textSecondary,
      fontFace: FONT,
      valign: "top",
    });
  }
  curY += targetingH + 0.5 * ((fontPt * 1.3) / 72); // gap = 0.5 lines of body text

  if (slide) {
    slide.addText("CREATIVE TYPES", {
      x,
      y: curY,
      w: innerW,
      h: 0.2,
      fontSize: labelFont,
      bold: true,
      color: BRAND.blue,
      fontFace: FONT,
    });
  }
  curY += 0.24;
  const creativeH = estimateTextBlockHeight(st.creativeTypes, innerW, fontPt) + 0.1;
  if (slide) {
    slide.addText(st.creativeTypes, {
      x,
      y: curY,
      w: innerW,
      h: creativeH,
      fontSize: fontPt,
      color: BRAND.textSecondary,
      fontFace: FONT,
      valign: "top",
    });
  }
  curY += creativeH + 0.22;

  if (slide) {
    const halfW = (innerW - 0.15) / 2;
    slide.addText(shortStat(st.cpaTarget), {
      x,
      y: curY,
      w: halfW,
      h: 0.32,
      fontSize: 15,
      bold: true,
      color: BRAND.orange,
      align: "center",
      fontFace: FONT,
      wrap: false,
    });
    slide.addText("CPA TARGET", {
      x,
      y: curY + 0.3,
      w: halfW,
      h: 0.2,
      fontSize: labelFont,
      color: BRAND.textSecondary,
      align: "center",
      fontFace: FONT,
    });
    slide.addText(shortStat(st.roasTarget), {
      x: x + halfW + 0.15,
      y: curY,
      w: halfW,
      h: 0.32,
      fontSize: 15,
      bold: true,
      color: BRAND.blue,
      align: "center",
      fontFace: FONT,
      wrap: false,
    });
    slide.addText("ROAS TARGET", {
      x: x + halfW + 0.15,
      y: curY + 0.3,
      w: halfW,
      h: 0.2,
      fontSize: labelFont,
      color: BRAND.textSecondary,
      align: "center",
      fontFace: FONT,
    });
  }
  curY += 0.55;

  return curY - y;
}

function buildCampaignArchitecture(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);
  const content = slide.content as CampaignArchitectureContent;
  const stages = content.stages.slice(0, 3);

  const colW = (SLIDE_W - 1 - 0.35 * 2) / 3;
  const innerW = colW - 0.4;
  const panelY = 1.3;
  const panelH = 5.6;
  const availableH = panelH - 0.4;

  const tallestAt = (fontPt: number) =>
    Math.max(...stages.map((st) => layoutStagePanel(null, st, 0, 0, innerW, fontPt)));

  // Same overflow remedy used elsewhere: fall back to a 2pt-smaller font for
  // every panel (kept uniform across all 3 for a consistent look) if the
  // tallest stage's content wouldn't fit at the default size.
  const fontSize = tallestAt(MIN_FONT) <= availableH ? MIN_FONT : FALLBACK_FONT;

  stages.forEach((st, i) => {
    const x = 0.5 + i * (colW + 0.35);
    s.addShape("roundRect", {
      x,
      y: panelY,
      w: colW,
      h: panelH,
      fill: { color: BRAND.cardFill, transparency: 15 },
      line: { color: BRAND.blue, width: 1 },
      rectRadius: 0.08,
    });
    layoutStagePanel(s, st, x + 0.2, panelY + 0.2, innerW, fontSize);
  });
}

function buildCreativeTestingRoadmap(pptx: PptxGenJS, slide: GeneratedSlide) {
  const s = pptx.addSlide();
  addBrandChrome(s);
  addTitle(s, slide.title);
  const content = slide.content as CreativeRoadmapContent;

  const hooksText = (p: CreativeRoadmapContent["personas"][number]) =>
    p.hooks.map((h) => `• ${h}`).join("\n");

  const headers = ["Persona", "Hooks", "Angle", "Format", "Creator", "Target CPA / Thumbstop"];
  const bodyRows = content.personas.map((p) => [
    p.name,
    hooksText(p),
    p.angle,
    p.format,
    p.creator,
    `${p.targetCpa} / ${p.targetThumbstop}`,
  ]);
  const tableY = 1.4;
  const { fontSize, colWidths } = resolveTableFit(
    [headers, ...bodyRows],
    [1.6, 4.0, 1.7, 1.6, 1.6, 1.83],
    tableY
  );

  const headerRow: PptxGenJS.TableRow = headers.map((text) => ({
    text,
    options: { bold: true, color: BRAND.orange, fill: { color: BRAND.cardFill }, fontSize },
  }));

  const rows: PptxGenJS.TableRow[] = content.personas.map((p) => [
    { text: p.name, options: { bold: true, color: BRAND.blue, fontSize } },
    { text: hooksText(p), options: { color: BRAND.textSecondary, fontSize } },
    { text: p.angle, options: { color: BRAND.textSecondary, fontSize } },
    { text: p.format, options: { color: BRAND.textSecondary, fontSize } },
    { text: p.creator, options: { color: BRAND.textSecondary, fontSize } },
    { text: `${p.targetCpa} / ${p.targetThumbstop}`, options: { color: BRAND.textSecondary, fontSize } },
  ]);

  s.addTable([headerRow, ...rows], {
    x: 0.5,
    y: tableY,
    w: SLIDE_W - 1,
    colW: colWidths,
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
  const channels = content.channels.slice(0, 3);

  const leftColW = 3.0;
  const monthColW = (SLIDE_W - 1 - leftColW) / 3;
  const colX = [0.5, 0.5 + leftColW, 0.5 + leftColW + monthColW, 0.5 + leftColW + monthColW * 2];
  const headerY = 1.4;
  const rowGap = 0.18;
  const iconSize = 0.34;
  const detailsText = (ch: ChannelRoadmapContent["channels"][number]) =>
    `${ch.budgetRange} · ${ch.creativeFormats} · ${ch.targetingApproach} · ${ch.campaignType}`;

  ["Channel", "Month 1", "Month 2", "Month 3"].forEach((text, i) => {
    s.addText(text, {
      x: colX[i],
      y: headerY,
      w: i === 0 ? leftColW : monthColW,
      h: 0.3,
      fontSize: MIN_FONT,
      bold: true,
      color: BRAND.orange,
      fontFace: FONT,
    });
  });

  // Estimate row heights first so we know whether the default font fits;
  // fall back to a 2pt-smaller font if the content is too long for the slide.
  const computeRowHeights = (fontPt: number) =>
    channels.map((ch) => {
      const nameBlockH = 0.32 + estimateTextBlockHeight(detailsText(ch), leftColW - 0.5, fontPt);
      const monthHeights = [ch.month1, ch.month2, ch.month3].map((m) => {
        const badgeH = m.status === "active" || m.status === "launch" ? 0.28 : 0;
        return badgeH + estimateTextBlockHeight(m.actions, monthColW - 0.2, fontPt);
      });
      return Math.max(nameBlockH, ...monthHeights) + 0.2;
    });

  const availableH = SLIDE_H - (headerY + 0.4) - TABLE_BOTTOM_MARGIN;
  let fontSize = MIN_FONT;
  let rowHeights = computeRowHeights(fontSize);
  if (rowHeights.reduce((a, b) => a + b + rowGap, 0) > availableH) {
    fontSize = FALLBACK_FONT;
    rowHeights = computeRowHeights(fontSize);
  }

  let curY = headerY + 0.4;
  channels.forEach((ch, i) => {
    const rowH = rowHeights[i];

    s.addShape("roundRect", {
      x: 0.5,
      y: curY,
      w: SLIDE_W - 1,
      h: rowH,
      fill: { color: "10142A" },
      line: { color: BRAND.blue, width: 0.5 },
      rectRadius: 0.05,
    });

    addPlatformIcon(s, ch.name, colX[0] + 0.15, curY + 0.1, iconSize);
    s.addText(ch.name, {
      x: colX[0] + 0.15 + iconSize + 0.1,
      y: curY + 0.1,
      w: leftColW - iconSize - 0.4,
      h: iconSize,
      fontSize: MIN_FONT + 1,
      bold: true,
      color: BRAND.textPrimary,
      valign: "middle",
      fontFace: FONT,
    });
    s.addText(detailsText(ch), {
      x: colX[0] + 0.15,
      y: curY + 0.1 + iconSize + 0.06,
      w: leftColW - 0.4,
      h: rowH - iconSize - 0.3,
      fontSize,
      color: BRAND.textSecondary,
      valign: "top",
      fontFace: FONT,
    });

    [ch.month1, ch.month2, ch.month3].forEach((m, mi) => {
      const x = colX[mi + 1] + 0.1;
      const y = curY + 0.1;
      const badgeH = addStatusBadge(s, m.status, x, y, MIN_FONT);
      s.addText(m.actions, {
        x,
        y: y + badgeH + (badgeH > 0 ? 0.06 : 0),
        w: monthColW - 0.3,
        h: rowH - badgeH - 0.2,
        fontSize,
        color: BRAND.textSecondary,
        valign: "top",
        fontFace: FONT,
      });
    });

    curY += rowH + rowGap;
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
