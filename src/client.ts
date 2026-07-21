import type {
  PublicGeneratedSlide,
  PerformanceOverviewContent,
  ChallengesSolutionsContent,
  ThreeMonthOutlookContent,
  CampaignArchitectureContent,
  CreativeRoadmapContent,
  ChannelRoadmapContent,
} from "./deckTypes.js";
import type { KpiSummary } from "./monthlyAggregate.js";

const PACIFIC_TIME_ZONE = "America/Los_Angeles";
const MS_PER_DAY = 86_400_000;

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

// Treats dates as pure calendar days (UTC midnight) so day-arithmetic can't
// be thrown off by DST transitions in the Pacific time zone.
function pacificTodayAsUtcDate(): Date {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeDefaultDates() {
  const today = pacificTodayAsUtcDate();
  const jan1 = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const currentPeriodEnd = today;
  const currentPeriodStart = addDays(today, -29); // 30-day window inclusive of both ends
  const comparisonPeriodEnd = addDays(currentPeriodStart, -1); // day right before current period
  const comparisonPeriodStart = addDays(comparisonPeriodEnd, -29); // 30-day window, no overlap/gap

  return {
    monthRangeStart: toDateInputValue(jan1),
    monthRangeEnd: toDateInputValue(today),
    currentPeriodStart: toDateInputValue(currentPeriodStart),
    currentPeriodEnd: toDateInputValue(currentPeriodEnd),
    comparisonPeriodStart: toDateInputValue(comparisonPeriodStart),
    comparisonPeriodEnd: toDateInputValue(comparisonPeriodEnd),
  };
}

function fillDefaultDates() {
  const defaults = computeDefaultDates();
  $<HTMLInputElement>("monthRangeStart").value = defaults.monthRangeStart;
  $<HTMLInputElement>("monthRangeEnd").value = defaults.monthRangeEnd;
  $<HTMLInputElement>("currentPeriodStart").value = defaults.currentPeriodStart;
  $<HTMLInputElement>("currentPeriodEnd").value = defaults.currentPeriodEnd;
  $<HTMLInputElement>("comparisonPeriodStart").value = defaults.comparisonPeriodStart;
  $<HTMLInputElement>("comparisonPeriodEnd").value = defaults.comparisonPeriodEnd;
}

$<HTMLInputElement>("fillDefaultDates").addEventListener("change", (e) => {
  if ((e.target as HTMLInputElement).checked) {
    fillDefaultDates();
  }
});

const EXAMPLE_CONTEXT = {
  primaryObjective: "Net new customer acquisition",
  productFocus: "Shower head",
  challengeThemes: "Audience structure, performance, creative testing",
  clientPainPoints: "Shower performance, audience overlap, no whitelisting",
  additionalContext: "Bundle opportunity, price parity issue with Amazon",
};

function fillExampleContext() {
  $<HTMLTextAreaElement>("primaryObjective").value = EXAMPLE_CONTEXT.primaryObjective;
  $<HTMLTextAreaElement>("productFocus").value = EXAMPLE_CONTEXT.productFocus;
  $<HTMLTextAreaElement>("challengeThemes").value = EXAMPLE_CONTEXT.challengeThemes;
  $<HTMLTextAreaElement>("clientPainPoints").value = EXAMPLE_CONTEXT.clientPainPoints;
  $<HTMLTextAreaElement>("additionalContext").value = EXAMPLE_CONTEXT.additionalContext;
}

$<HTMLInputElement>("fillExampleContext").addEventListener("change", (e) => {
  if ((e.target as HTMLInputElement).checked) {
    fillExampleContext();
  }
});

function currentAccountValue(): string {
  const mode = (document.querySelector('input[name="accountMode"]:checked') as HTMLInputElement)
    .value;
  if (mode === "dropdown") {
    return $<HTMLSelectElement>("accountSelect").value;
  }
  return $<HTMLInputElement>("accountIdInput").value.trim();
}

function toggleAccountInputs() {
  const mode = (document.querySelector('input[name="accountMode"]:checked') as HTMLInputElement)
    .value;
  $<HTMLDivElement>("dropdownRow").style.display = mode === "dropdown" ? "flex" : "none";
  $<HTMLDivElement>("accountIdRow").style.display = mode === "id" ? "flex" : "none";
}

document.querySelectorAll('input[name="accountMode"]').forEach((el) => {
  el.addEventListener("change", toggleAccountInputs);
});
toggleAccountInputs();

$<HTMLAnchorElement>("showMoreLink").addEventListener("click", (e) => {
  e.preventDefault();
  const output = $<HTMLPreElement>("output");
  const link = $<HTMLAnchorElement>("showMoreLink");
  const collapsed = output.hidden;
  output.hidden = !collapsed;
  link.textContent = collapsed ? "show less" : "show more";
});

$<HTMLFormElement>("auditForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const output = $<HTMLPreElement>("output");
  const status = $<HTMLDivElement>("status");
  const jsonStatus = $<HTMLDivElement>("jsonStatus");
  const submitBtn = $<HTMLButtonElement>("submitBtn");

  const account = currentAccountValue();
  if (!account) {
    status.textContent = "Please select or enter an account.";
    return;
  }

  const payload = {
    account,
    monthRangeStart: $<HTMLInputElement>("monthRangeStart").value,
    monthRangeEnd: $<HTMLInputElement>("monthRangeEnd").value,
    currentPeriodStart: $<HTMLInputElement>("currentPeriodStart").value,
    currentPeriodEnd: $<HTMLInputElement>("currentPeriodEnd").value,
    comparisonPeriodStart: $<HTMLInputElement>("comparisonPeriodStart").value,
    comparisonPeriodEnd: $<HTMLInputElement>("comparisonPeriodEnd").value,
    spendThreshold: Number($<HTMLInputElement>("spendThreshold").value || "0"),
    primaryObjective: $<HTMLTextAreaElement>("primaryObjective").value,
    productFocus: $<HTMLTextAreaElement>("productFocus").value,
    challengeThemes: $<HTMLTextAreaElement>("challengeThemes").value,
    clientPainPoints: $<HTMLTextAreaElement>("clientPainPoints").value,
    additionalContext: $<HTMLTextAreaElement>("additionalContext").value,
  };

  submitBtn.disabled = true;
  status.textContent = "Fetching insights from Meta Marketing API...";
  jsonStatus.hidden = true;
  output.hidden = true;
  output.textContent = "";
  $<HTMLAnchorElement>("showMoreLink").textContent = "show more";

  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      status.textContent = `Error: ${data.error ?? res.statusText}`;
      jsonStatus.hidden = true;
      output.hidden = false;
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }

    status.textContent = `Success — audited ${data.adAccountId}`;
    output.textContent = JSON.stringify(data, null, 2);
    jsonStatus.hidden = false;

    startDeckGeneration(data);
  } catch (err) {
    status.textContent = `Request failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Deck generation: kicks off a job after insights are fetched, streams
// progress/log/slide events over SSE, and renders an HTML mock preview.
// ---------------------------------------------------------------------------

let activeEventSource: EventSource | null = null;
let activeJobId: string | null = null;
let elapsedTimer: number | null = null;
let elapsedStart = 0;
let currentKpiSummary: KpiSummary | null = null;

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pctFmt(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

function roasX(n: number): string {
  return `${n.toFixed(2)}x`;
}

function kpiBox(label: string, value: string): string {
  return `<div class="kpi-box"><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-label">${escapeHtml(
    label
  )}</div></div>`;
}

function li(text: string): string {
  return `<li>${escapeHtml(text)}</li>`;
}

function renderSlideBody(slide: PublicGeneratedSlide): string {
  switch (slide.id) {
    case "performance-overview": {
      const content = slide.content as PerformanceOverviewContent;
      const kpiHtml = currentKpiSummary
        ? `<div class="kpi-strip">
            ${kpiBox("Total Spend", money(currentKpiSummary.totalSpend))}
            ${kpiBox("Peak ROAS", `${roasX(currentKpiSummary.peakRoas.value)} (${currentKpiSummary.peakRoas.month})`)}
            ${kpiBox("Current ROAS", roasX(currentKpiSummary.currentRoas))}
            ${kpiBox("CPM Change", pctFmt(currentKpiSummary.cpmChangePct))}
            ${kpiBox("CPA Change", pctFmt(currentKpiSummary.cpaChangePct))}
          </div>`
        : "";
      const chartsHtml = slide.chartDataUrls
        ? `<div class="chart-row">
            <img src="${slide.chartDataUrls.spend}" alt="Spend per month" />
            <img src="${slide.chartDataUrls.roasCpa}" alt="ROAS and CPA" />
            <img src="${slide.chartDataUrls.cpmFreq}" alt="CPM and frequency" />
          </div>`
        : "";
      return `${kpiHtml}${chartsHtml}<div class="bullet-row">
          <div class="bullet-col"><h4>Insights</h4><ul>${content.insights.map(li).join("")}</ul></div>
          <div class="bullet-col"><h4>Recommendations</h4><ul>${content.recommendations.map(li).join("")}</ul></div>
        </div>`;
    }
    case "challenges-solutions": {
      const content = slide.content as ChallengesSolutionsContent;
      return `<div class="column-row">${content.columns
        .map(
          (col) => `<div class="theme-card">
            <h4>${escapeHtml(col.theme)}</h4>
            <div class="field-label">CHALLENGE</div><p>${escapeHtml(col.challenge)}</p>
            <div class="field-label">SOLUTION</div><p>${escapeHtml(col.solution)}</p>
          </div>`
        )
        .join("")}</div>`;
    }
    case "three-month-outlook": {
      const content = slide.content as ThreeMonthOutlookContent;
      return `<div class="slide-subtitle">North star: ${escapeHtml(content.northStar)}</div>
        <table class="preview-table">
          <thead><tr><th>Month</th><th>Campaign Structure</th><th>Creative Testing</th><th>Channel Expansion</th><th>KPI Targets</th></tr></thead>
          <tbody>${content.months
            .map(
              (m) =>
                `<tr><td>${escapeHtml(m.title)}</td><td>${escapeHtml(m.campaignChanges)}</td><td>${escapeHtml(
                  m.creativeTesting
                )}</td><td>${escapeHtml(m.channelExpansion)}</td><td>${escapeHtml(m.kpiTargets)}</td></tr>`
            )
            .join("")}</tbody>
        </table>`;
    }
    case "campaign-architecture": {
      const content = slide.content as CampaignArchitectureContent;
      const fields: [string, (s: CampaignArchitectureContent["stages"][number]) => string][] = [
        ["Budget Split", (s) => `${s.budgetSplitPct}%`],
        ["Campaigns", (s) => s.campaignNames.join(", ")],
        ["Targeting", (s) => s.targeting],
        ["Creative Types", (s) => s.creativeTypes],
        ["CPA Target", (s) => s.cpaTarget],
        ["ROAS Target", (s) => s.roasTarget],
      ];
      return `<table class="preview-table">
        <thead><tr><th></th>${content.stages.map((s) => `<th>${escapeHtml(s.stage)}</th>`).join("")}</tr></thead>
        <tbody>${fields
          .map(
            ([label, getValue]) =>
              `<tr><td>${label}</td>${content.stages
                .map((s) => `<td>${escapeHtml(getValue(s))}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody>
      </table>`;
    }
    case "creative-testing-roadmap": {
      const content = slide.content as CreativeRoadmapContent;
      return `<table class="preview-table">
        <thead><tr><th>Persona</th><th>Hooks</th><th>Angle</th><th>Format</th><th>Creator</th><th>Target</th></tr></thead>
        <tbody>${content.personas
          .map(
            (p) =>
              `<tr><td>${escapeHtml(p.name)}</td><td>${p.hooks
                .map(escapeHtml)
                .join("<br>")}</td><td>${escapeHtml(p.angle)}</td><td>${escapeHtml(p.format)}</td><td>${escapeHtml(
                p.creator
              )}</td><td>${escapeHtml(p.targetCpa)} / ${escapeHtml(p.targetThumbstop)}</td></tr>`
          )
          .join("")}</tbody>
      </table>`;
    }
    case "channel-expansion-roadmap": {
      const content = slide.content as ChannelRoadmapContent;
      return `<table class="preview-table">
        <thead><tr><th>Channel</th><th>Month 1</th><th>Month 2</th><th>Month 3</th></tr></thead>
        <tbody>${content.channels
          .map(
            (ch) =>
              `<tr><td>${escapeHtml(ch.name)}<br><small>${escapeHtml(ch.budgetRange)} · ${escapeHtml(
                ch.campaignType
              )}</small></td><td>[${ch.month1.status.toUpperCase()}] ${escapeHtml(
                ch.month1.actions
              )}</td><td>[${ch.month2.status.toUpperCase()}] ${escapeHtml(
                ch.month2.actions
              )}</td><td>[${ch.month3.status.toUpperCase()}] ${escapeHtml(ch.month3.actions)}</td></tr>`
          )
          .join("")}</tbody>
      </table>`;
    }
    default:
      return "";
  }
}

function renderSlideCard(slide: PublicGeneratedSlide): string {
  return `<div class="slide-card" style="background-image:url('/assets/Arrangement-Dark-1.png')">
    <div class="slide-title">${escapeHtml(slide.title)}</div>
    ${renderSlideBody(slide)}
    <img class="slide-logo" src="/assets/GR0_Logo_white.png" alt="GR0" />
  </div>`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function startElapsedTimer() {
  elapsedStart = Date.now();
  const elapsedEl = $<HTMLSpanElement>("elapsedTime");
  elapsedEl.textContent = "0:00";
  elapsedTimer = window.setInterval(() => {
    elapsedEl.textContent = formatElapsed(Date.now() - elapsedStart);
  }, 1000);
}

function stopElapsedTimer() {
  if (elapsedTimer !== null) {
    window.clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

function resetDeckPane() {
  $<HTMLDivElement>("logPanel").textContent = "";
  $<HTMLDivElement>("logPanel").hidden = $<HTMLInputElement>("hideLogs").checked;
  $<HTMLDivElement>("slidePreview").innerHTML = "";
  $<HTMLDivElement>("progressFill").style.width = "0%";
  $<HTMLSpanElement>("progressPercent").textContent = "0%";
  $<HTMLDivElement>("progressLabel").textContent = "Starting…";
  $<HTMLButtonElement>("downloadBtn").disabled = true;
  $<HTMLButtonElement>("downloadBtn").onclick = null;
  currentKpiSummary = null;
}

$<HTMLInputElement>("hideLogs").addEventListener("change", (e) => {
  $<HTMLDivElement>("logPanel").hidden = (e.target as HTMLInputElement).checked;
});

function enterGeneratingMode() {
  resetDeckPane();
  $<HTMLDivElement>("workspace").classList.add("generating");
  $<HTMLDivElement>("deckPane").hidden = false;
  startElapsedTimer();
}

function exitGeneratingMode() {
  $<HTMLDivElement>("workspace").classList.remove("generating");
  $<HTMLDivElement>("deckPane").hidden = true;
  stopElapsedTimer();
  activeEventSource?.close();
  activeEventSource = null;
  activeJobId = null;
}

function appendLog(chunk: string) {
  const logPanel = $<HTMLDivElement>("logPanel");
  logPanel.textContent += chunk;
  logPanel.scrollTop = logPanel.scrollHeight;
}

async function startDeckGeneration(insights: unknown) {
  enterGeneratingMode();

  let jobId: string;
  try {
    const res = await fetch("/api/deck/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insights }),
    });
    const data = await res.json();
    if (!res.ok) {
      appendLog(`Error starting deck generation: ${data.error ?? res.statusText}\n`);
      return;
    }
    jobId = data.jobId;
  } catch (err) {
    appendLog(`Request failed: ${err instanceof Error ? err.message : String(err)}\n`);
    return;
  }

  activeJobId = jobId;
  const source = new EventSource(`/api/deck/stream/${jobId}`);
  activeEventSource = source;

  source.addEventListener("log", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    appendLog(data.chunk);
  });

  source.addEventListener("progress", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    const percent = Math.round((data.completed / data.total) * 100);
    $<HTMLDivElement>("progressFill").style.width = `${percent}%`;
    $<HTMLSpanElement>("progressPercent").textContent = `${percent}%`;
    $<HTMLDivElement>("progressLabel").textContent = data.label;
  });

  source.addEventListener("kpi", (e) => {
    currentKpiSummary = JSON.parse((e as MessageEvent).data);
  });

  source.addEventListener("slide", (e) => {
    const slide = JSON.parse((e as MessageEvent).data) as PublicGeneratedSlide;
    $<HTMLDivElement>("slidePreview").insertAdjacentHTML("beforeend", renderSlideCard(slide));
  });

  source.addEventListener("done", (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    stopElapsedTimer();
    const downloadBtn = $<HTMLButtonElement>("downloadBtn");
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
      window.location.href = data.downloadUrl;
    };
    source.close();
  });

  source.addEventListener("error", (e) => {
    const msgEvent = e as MessageEvent;
    if (msgEvent.data) {
      const data = JSON.parse(msgEvent.data);
      appendLog(`\nError: ${data.message}\n`);
    }
    stopElapsedTimer();
    source.close();
  });

  source.addEventListener("cancelled", () => {
    stopElapsedTimer();
    source.close();
  });
}

$<HTMLButtonElement>("discontinueBtn").addEventListener("click", async () => {
  if (activeJobId) {
    try {
      await fetch(`/api/deck/cancel/${activeJobId}`, { method: "POST" });
    } catch {
      // best-effort — the job will simply keep running server-side if this fails
    }
  }
  exitGeneratingMode();
});
