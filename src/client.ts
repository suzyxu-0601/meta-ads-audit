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

$<HTMLFormElement>("auditForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const output = $<HTMLPreElement>("output");
  const status = $<HTMLDivElement>("status");
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
  output.textContent = "";

  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      status.textContent = `Error: ${data.error ?? res.statusText}`;
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }

    status.textContent = `Success — audited ${data.adAccountId}`;
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    status.textContent = `Request failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    submitBtn.disabled = false;
  }
});
