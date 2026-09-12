// Client-side renderer for the hosted /auth/settings/ai page: fetches the
// composite GET /api/usage/ai payload and fills the skeleton's data hooks.
// All user-derived strings (chat titles) go through textContent via el(),
// never innerHTML — the page mirrors user content as-is.
// Vite serves this module during development and emits its hashed production asset.
import { aiUsagePage as styles } from './styles';

type UsageStatus = {
  limitUsd: number;
  periodStart: string;
  totalCostUsd: number;
};

type Summary = {
  requestCount: number;
  usageAvailableCount: number;
  failedCount: number;
  failedCostUsd: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type BreakdownRow = {
  totalCostUsd: number;
  totalTokens: number;
  requestCount: number;
  [key: string]: string | null | number;
};

type TrendPoint = { bucketStart: string; totalCostUsd: number; requestCount: number };

type UsagePagePayload = {
  monthly: UsageStatus;
  summary: Summary;
  byFeature: BreakdownRow[];
  byModel: BreakdownRow[];
  byOperation: BreakdownRow[];
  daily: TrendPoint[];
  monthlyTrend: TrendPoint[];
};

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// Buckets come back in UTC (date_trunc AT TIME ZONE 'UTC'); formatting must
// stay in UTC too or the first day of every bucket renders as the previous
// month in negative-offset timezones.
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const FEATURE_LABELS: Record<string, string> = {
  chat_stream: 'Chat',
  text_enhance: 'Enhance',
  note_generate: 'Notes',
  task_extract: 'Tasks',
  voice_task_extract: 'Voice tasks',
  time_block_extract: 'Schedule',
  voice_cleanup: 'Voice cleanup',
  chat_speech: 'Voice',
  embedding: 'Embeddings',
  mcp_tool_call: 'MCP tools',
  career_resume_convert: 'Resume',
  career_resume_customize: 'Resume edits',
  career_job_scrape: 'Job search',
  career_skills_derive: 'Skills',
  file_image_analyze: 'Image analysis',
  file_document_summarize: 'Document summaries',
};

const OPERATION_LABELS: Record<string, string> = {
  chat_completion: 'Chat completion',
  structured_output: 'Structured output',
  embedding: 'Embeddings',
  speech: 'Speech',
};

function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

// Request-based estimates keep the page honest: this is an orientation signal,
// not a utility meter or a provider-reported environmental measurement.
const ESTIMATED_WATER_LITERS_PER_REQUEST = 0.01;
const ESTIMATED_ELECTRICITY_KWH_PER_REQUEST = 0.00034;

function formatLiters(liters: number): string {
  if (liters < 1) return `${Math.round(liters * 1_000)} mL`;
  return `${liters.toFixed(1)} L`;
}

function formatElectricity(kilowattHours: number): string {
  if (kilowattHours < 1) return `${Math.round(kilowattHours * 1_000)} Wh`;
  return `${kilowattHours.toFixed(2)} kWh`;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function find<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function clear(node: HTMLElement): void {
  node.replaceChildren();
}

const usd = (amount: number): string => formatUsd(amount);

function renderStatus(data: UsagePagePayload): void {
  const period = find('[data-uai-period]');
  const total = find('[data-uai-total]');
  const limit = find('[data-uai-limit]');
  const bar = find('[data-uai-bar]');
  const pacing = find('[data-uai-pacing]');
  const reset = find('[data-uai-reset]');
  if (!period || !total || !limit || !bar || !pacing || !reset) return;

  const { monthly, summary, daily } = data;
  const start = new Date(monthly.periodStart);
  period.textContent = `${monthLabel.format(start)} ${start.getUTCFullYear()}`;
  total.textContent = usd(monthly.totalCostUsd);
  limit.textContent = `of ${usd(monthly.limitUsd)}`;
  const percent = Math.min(100, (monthly.totalCostUsd / monthly.limitUsd) * 100);
  bar.style.width = `${percent}%`;
  bar.dataset.over = monthly.totalCostUsd >= monthly.limitUsd ? '' : undefined;

  // Pacing: linear projection from the day-of-month elapsed so far.
  const now = new Date();
  const elapsedDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
  const monthDays = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const projected = (monthly.totalCostUsd / elapsedDays) * monthDays;
  const dailyAverage = daily.length > 0 ? monthly.totalCostUsd / elapsedDays : 0;
  const dayOfCap = dailyAverage > 0 ? Math.floor(monthly.limitUsd / dailyAverage) : null;

  if (monthly.totalCostUsd >= monthly.limitUsd) {
    pacing.textContent =
      "You've reached this month's AI budget — AI features are paused until it resets.";
    pacing.dataset.over = '';
  } else if (dayOfCap !== null && dayOfCap <= monthDays) {
    pacing.textContent =
      dayOfCap <= elapsedDays
        ? `At this pace you'll pass the budget around today (projected ${usd(projected)}).`
        : `At this pace, ${usd(projected)} total — the budget runs out around day ${dayOfCap} of ${monthDays}.`;
    pacing.dataset.over = projected >= monthly.limitUsd ? '' : undefined;
  } else {
    pacing.textContent = `At this pace you'd use about ${usd(projected)} — under the ${usd(monthly.limitUsd)} budget.`;
    delete pacing.dataset.over;
  }

  const daysUntilReset = Math.ceil(
    (new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).getTime() -
      now.getTime()) /
      86_400_000,
  );
  reset.textContent =
    daysUntilReset === 1
      ? `Budget resets tomorrow. ${summary.requestCount} requests so far.`
      : `Budget resets in ${daysUntilReset} days. ${summary.requestCount} requests so far.`;
}

function renderDaily(daily: TrendPoint[]): void {
  const container = find('[data-uai-daily]');
  if (!container) return;
  clear(container);
  const max = Math.max(0, ...daily.map((point) => point.totalCostUsd));
  if (daily.length === 0) return;
  for (const point of daily) {
    const bar = document.createElement('div');
    bar.className = styles.sparkBar;
    const height = max > 0 ? Math.max(4, (point.totalCostUsd / max) * 100) : 4;
    bar.style.height = `${height.toFixed(1)}%`;
    if (point.totalCostUsd === 0) bar.dataset.zero = '';
    bar.title = `${dayLabel.format(new Date(point.bucketStart))}: ${usd(point.totalCostUsd)}`;
    container.append(bar);
  }
}

function renderDrivers(data: UsagePagePayload, dimension: string): void {
  const list = find('[data-uai-drivers]');
  const seg = find('[data-uai-seg]');
  if (!list || !seg) return;
  seg.querySelectorAll<HTMLButtonElement>('[data-uai-dim]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.uaiDim === dimension));
  });

  const rows: BreakdownRow[] =
    dimension === 'feature'
      ? data.byFeature
      : dimension === 'model'
        ? data.byModel
        : dimension === 'operation'
          ? data.byOperation
          : data.daily.map((point) => ({
              day: dayLabel.format(new Date(point.bucketStart)),
              totalCostUsd: point.totalCostUsd,
              totalTokens: 0,
              requestCount: point.requestCount,
            }));

  const total = rows.reduce((sum, row) => sum + row.totalCostUsd, 0);
  clear(list);
  if (rows.length === 0) {
    list.append(el('p', styles.muted, 'No usage recorded this month yet.'));
    return;
  }

  const nameOf = (row: BreakdownRow): string => {
    if (dimension === 'feature') return FEATURE_LABELS[String(row.feature)] ?? String(row.feature);
    if (dimension === 'model') return row.model === null ? 'Unknown model' : String(row.model);
    if (dimension === 'operation')
      return OPERATION_LABELS[String(row.operation)] ?? String(row.operation);
    return String(row.day);
  };

  for (const row of rows) {
    const share = total > 0 ? (row.totalCostUsd / total) * 100 : 0;
    const rowEl = el('div', styles.driverRow);
    const left = el('div', styles.driverMain);
    left.append(el('p', styles.driverName, nameOf(row)));
    const tokens = Number(row.totalTokens ?? 0);
    left.append(
      el(
        'p',
        styles.driverMeta,
        `${row.requestCount} request${row.requestCount === 1 ? '' : 's'}${tokens > 0 ? ` · ${formatTokens(tokens)} tokens` : ''}`,
      ),
    );
    rowEl.append(
      left,
      el('p', styles.driverCost, `${usd(row.totalCostUsd)} · ${share.toFixed(0)}%`),
    );
    const track = el('div', styles.shareTrack);
    const fill = el('div', styles.shareFill);
    fill.style.width = `${share.toFixed(1)}%`;
    track.append(fill);
    rowEl.append(track);
    list.append(rowEl);
  }
}

function renderTrend(points: TrendPoint[]): void {
  const container = find('[data-uai-trend]');
  if (!container) return;
  clear(container);
  const max = Math.max(0, ...points.map((point) => point.totalCostUsd));
  for (const point of points) {
    const col = el('div', styles.trendCol);
    const height = max > 0 ? Math.max(6, (point.totalCostUsd / max) * 100) : 6;
    const bar = document.createElement('div');
    bar.className = styles.trendBar;
    bar.style.height = `${height.toFixed(1)}%`;
    if (point.totalCostUsd === 0) bar.dataset.zero = '';
    const date = new Date(point.bucketStart);
    bar.title = `${monthLabel.format(date)} ${date.getFullYear()}: ${usd(point.totalCostUsd)}`;
    col.append(bar, el('p', styles.trendLabel, monthLabel.format(date)));
    container.append(col);
  }
}

function renderWasteAndEfficiency(data: UsagePagePayload): void {
  const waste = find('[data-uai-waste]');
  const efficiency = find('[data-uai-efficiency]');
  if (!waste || !efficiency) return;
  clear(waste);
  clear(efficiency);

  const { summary } = data;
  const noUsage = Math.max(0, summary.requestCount - summary.usageAvailableCount);

  waste.append(
    el('p', styles.tallyLabel, 'Waste'),
    el(
      'p',
      styles.tallyValue,
      `${summary.failedCount} failed request${summary.failedCount === 1 ? '' : 's'} · ${usd(summary.failedCostUsd)} wasted`,
    ),
    el(
      'p',
      styles.tallyLabel,
      noUsage > 0
        ? `${noUsage} request${noUsage === 1 ? '' : 's'} with no usage data (unpriced)`
        : 'No unpriced requests',
    ),
  );

  const cacheShare =
    summary.totalTokens > 0
      ? ((summary.cachedInputTokens / summary.totalTokens) * 100).toFixed(0)
      : '0';
  const reasoningShare =
    summary.totalTokens > 0
      ? ((summary.reasoningTokens / summary.totalTokens) * 100).toFixed(0)
      : '0';

  efficiency.append(
    el('p', styles.tallyLabel, 'Efficiency'),
    el(
      'p',
      styles.tallyValue,
      `${formatTokens(summary.cachedInputTokens)} tokens served from cache (${cacheShare}% of total)`,
    ),
    el(
      'p',
      styles.tallyLabel,
      `${reasoningShare}% reasoning tokens · ${formatTokens(summary.reasoningTokens)}`,
    ),
  );

  const impact = find('[data-uai-impact-grid]');
  if (!impact) return;
  clear(impact);
  const water = summary.requestCount * ESTIMATED_WATER_LITERS_PER_REQUEST;
  const electricity = summary.requestCount * ESTIMATED_ELECTRICITY_KWH_PER_REQUEST;
  for (const [label, value] of [
    ['Water', formatLiters(water)],
    ['Electricity', formatElectricity(electricity)],
  ]) {
    const item = el('div', styles.impactItem);
    item.append(el('p', styles.tallyLabel, label), el('p', styles.impactValue, value));
    impact.append(item);
  }
}

async function load(): Promise<void> {
  let data: UsagePagePayload;
  try {
    const response = await fetch('/api/usage/ai', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`usage fetch failed: ${response.status}`);
    data = await response.json();
  } catch {
    // Leave the skeleton fallbacks in place.
    return;
  }

  renderStatus(data);
  renderDaily(data.daily);
  renderDrivers(data, 'feature');
  renderTrend(data.monthlyTrend);
  renderWasteAndEfficiency(data);

  find('[data-uai-seg]')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-uai-dim]');
    if (!button?.dataset.uaiDim) return;
    renderDrivers(data, button.dataset.uaiDim);
  });
}

void load();
