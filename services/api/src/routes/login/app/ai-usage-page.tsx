// @jsxImportSource react
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { apiFetch } from './api';
import { AuthContent, AuthCardCopy, AuthHeading, AuthShell, AuthTitle } from './auth-shell';

import styles from './ai-usage-page.module.css';

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

type Dimension = 'feature' | 'model' | 'operation' | 'day';

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
  career_resume_analyze: 'Resume analysis',
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

const usd = (amount: number): string => usdFormatter.format(amount);

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

function StatusCard({ data }: { data: UsagePagePayload }) {
  const { monthly, summary, daily } = data;
  const start = new Date(monthly.periodStart);
  const percent = Math.min(100, (monthly.totalCostUsd / monthly.limitUsd) * 100);

  const now = new Date();
  const elapsedDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
  const monthDays = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const projected = (monthly.totalCostUsd / elapsedDays) * monthDays;
  const dailyAverage = daily.length > 0 ? monthly.totalCostUsd / elapsedDays : 0;
  const dayOfCap = dailyAverage > 0 ? Math.floor(monthly.limitUsd / dailyAverage) : null;

  let pacing: string;
  let over = false;
  if (monthly.totalCostUsd >= monthly.limitUsd) {
    pacing = "You've reached this month's AI budget — AI features are paused until it resets.";
    over = true;
  } else if (dayOfCap !== null && dayOfCap <= monthDays) {
    pacing =
      dayOfCap <= elapsedDays
        ? `At this pace you'll pass the budget around today (projected ${usd(projected)}).`
        : `At this pace, ${usd(projected)} total — the budget runs out around day ${dayOfCap} of ${monthDays}.`;
    over = projected >= monthly.limitUsd;
  } else {
    pacing = `At this pace you'd use about ${usd(projected)} — under the ${usd(monthly.limitUsd)} budget.`;
  }

  const daysUntilReset = Math.ceil(
    (new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).getTime() -
      now.getTime()) /
      86_400_000,
  );

  return (
    <section className={`${styles.card} ${styles.hero}`}>
      <p className={styles.cardTitle}>
        {monthLabel.format(start)} {start.getUTCFullYear()}
      </p>
      <div className={styles.statusRow}>
        <p className={styles.bigNumber}>{usd(monthly.totalCostUsd)}</p>
        <p className={styles.muted}>of {usd(monthly.limitUsd)}</p>
      </div>
      <div aria-hidden="true" className={styles.bar}>
        <div
          className={styles.barFill}
          data-over={monthly.totalCostUsd >= monthly.limitUsd ? '' : undefined}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={styles.pacing} data-over={over ? '' : undefined}>
        {pacing}
      </p>
      <p className={styles.muted}>
        {daysUntilReset === 1
          ? `Budget resets tomorrow. ${summary.requestCount} requests so far.`
          : `Budget resets in ${daysUntilReset} days. ${summary.requestCount} requests so far.`}
      </p>
    </section>
  );
}

function DailySpark({ daily }: { daily: TrendPoint[] }) {
  const max = Math.max(0, ...daily.map((point) => point.totalCostUsd));
  if (daily.length === 0) return null;
  return (
    <div aria-label="Daily AI cost" className={styles.spark}>
      {daily.map((point) => {
        const height = max > 0 ? Math.max(4, (point.totalCostUsd / max) * 100) : 4;
        return (
          <div
            className={styles.sparkBar}
            data-zero={point.totalCostUsd === 0 ? '' : undefined}
            key={point.bucketStart}
            style={{ height: `${height.toFixed(1)}%` }}
            title={`${dayLabel.format(new Date(point.bucketStart))}: ${usd(point.totalCostUsd)}`}
          />
        );
      })}
    </div>
  );
}

function DriverRows({ rows, dimension }: { rows: BreakdownRow[]; dimension: Dimension }) {
  const total = rows.reduce((sum, row) => sum + row.totalCostUsd, 0);
  if (rows.length === 0) {
    return <p className={styles.muted}>No usage recorded this month yet.</p>;
  }
  const nameOf = (row: BreakdownRow): string => {
    if (dimension === 'feature') return FEATURE_LABELS[String(row.feature)] ?? String(row.feature);
    if (dimension === 'model') return row.model === null ? 'Unknown model' : String(row.model);
    if (dimension === 'operation')
      return OPERATION_LABELS[String(row.operation)] ?? String(row.operation);
    return String(row.day);
  };
  return (
    <>
      {rows.map((row) => {
        const share = total > 0 ? (row.totalCostUsd / total) * 100 : 0;
        const tokens = Number(row.totalTokens ?? 0);
        return (
          <div className={styles.driverRow} key={nameOf(row)}>
            <div className={styles.driverMain}>
              <p className={styles.driverName}>{nameOf(row)}</p>
              <p className={styles.driverMeta}>
                {row.requestCount} request{row.requestCount === 1 ? '' : 's'}
                {tokens > 0 ? ` · ${formatTokens(tokens)} tokens` : ''}
              </p>
            </div>
            <p className={styles.driverCost}>
              {usd(row.totalCostUsd)} · {share.toFixed(0)}%
            </p>
            <div className={styles.shareTrack}>
              <div className={styles.shareFill} style={{ width: `${share.toFixed(1)}%` }} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function DriversCard({ data }: { data: UsagePagePayload }) {
  const [dimension, setDimension] = useState<Dimension>('feature');
  const rows: BreakdownRow[] = useMemo(() => {
    if (dimension === 'feature') return data.byFeature;
    if (dimension === 'model') return data.byModel;
    if (dimension === 'operation') return data.byOperation;
    return data.daily.map((point) => ({
      day: dayLabel.format(new Date(point.bucketStart)),
      totalCostUsd: point.totalCostUsd,
      totalTokens: 0,
      requestCount: point.requestCount,
    }));
  }, [data, dimension]);

  return (
    <section className={styles.card}>
      <div className={styles.driverHead}>
        <p className={styles.cardTitle}>Where it went</p>
        <div aria-label="Break down by" className={styles.seg} role="group">
          {(['feature', 'model', 'operation', 'day'] as const).map((item) => (
            <button
              aria-pressed={dimension === item}
              className={styles.segButton}
              key={item}
              onClick={() => setDimension(item)}
              type="button"
            >
              {item === 'feature'
                ? 'Feature'
                : item === 'operation'
                  ? 'Operation'
                  : item === 'day'
                    ? 'Day'
                    : 'Model'}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.drivers}>
        <DriverRows dimension={dimension} rows={rows} />
      </div>
    </section>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(0, ...points.map((point) => point.totalCostUsd));
  return (
    <div aria-label="Monthly AI cost" className={styles.trend}>
      {points.map((point) => {
        const height = max > 0 ? Math.max(6, (point.totalCostUsd / max) * 100) : 6;
        const date = new Date(point.bucketStart);
        return (
          <div className={styles.trendCol} key={point.bucketStart}>
            <div
              className={styles.trendBar}
              data-zero={point.totalCostUsd === 0 ? '' : undefined}
              style={{ height: `${height.toFixed(1)}%` }}
              title={`${monthLabel.format(date)} ${date.getFullYear()}: ${usd(point.totalCostUsd)}`}
            />
            <p className={styles.trendLabel}>{monthLabel.format(date)}</p>
          </div>
        );
      })}
    </div>
  );
}

function WasteAndEfficiency({ data }: { data: UsagePagePayload }) {
  const { summary } = data;
  const noUsage = Math.max(0, summary.requestCount - summary.usageAvailableCount);
  const cacheShare =
    summary.totalTokens > 0
      ? ((summary.cachedInputTokens / summary.totalTokens) * 100).toFixed(0)
      : '0';
  const reasoningShare =
    summary.totalTokens > 0
      ? ((summary.reasoningTokens / summary.totalTokens) * 100).toFixed(0)
      : '0';
  const water = summary.requestCount * ESTIMATED_WATER_LITERS_PER_REQUEST;
  const electricity = summary.requestCount * ESTIMATED_ELECTRICITY_KWH_PER_REQUEST;

  return (
    <>
      <section className={styles.card}>
        <p className={styles.cardTitle}>Waste &amp; efficiency</p>
        <div className={styles.twoCol}>
          <div className={styles.tally}>
            <p className={styles.tallyLabel}>Waste</p>
            <p className={styles.tallyValue}>
              {summary.failedCount} failed request{summary.failedCount === 1 ? '' : 's'} ·{' '}
              {usd(summary.failedCostUsd)} wasted
            </p>
            <p className={styles.tallyLabel}>
              {noUsage > 0
                ? `${noUsage} request${noUsage === 1 ? '' : 's'} with no usage data (unpriced)`
                : 'No unpriced requests'}
            </p>
          </div>
          <div className={styles.tally}>
            <p className={styles.tallyLabel}>Efficiency</p>
            <p className={styles.tallyValue}>
              {formatTokens(summary.cachedInputTokens)} tokens served from cache ({cacheShare}% of
              total)
            </p>
            <p className={styles.tallyLabel}>
              {reasoningShare}% reasoning tokens · {formatTokens(summary.reasoningTokens)}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.impactHead}>
          <a className={styles.impactLink} href="/auth/settings/ai/footprint">
            Estimated footprint ↗
          </a>
          <p className={styles.muted}>This month</p>
        </div>
        <div className={styles.impactGrid}>
          <div className={styles.impactItem}>
            <p className={styles.tallyLabel}>Water</p>
            <p className={styles.impactValue}>{formatLiters(water)}</p>
          </div>
          <div className={styles.impactItem}>
            <p className={styles.tallyLabel}>Electricity</p>
            <p className={styles.impactValue}>{formatElectricity(electricity)}</p>
          </div>
        </div>
        <p className={styles.muted}>
          A rough request-based estimate. Actual impact varies by model and data center.
        </p>
      </section>
    </>
  );
}

export function AiUsagePage() {
  const query = useQuery({
    queryKey: ['usage', 'ai'],
    queryFn: () => apiFetch<UsagePagePayload>('/api/usage/ai'),
  });
  const data = query.data;

  return (
    <AuthShell wide>
      <AuthContent wide>
        <AuthHeading>
          <AuthTitle>AI usage</AuthTitle>
          <AuthCardCopy>
            Where your Hominem AI budget went this month — what's driving it, what's wasteful, and
            how fast you're spending.
          </AuthCardCopy>
        </AuthHeading>
        <div className={`${styles.page} w-full`}>
          {data ? (
            <>
              <StatusCard data={data} />
              <section className={styles.card}>
                <p className={styles.cardTitle}>Daily spend</p>
                <DailySpark daily={data.daily} />
              </section>
              <DriversCard data={data} />
              <section className={styles.card}>
                <p className={styles.cardTitle}>Last 6 months</p>
                <TrendChart points={data.monthlyTrend} />
              </section>
              <WasteAndEfficiency data={data} />
            </>
          ) : null}
          <p className={styles.backLink}>
            <a href="/auth/settings">← Back to account</a>
          </p>
        </div>
      </AuthContent>
    </AuthShell>
  );
}
