import type { AuditRequest, AuditResponse, CampaignInsightRow } from "./types.js";
import { toAdAccountId } from "./types.js";

const GRAPH_API_VERSION = "v25.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Meta reports the same purchase event under several attribution paths
// (omni_purchase, purchase, web_in_store_purchase, etc). We only need one
// canonical count, so we prefer omni_purchase (the same key purchase_roas uses)
// and fall back to purchase if omni_purchase isn't present.
const PURCHASE_ACTION_TYPES = ["omni_purchase", "purchase"];

const CAMPAIGN_INSIGHTS_FIELDS = [
  "campaign_id",
  "campaign_name",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "cpm",
  "actions",
  "purchase_roas",
  "cost_per_action_type",
].join(",");

interface ActionEntry {
  action_type: string;
  value: string;
}

function pickPurchaseValue(entries: ActionEntry[] | undefined): string | null {
  if (!entries) return null;
  for (const type of PURCHASE_ACTION_TYPES) {
    const match = entries.find((e) => e.action_type === type);
    if (match) return match.value;
  }
  return null;
}

function simplifyCampaignRow(row: any): CampaignInsightRow {
  return {
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    frequency: row.frequency,
    cpm: row.cpm,
    purchases: pickPurchaseValue(row.actions),
    purchase_roas: pickPurchaseValue(row.purchase_roas),
    cost_per_purchase: pickPurchaseValue(row.cost_per_action_type),
  };
}

interface DateRange {
  since: string;
  until: string;
}

function buildInsightsUrl(
  adAccountId: string,
  token: string,
  range: DateRange,
  opts: { spendThreshold?: number; timeIncrement?: "monthly" } = {}
): string {
  const params = new URLSearchParams({
    access_token: token,
    level: "campaign",
    fields: CAMPAIGN_INSIGHTS_FIELDS,
    time_range: JSON.stringify(range),
    limit: "500",
  });

  if (opts.timeIncrement) {
    params.set("time_increment", opts.timeIncrement);
  }

  if (opts.spendThreshold && opts.spendThreshold > 0) {
    params.set(
      "filtering",
      JSON.stringify([
        { field: "spend", operator: "GREATER_THAN", value: opts.spendThreshold },
      ])
    );
  }

  return `${GRAPH_API_BASE}/${adAccountId}/insights?${params.toString()}`;
}

async function fetchInsights(url: string): Promise<CampaignInsightRow[]> {
  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok) {
    const message =
      (body as any)?.error?.message ?? `Facebook API request failed with status ${res.status}`;
    throw new Error(message);
  }

  const rows: any[] = (body as any).data ?? [];
  return rows.map(simplifyCampaignRow);
}

export async function runCampaignAudit(
  req: AuditRequest,
  token: string
): Promise<AuditResponse> {
  const adAccountId = toAdAccountId(req.account);

  const monthlyTrendUrl = buildInsightsUrl(
    adAccountId,
    token,
    { since: req.monthRangeStart, until: req.monthRangeEnd },
    { spendThreshold: req.spendThreshold, timeIncrement: "monthly" }
  );

  const currentPeriodUrl = buildInsightsUrl(
    adAccountId,
    token,
    { since: req.currentPeriodStart, until: req.currentPeriodEnd },
    { spendThreshold: req.spendThreshold }
  );

  const comparisonPeriodUrl = buildInsightsUrl(
    adAccountId,
    token,
    { since: req.comparisonPeriodStart, until: req.comparisonPeriodEnd },
    { spendThreshold: req.spendThreshold }
  );

  const [monthlyTrend, current, comparison] = await Promise.all([
    fetchInsights(monthlyTrendUrl),
    fetchInsights(currentPeriodUrl),
    fetchInsights(comparisonPeriodUrl),
  ]);

  return {
    adAccountId,
    filters: {
      spendThreshold: req.spendThreshold,
      monthRange: { since: req.monthRangeStart, until: req.monthRangeEnd },
      currentPeriod: { since: req.currentPeriodStart, until: req.currentPeriodEnd },
      comparisonPeriod: { since: req.comparisonPeriodStart, until: req.comparisonPeriodEnd },
    },
    context: {
      primaryObjective: req.primaryObjective,
      productFocus: req.productFocus,
      challengeThemes: req.challengeThemes,
      clientPainPoints: req.clientPainPoints,
      additionalContext: req.additionalContext,
    },
    monthlyTrend,
    periodComparison: { current, comparison },
  };
}
