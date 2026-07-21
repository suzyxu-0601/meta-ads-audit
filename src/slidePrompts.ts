import type { AuditResponse, CampaignInsightRow } from "./types.js";
import type { KpiSummary, MonthlyAggregate } from "./monthlyAggregate.js";
import type { SlideDefinition, SlideId } from "./deckTypes.js";

export const SYSTEM_PROMPT = `You are writing content for a GR0 Meta Ads performance audit slide deck.

Use the client's stated primary objective, product focus, challenge themes, client pain points, and
additional context as guidance when relevant to the slide you are writing. Ground every specific
number, campaign name, month, or date in the account data provided in the user message — never invent
a metric that isn't in that data. Reference actual numbers and campaign types; avoid generic agency
language.

Respond with brief analysis in plain text first, then end your response with exactly one fenced code
block labeled json containing the structured content for this slide, matching the shape described in
the user message. Do not write anything after the closing code fence.`;

export const SLIDE_DEFINITIONS: SlideDefinition[] = [
  {
    id: "performance-overview",
    title: "Performance Overview",
    instructions: `Generate the analysis for a performance overview slide covering the monthly trend data below.
- 3 insight bullets grounded in the data trends (reference actual months and numbers)
- 3 recommendation bullets that directly address those trends
Do not restate the KPI numbers verbatim as a bullet — each bullet should be an interpretation or a call to action.`,
    responseSchema: `{
  "insights": ["...", "...", "..."],
  "recommendations": ["...", "...", "..."]
}`,
  },
  {
    id: "challenges-solutions",
    title: "Challenges & Solutions",
    instructions: `Write content for a GR0 Challenges & Solutions slide with three columns, one per challenge theme.
For each column write:
- theme: a short 2-4 word header for the challenge (use the client's stated challenge themes as a guide)
- challenge: 2-3 sentences grounded in specific account data (spend, ROAS, CPM, campaign names, dates). No generic agency language.
- solution: 2-3 sentences that are specific and actionable, naming the campaigns, formats, or audiences involved. Solutions should preview what GR0 does in the first 30-60 days.`,
    responseSchema: `{
  "columns": [
    { "theme": "...", "challenge": "...", "solution": "..." },
    { "theme": "...", "challenge": "...", "solution": "..." },
    { "theme": "...", "challenge": "...", "solution": "..." }
  ]
}`,
  },
  {
    id: "three-month-outlook",
    title: "3-Month Outlook",
    instructions: `Build a 3-month paid social outlook. The north star objective is the client's stated primary objective.
Structure the 3 months as:
- Month 1: Audit, Structure & Foundation
- Month 2: Creative Testing & Channel Expansion
- Month 3: Scale & New Channel Launch (propose two new channels appropriate for this account if none were specified in the client context)
For each month include: campaign structure changes specific to this account, creative testing priorities based on what the data showed, channel expansion steps and rationale, and KPI targets anchored to the account's own best-performing month from the data below — not industry benchmarks.`,
    responseSchema: `{
  "northStar": "...",
  "months": [
    { "title": "Month 1: Audit, Structure & Foundation", "campaignChanges": "...", "creativeTesting": "...", "channelExpansion": "...", "kpiTargets": "..." },
    { "title": "Month 2: Creative Testing & Channel Expansion", "campaignChanges": "...", "creativeTesting": "...", "channelExpansion": "...", "kpiTargets": "..." },
    { "title": "Month 3: Scale & New Channel Launch", "campaignChanges": "...", "creativeTesting": "...", "channelExpansion": "...", "kpiTargets": "..." }
  ]
}`,
  },
  {
    id: "campaign-architecture",
    title: "Proposed Campaign Architecture",
    instructions: `Propose a three-stage campaign architecture: Prospecting, Retargeting, Retention.
For each stage give: budget split percentage (all three must sum to 100), specific campaign names to use,
targeting inclusions/exclusions, creative types, and KPI targets (CPA and ROAS) grounded in the account's
own best-performing campaigns from the data below.`,
    responseSchema: `{
  "stages": [
    { "stage": "Prospecting", "budgetSplitPct": 0, "campaignNames": ["..."], "targeting": "...", "creativeTypes": "...", "cpaTarget": "...", "roasTarget": "..." },
    { "stage": "Retargeting", "budgetSplitPct": 0, "campaignNames": ["..."], "targeting": "...", "creativeTypes": "...", "cpaTarget": "...", "roasTarget": "..." },
    { "stage": "Retention", "budgetSplitPct": 0, "campaignNames": ["..."], "targeting": "...", "creativeTypes": "...", "cpaTarget": "...", "roasTarget": "..." }
  ]
}`,
  },
  {
    id: "creative-testing-roadmap",
    title: "Creative Testing Roadmap",
    instructions: `Build a persona x hook x angle x format creative testing matrix for the client's stated product focus.
Propose exactly 3 personas. For each persona give: 3 hook variants written as actual hook copy (not
placeholders), an angle, a format, a creator assignment, and a target CPA/thumbstop rate grounded in the
account's current CPA benchmarks from the data below.`,
    responseSchema: `{
  "personas": [
    { "name": "...", "hooks": ["...", "...", "..."], "angle": "...", "format": "...", "creator": "...", "targetCpa": "...", "targetThumbstop": "..." },
    { "name": "...", "hooks": ["...", "...", "..."], "angle": "...", "format": "...", "creator": "...", "targetCpa": "...", "targetThumbstop": "..." },
    { "name": "...", "hooks": ["...", "...", "..."], "angle": "...", "format": "...", "creator": "...", "targetCpa": "...", "targetThumbstop": "..." }
  ]
}`,
  },
  {
    id: "channel-expansion-roadmap",
    title: "Channel Expansion Roadmap",
    instructions: `Build a channel expansion timeline across Meta plus two new channels (use channels mentioned in the
client's additional context if any are named there, otherwise propose two appropriate for this account).
For each channel give Month 1/2/3 actions and a status per month (active, planning, or launch), a budget
test range, creative formats, targeting approach, and campaign type.`,
    responseSchema: `{
  "channels": [
    { "name": "Meta", "month1": { "status": "active", "actions": "..." }, "month2": { "status": "active", "actions": "..." }, "month3": { "status": "active", "actions": "..." }, "budgetRange": "...", "creativeFormats": "...", "targetingApproach": "...", "campaignType": "..." },
    { "name": "...", "month1": { "status": "planning", "actions": "..." }, "month2": { "status": "launch", "actions": "..." }, "month3": { "status": "active", "actions": "..." }, "budgetRange": "...", "creativeFormats": "...", "targetingApproach": "...", "campaignType": "..." },
    { "name": "...", "month1": { "status": "planning", "actions": "..." }, "month2": { "status": "planning", "actions": "..." }, "month3": { "status": "launch", "actions": "..." }, "budgetRange": "...", "creativeFormats": "...", "targetingApproach": "...", "campaignType": "..." }
  ]
}`,
  },
];

interface ClientContext {
  primaryObjective: string;
  productFocus: string;
  challengeThemes: string;
  clientPainPoints: string;
  additionalContext: string;
}

function topCampaignsBySpend(rows: CampaignInsightRow[], limit: number): CampaignInsightRow[] {
  return [...rows]
    .sort((a, b) => Number(b.spend) - Number(a.spend))
    .slice(0, limit);
}

export function buildUserPrompt(
  slideId: SlideId,
  audit: AuditResponse,
  monthly: MonthlyAggregate[],
  kpiSummary: KpiSummary | null
): string {
  const slideDef = SLIDE_DEFINITIONS.find((s) => s.id === slideId);
  if (!slideDef) throw new Error(`Unknown slide id: ${slideId}`);

  const context: ClientContext = audit.context;
  let accountData: unknown;

  switch (slideId) {
    case "performance-overview":
      accountData = { monthly, kpiSummary };
      break;
    case "challenges-solutions":
      accountData = {
        currentPeriodCampaigns: audit.periodComparison.current,
        comparisonPeriodCampaigns: audit.periodComparison.comparison,
      };
      break;
    case "three-month-outlook":
    case "campaign-architecture":
      accountData = {
        kpiSummary,
        topCampaigns: topCampaignsBySpend(audit.periodComparison.current, 6),
      };
      break;
    case "creative-testing-roadmap":
    case "channel-expansion-roadmap":
      accountData = { kpiSummary };
      break;
  }

  return `${slideDef.instructions}

Account data (JSON):
${JSON.stringify(accountData, null, 2)}

Client context:
${JSON.stringify(context, null, 2)}

Respond with your analysis, then a \`\`\`json code block matching exactly this shape:
${slideDef.responseSchema}`;
}
