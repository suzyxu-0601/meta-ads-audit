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

interface AdAccountSummary {
  id: string;
  name: string;
}

function populateAccountOptions(accounts: AdAccountSummary[]) {
  if (!accounts.length) return;
  const select = $<HTMLSelectElement>("accountSelect");
  const previousValue = select.value;
  select.innerHTML = "";
  for (const account of accounts) {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.name;
    select.appendChild(option);
  }
  if (accounts.some((a) => a.id === previousValue)) {
    select.value = previousValue;
  }
}

async function loadAdAccounts(notifyOnError = false) {
  const btn = $<HTMLButtonElement>("refreshAccountsBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Refreshing…";
  try {
    const res = await fetch("/api/adaccounts");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `Request failed with status ${res.status}`);
    }
    populateAccountOptions(data.accounts ?? []);
  } catch (err) {
    console.error("[accounts] Failed to load ad accounts", err);
    if (notifyOnError) {
      alert(`Could not refresh accounts: ${err instanceof Error ? err.message : String(err)}`);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

$<HTMLButtonElement>("refreshAccountsBtn").addEventListener("click", () => loadAdAccounts(true));

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

    if (res.status === 401) {
      showLoginOverlay();
      status.textContent = "Your session expired — please sign in again.";
      return;
    }

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

function formatDateClient(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateRangeClient(period: { since: string; until: string }): string {
  return `${formatDateClient(period.since)} – ${formatDateClient(period.until)}`;
}

function kpiBox(label: string, value: string): string {
  return `<div class="kpi-box"><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-label">${escapeHtml(
    label
  )}</div></div>`;
}

function li(text: string): string {
  return `<li>${escapeHtml(text)}</li>`;
}

// Mirrors the server-side safety net in deckBuilder.ts: Claude is asked for a
// bare number but this trims any justification clause it adds anyway.
function shortStat(value: string, maxLen = 14): string {
  const trimmed = value.trim();
  const cutIdx = trimmed.search(/[;,(]| - | at | as | to /i);
  const short = cutIdx > 0 ? trimmed.slice(0, cutIdx).trim() : trimmed;
  return short.length > maxLen ? `${short.slice(0, maxLen - 1)}…` : short;
}

// Same reasoning as the server-side deckBuilder: no legitimate source for
// official third-party platform logos, and the channels vary per run, so
// this is a monogram circle rather than a real brand mark — kept a single
// consistent blue rather than per-platform colors.
function platformIconHtml(name: string): string {
  return `<span class="platform-icon" style="background:#0163C3;color:#ffffff">${escapeHtml(
    name.trim().charAt(0).toUpperCase()
  )}</span>`;
}

function statusBadgeHtml(status: string): string {
  if (status !== "active" && status !== "launch") return "";
  return `<span class="status-badge status-${status}">${status.toUpperCase()}</span>`;
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
          (col) => `<div class="theme-col">
            <h4>${escapeHtml(col.theme)}</h4>
            <div class="theme-box theme-box-challenge">
              <div class="field-label field-label-orange">CHALLENGE</div>
              <p>${escapeHtml(col.challenge)}</p>
            </div>
            <div class="theme-box theme-box-solution">
              <div class="field-label field-label-blue">SOLUTION</div>
              <p>${escapeHtml(col.solution)}</p>
            </div>
          </div>`
        )
        .join("")}</div>`;
    }
    case "three-month-outlook": {
      const content = slide.content as ThreeMonthOutlookContent;
      const months = content.months.slice(0, 3);
      const chevronClass = (i: number) => (i === 2 ? "chevron-orange" : "chevron-blue");
      const fields: [string, (m: ThreeMonthOutlookContent["months"][number]) => string][] = [
        ["Campaign Structure", (m) => m.campaignChanges],
        ["Creative Testing", (m) => m.creativeTesting],
        ["Channel Expansion", (m) => m.channelExpansion],
        ["KPI Targets", (m) => m.kpiTargets],
      ];
      return `<div class="slide-subtitle">North star: ${escapeHtml(content.northStar)}</div>
        <div class="chevron-row">${months
          .map((m, i) => `<div class="chevron ${chevronClass(i)}"><span>${escapeHtml(m.title)}</span></div>`)
          .join("")}</div>
        <div class="month-columns">${months
          .map(
            (m) => `<div class="month-col">${fields
              .map(
                ([label, getValue]) =>
                  `<div class="month-field"><span class="field-label field-label-blue">${label}</span><p>${escapeHtml(
                    getValue(m)
                  )}</p></div>`
              )
              .join("")}</div>`
          )
          .join("")}</div>`;
    }
    case "campaign-architecture": {
      const content = slide.content as CampaignArchitectureContent;
      return `<div class="arch-columns">${content.stages
        .slice(0, 3)
        .map(
          (st) => `<div class="arch-col">
            <h4>${escapeHtml(st.stage)}</h4>
            <div class="arch-stat">${st.budgetSplitPct}%</div>
            <div class="arch-stat-label">BUDGET SPLIT</div>
            <div class="field-label field-label-blue">CAMPAIGNS</div>
            <div class="tag-row">${st.campaignNames.slice(0, 2).map((n) => `<span class="tag-chip">${escapeHtml(n)}</span>`).join("")}</div>
            <div class="field-label field-label-blue">TARGETING</div>
            <p>${escapeHtml(st.targeting)}</p>
            <div class="field-label field-label-blue">CREATIVE TYPES</div>
            <p>${escapeHtml(st.creativeTypes)}</p>
            <div class="cpa-roas-row">
              <div><div class="stat-value stat-orange">${escapeHtml(shortStat(st.cpaTarget))}</div><div class="stat-label">CPA TARGET</div></div>
              <div><div class="stat-value stat-blue">${escapeHtml(shortStat(st.roasTarget))}</div><div class="stat-label">ROAS TARGET</div></div>
            </div>
          </div>`
        )
        .join("")}</div>`;
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
      const monthCell = (m: ChannelRoadmapContent["channels"][number]["month1"]) =>
        `${statusBadgeHtml(m.status)}<div>${escapeHtml(m.actions)}</div>`;
      return `<table class="preview-table channel-table">
        <thead><tr><th>Channel</th><th>Month 1</th><th>Month 2</th><th>Month 3</th></tr></thead>
        <tbody>${content.channels
          .slice(0, 3)
          .map(
            (ch) =>
              `<tr><td>${platformIconHtml(ch.name)}<span class="channel-name">${escapeHtml(
                ch.name
              )}</span><br><span class="channel-detail">${escapeHtml(ch.budgetRange)} · ${escapeHtml(
                ch.creativeFormats
              )} · ${escapeHtml(ch.targetingApproach)} · ${escapeHtml(
                ch.campaignType
              )}</span></td><td>${monthCell(ch.month1)}</td><td>${monthCell(
                ch.month2
              )}</td><td>${monthCell(ch.month3)}</td></tr>`
          )
          .join("")}</tbody>
      </table>`;
    }
    default:
      return "";
  }
}

function renderSlideCard(slide: PublicGeneratedSlide): string {
  const periodHtml =
    slide.id === "performance-overview" && slide.auditPeriod
      ? `<span class="slide-period">${escapeHtml(formatDateRangeClient(slide.auditPeriod))}</span>`
      : "";
  return `<div class="slide-card" style="background-image:url('/assets/Arrangement-Dark-1.png')">
    <div class="slide-title-row">
      <div class="slide-title">${escapeHtml(slide.title)}</div>
      ${periodHtml}
    </div>
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
    if (res.status === 401) {
      exitGeneratingMode();
      showLoginOverlay();
      return;
    }
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

// ---------------------------------------------------------------------------
// Auth: Google sign-in restricted to @gr0.com, session persisted via an
// httpOnly cookie (24h expiry, enforced server-side).
// ---------------------------------------------------------------------------

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

function showLoginError(message: string) {
  const errorEl = $<HTMLDivElement>("loginError");
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function showLoginOverlay() {
  $<HTMLDivElement>("userTile").hidden = true;
  // .login-overlay sets display:flex in CSS, which always beats the browser's
  // default [hidden]{display:none} rule (normal author styles win over normal
  // user-agent styles regardless of specificity) — so toggling .hidden alone
  // never actually hides it. Use an inline style instead, which outranks both.
  $<HTMLDivElement>("loginOverlay").style.removeProperty("display");
}

function hideLoginOverlay() {
  $<HTMLDivElement>("loginOverlay").style.display = "none";
}

function showUserTile(user: AuthUser) {
  $<HTMLImageElement>("userAvatar").src = user.picture;
  $<HTMLSpanElement>("userName").textContent = user.name;
  $<HTMLDivElement>("userEmail").textContent = user.email;
  $<HTMLDivElement>("userTile").hidden = false;
}

async function handleCredentialResponse(response: { credential: string }) {
  console.log("[auth] Google callback fired, exchanging credential with server...");
  $<HTMLDivElement>("loginError").hidden = true;
  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json();
    console.log("[auth] /api/auth/google responded", res.status, data);
    if (!res.ok) {
      showLoginError(data.error ?? "Sign-in failed.");
      return;
    }
    showUserTile(data);
    hideLoginOverlay();
    loadAdAccounts();
  } catch (err) {
    console.error("[auth] /api/auth/google request failed", err);
    showLoginError(err instanceof Error ? err.message : String(err));
  }
}

async function initAuth() {
  console.log("[auth] initAuth starting");
  try {
    const meRes = await fetch("/api/auth/me");
    console.log("[auth] /api/auth/me responded", meRes.status);
    if (meRes.ok) {
      showUserTile(await meRes.json());
      hideLoginOverlay();
      loadAdAccounts();
      return;
    }
  } catch (err) {
    console.error("[auth] /api/auth/me request failed", err);
    // fall through to rendering the sign-in button
  }

  try {
    const configRes = await fetch("/api/auth/config");
    const config = await configRes.json();
    if (!config.googleClientId) {
      showLoginError("Google sign-in isn't configured yet (missing GOOGLE_CLIENT_ID in .env).");
      return;
    }

    await loadGoogleScript();
    console.log("[auth] Google Identity Services script loaded");
    const google = (window as any).google;
    google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: handleCredentialResponse,
      hosted_domain: "gr0.com",
      ux_mode: "popup",
      error_callback: (err: unknown) => {
        console.error("[auth] Google Identity Services error_callback", err);
        showLoginError("Google sign-in reported an error — check the browser console for details.");
      },
    });
    google.accounts.id.renderButton(document.getElementById("googleSignInButton"), {
      theme: "outline",
      size: "large",
      width: 300,
    });
    console.log("[auth] Sign-in button rendered");
  } catch (err) {
    console.error("[auth] Failed to initialize Google Sign-In", err);
    showLoginError(err instanceof Error ? err.message : String(err));
  }
}

$<HTMLDivElement>("userTile").addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = $<HTMLDivElement>("userMenu");
  menu.hidden = !menu.hidden;
});

document.addEventListener("click", () => {
  $<HTMLDivElement>("userMenu").hidden = true;
});

$<HTMLButtonElement>("logoutBtn").addEventListener("click", async (e) => {
  e.stopPropagation();
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
});

initAuth();
