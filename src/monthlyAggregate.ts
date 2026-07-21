import type { CampaignInsightRow } from "./types.js";

export interface MonthlyAggregate {
  month: string; // "2026-01"
  monthLabel: string; // "Jan 2026"
  monthShort: string; // "Jan" — used for tight chart x-axis labels
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  purchases: number;
  roas: number;
  cpa: number;
}

export interface KpiSummary {
  totalSpend: number;
  peakRoas: { value: number; month: string };
  currentRoas: number;
  cpmChangePct: number;
  cpaChangePct: number;
}

function toNumber(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function monthDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthLabel(monthKey: string): string {
  return monthDate(monthKey).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthShortLabel(monthKey: string): string {
  return monthDate(monthKey).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

// All numbers here are computed directly from the fetched Meta data — Claude
// never touches these, so the deck can never hallucinate a KPI.
export function aggregateByMonth(rows: CampaignInsightRow[]): MonthlyAggregate[] {
  const totals = new Map<
    string,
    { spend: number; impressions: number; reach: number; purchases: number; revenue: number }
  >();

  for (const row of rows) {
    if (!row.date_start) continue;
    const monthKey = row.date_start.slice(0, 7);
    const bucket = totals.get(monthKey) ?? {
      spend: 0,
      impressions: 0,
      reach: 0,
      purchases: 0,
      revenue: 0,
    };

    const spend = toNumber(row.spend);
    bucket.spend += spend;
    bucket.impressions += toNumber(row.impressions);
    bucket.reach += toNumber(row.reach);
    bucket.purchases += toNumber(row.purchases);
    bucket.revenue += spend * toNumber(row.purchase_roas); // revenue = spend * ROAS

    totals.set(monthKey, bucket);
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, t]) => ({
      month,
      monthLabel: monthLabel(month),
      monthShort: monthShortLabel(month),
      spend: t.spend,
      impressions: t.impressions,
      reach: t.reach,
      frequency: t.reach > 0 ? t.impressions / t.reach : 0,
      cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
      purchases: t.purchases,
      roas: t.spend > 0 ? t.revenue / t.spend : 0,
      cpa: t.purchases > 0 ? t.spend / t.purchases : 0,
    }));
}

export function computeKpiSummary(monthly: MonthlyAggregate[]): KpiSummary | null {
  if (monthly.length === 0) return null;

  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  const peak = monthly.reduce((best, m) => (m.roas > best.roas ? m : best), monthly[0]);

  return {
    totalSpend: monthly.reduce((sum, m) => sum + m.spend, 0),
    peakRoas: { value: peak.roas, month: peak.monthLabel },
    currentRoas: last.roas,
    cpmChangePct: first.cpm > 0 ? ((last.cpm - first.cpm) / first.cpm) * 100 : 0,
    cpaChangePct: first.cpa > 0 ? ((last.cpa - first.cpa) / first.cpa) * 100 : 0,
  };
}
