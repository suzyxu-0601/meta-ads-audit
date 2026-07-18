export interface AuditRequest {
  account: string; // "AquaTru" | "Liquid Plus" | raw numeric account id
  monthRangeStart: string; // e.g. "2026-01-01"
  monthRangeEnd: string; // e.g. "2026-06-30"
  currentPeriodStart: string; // e.g. "2026-05-12"
  currentPeriodEnd: string; // e.g. "2026-06-10"
  comparisonPeriodStart: string; // e.g. "2026-04-12"
  comparisonPeriodEnd: string; // e.g. "2026-05-11"
  spendThreshold: number; // e.g. 300
  primaryObjective: string;
  productFocus: string;
  challengeThemes: string;
  clientPainPoints: string;
  additionalContext: string;
}

export interface CampaignInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  cpm: string;
  purchases: string | null;
  purchase_roas: string | null;
  cost_per_purchase: string | null;
}

export interface AuditResponse {
  adAccountId: string;
  filters: {
    spendThreshold: number;
    monthRange: { since: string; until: string };
    currentPeriod: { since: string; until: string };
    comparisonPeriod: { since: string; until: string };
  };
  context: {
    primaryObjective: string;
    productFocus: string;
    challengeThemes: string;
    clientPainPoints: string;
    additionalContext: string;
  };
  monthlyTrend: CampaignInsightRow[];
  periodComparison: {
    current: CampaignInsightRow[];
    comparison: CampaignInsightRow[];
  };
}

export const KNOWN_ACCOUNTS: Record<string, string> = {
  AquaTru: "394785634609611",
  "Liquid Plus": "1479158920437014",
};

export function toAdAccountId(accountOrId: string): string {
  const rawId = KNOWN_ACCOUNTS[accountOrId] ?? accountOrId.trim();
  const digitsOnly = rawId.replace(/^act_/, "");
  return `act_${digitsOnly}`;
}
