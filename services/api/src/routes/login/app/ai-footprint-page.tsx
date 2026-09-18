// @jsxImportSource react
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './api';
import { AuthContent, AuthCardCopy, AuthHeading, AuthShell, AuthTitle } from './auth-shell';

import styles from './ai-footprint-page.module.css';
import usageStyles from './ai-usage-page.module.css';

type FootprintSummary = {
  requestCount: number;
};

const WATER_LITERS_PER_REQUEST = 0.01;
const ELECTRICITY_KWH_PER_REQUEST = 0.00034;

function formatLiters(liters: number): string {
  if (liters < 1) return `${Math.round(liters * 1_000)} mL`;
  return `${liters.toFixed(1)} L`;
}

function formatElectricity(kilowattHours: number): string {
  if (kilowattHours < 1) return `${Math.round(kilowattHours * 1_000)} Wh`;
  return `${kilowattHours.toFixed(2)} kWh`;
}

export function AiFootprintPage() {
  const query = useQuery({
    queryKey: ['usage', 'ai'],
    queryFn: () => apiFetch<{ summary: FootprintSummary }>('/api/usage/ai'),
  });
  const requestCount = query.data?.summary.requestCount ?? null;

  return (
    <AuthShell wide>
      <AuthContent wide>
        <AuthHeading>
          <a className={`${styles.backLink} text-left`} href="/auth/settings/ai">
            ← AI usage
          </a>
          <AuthTitle>AI footprint</AuthTitle>
          <AuthCardCopy>
            A transparent estimate of the water and electricity associated with your AI requests.
          </AuthCardCopy>
        </AuthHeading>

        <div className={`${styles.page} w-full`}>
          <section className={`${usageStyles.card} ${styles.summary}`}>
            <div className={styles.summaryHead}>
              <p className={usageStyles.cardTitle}>Your estimated footprint</p>
              <p className={usageStyles.muted}>This month</p>
            </div>
            <div className={usageStyles.impactGrid}>
              <div className={usageStyles.impactItem}>
                <p className={usageStyles.tallyLabel}>Water</p>
                <p className={usageStyles.impactValue}>
                  {requestCount === null
                    ? '—'
                    : formatLiters(requestCount * WATER_LITERS_PER_REQUEST)}
                </p>
                <p className={usageStyles.muted}>
                  {requestCount === null ? 'Calculating…' : '10 mL per request'}
                </p>
              </div>
              <div className={usageStyles.impactItem}>
                <p className={usageStyles.tallyLabel}>Electricity</p>
                <p className={usageStyles.impactValue}>
                  {requestCount === null
                    ? '—'
                    : formatElectricity(requestCount * ELECTRICITY_KWH_PER_REQUEST)}
                </p>
                <p className={usageStyles.muted}>
                  {requestCount === null ? 'Calculating…' : '0.34 Wh per request'}
                </p>
              </div>
            </div>
            <p className={usageStyles.muted}>
              {requestCount === null
                ? 'Loading request count…'
                : `${requestCount} requests this month`}
            </p>
          </section>

          <section className={usageStyles.card}>
            <p className={usageStyles.cardTitle}>How we calculate it</p>
            <ol className={styles.steps}>
              <li>
                <span className={styles.stepNumber}>1</span>
                <div>
                  <strong>Count your requests</strong>
                  <p>We use every AI request recorded for the current usage period.</p>
                </div>
              </li>
              <li>
                <span className={styles.stepNumber}>2</span>
                <div>
                  <strong>Apply a water estimate</strong>
                  <p>
                    Each request is estimated at 10 mL of water used for cooling and operations.
                  </p>
                </div>
              </li>
              <li>
                <span className={styles.stepNumber}>3</span>
                <div>
                  <strong>Apply an electricity estimate</strong>
                  <p>Each request is estimated at 0.34 Wh of electricity.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className={`${usageStyles.card} ${styles.note}`}>
            <p className={usageStyles.cardTitle}>What this does — and doesn’t — mean</p>
            <p className={usageStyles.muted}>
              These numbers are directional estimates based on request count, not readings from a
              utility meter or an AI provider. Actual impact changes with model size, prompt length,
              hardware, region, and data-center cooling. Use them to understand scale, not as an
              audited environmental report.
            </p>
          </section>

          <p className={usageStyles.backLink}>
            <a href="/auth/settings/ai">← Back to AI usage</a>
          </p>
        </div>
      </AuthContent>
    </AuthShell>
  );
}
