// @jsxImportSource react
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AccountShell } from './account-shell';
import { apiFetch } from './api';
import { AuthContent, AuthCardCopy, AuthHeading, AuthTitle } from './auth-shell';

import styles from './ai-usage-page.module.css';

type UsageStatus = {
  limitTokens: number | null;
  isOverLimit: boolean;
  unlimited?: boolean;
  percentUsed: number;
  periodStart: string;
  totalTokens: number;
};

type Summary = {
  requestCount: number;
  usageAvailableCount: number;
  failedCount: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type BreakdownRow = {
  totalTokens: number;
  requestCount: number;
  [key: string]: string | null | number;
};

type TrendPoint = { bucketStart: string; totalTokens: number; requestCount: number };

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
  const { monthly, summary } = data;
  const start = new Date(monthly.periodStart);
  const percent = monthly.percentUsed;
  const now = new Date();
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
        <p className={styles.bigNumber}>{formatTokens(monthly.totalTokens)}</p>
        <p className={styles.muted}>
          {monthly.unlimited ? 'Unlimited' : `of ${formatTokens(monthly.limitTokens ?? 0)} tokens`}
        </p>
      </div>
      {!monthly.unlimited ? (
        <div aria-hidden="true" className={styles.bar}>
          <div
            className={styles.barFill}
            data-over={monthly.isOverLimit ? '' : undefined}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {monthly.isOverLimit ? (
        <p className={styles.pacing} data-over="">
          You've reached this month's AI allowance. AI features resume when it resets.
        </p>
      ) : null}
      <p className={styles.muted}>
        {monthly.unlimited
          ? `${summary.requestCount} requests this month.`
          : daysUntilReset === 1
            ? `Resets tomorrow. ${summary.requestCount} requests this month.`
            : `Resets in ${daysUntilReset} days. ${summary.requestCount} requests this month.`}
      </p>
    </section>
  );
}

function DailySpark({ daily }: { daily: TrendPoint[] }) {
  const max = Math.max(0, ...daily.map((point) => point.totalTokens));
  if (daily.length === 0) return null;
  return (
    <div aria-label="Daily AI token usage" className={styles.spark}>
      {daily.map((point) => {
        const height = max > 0 ? Math.max(4, (point.totalTokens / max) * 100) : 4;
        return (
          <div
            className={styles.sparkBar}
            data-zero={point.totalTokens === 0 ? '' : undefined}
            key={point.bucketStart}
            style={{ height: `${height.toFixed(1)}%` }}
            title={`${dayLabel.format(new Date(point.bucketStart))}: ${formatTokens(point.totalTokens)} tokens`}
          />
        );
      })}
    </div>
  );
}

function DriverRows({ rows, dimension }: { rows: BreakdownRow[]; dimension: Dimension }) {
  const total = rows.reduce((sum, row) => sum + row.totalTokens, 0);
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
        const share = total > 0 ? (row.totalTokens / total) * 100 : 0;
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
              {formatTokens(tokens)} tokens · {share.toFixed(0)}%
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
      totalTokens: point.totalTokens,
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
  const max = Math.max(0, ...points.map((point) => point.totalTokens));
  return (
    <div aria-label="Monthly AI token usage" className={styles.trend}>
      {points.map((point) => {
        const height = max > 0 ? Math.max(6, (point.totalTokens / max) * 100) : 6;
        const date = new Date(point.bucketStart);
        return (
          <div className={styles.trendCol} key={point.bucketStart}>
            <div
              className={styles.trendBar}
              data-zero={point.totalTokens === 0 ? '' : undefined}
              style={{ height: `${height.toFixed(1)}%` }}
              title={`${monthLabel.format(date)} ${date.getFullYear()}: ${formatTokens(point.totalTokens)} tokens`}
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
              {summary.failedCount} failed request{summary.failedCount === 1 ? '' : 's'}
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
          <a className={styles.impactLink} href="/account/usage/ai/footprint">
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
    <AccountShell active="/account/usage/ai">
      <>
        <AuthContent wide>
          <AuthHeading>
            <AuthTitle>AI usage</AuthTitle>
            <AuthCardCopy>
              Your monthly AI allowance, how you've used it, and what's driving usage.
            </AuthCardCopy>
          </AuthHeading>
          <div className={`${styles.page} w-full`}>
            {data ? (
              <>
                <StatusCard data={data} />
                <section className={styles.card}>
                  <p className={styles.cardTitle}>Daily usage</p>
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
              <a href="/account">← Back to account</a>
            </p>
          </div>
        </AuthContent>
      </>
    </AccountShell>
  );
}
