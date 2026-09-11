import { PageFrame } from './page-frame';
import { aiUsagePage, pageFrame } from './styles.generated';

// The AI-usage report page: a server-rendered skeleton with data hooks for
// settings-ai.js to fill from GET /api/usage/ai (same-origin, session
// cookie). Every number/card degrades to its progress text if the client
// bundle or the fetch fails.
export function AIUsagePage() {
  return (
    <PageFrame script="/settings-ai.js?v=footprint-2" title="AI usage | Hominem" wide>
      <div class={`${pageFrame.authContent} ${pageFrame.authContentWide}`}>
        <div class={pageFrame.authHeading}>
          <h2 id="usage-title">AI usage</h2>
          <p class={pageFrame.cardCopy}>
            Where your Hominem AI budget went this month — what's driving it, what's wasteful, and
            how fast you're spending.
          </p>
        </div>
        <div class={aiUsagePage.page}>
          <section class={`${aiUsagePage.card} ${aiUsagePage.hero}`}>
            <p class={aiUsagePage.cardTitle} data-uai-period>
              This month
            </p>
            <div class={aiUsagePage.statusRow}>
              <p class={aiUsagePage.bigNumber} data-uai-total>
                $0.00
              </p>
              <p class={aiUsagePage.muted} data-uai-limit>
                of $10.00
              </p>
            </div>
            <div aria-hidden="true" class={aiUsagePage.bar}>
              <div class={aiUsagePage.barFill} data-uai-bar style="width: 0%" />
            </div>
            <p class={aiUsagePage.pacing} data-uai-pacing />
            <p class={aiUsagePage.muted} data-uai-reset />
          </section>

          <section class={aiUsagePage.card}>
            <p class={aiUsagePage.cardTitle}>Daily spend</p>
            <div aria-label="Daily AI cost" class={aiUsagePage.spark} data-uai-daily />
          </section>

          <section class={aiUsagePage.card}>
            <div class={aiUsagePage.driverHead}>
              <p class={aiUsagePage.cardTitle}>Where it went</p>
              <div class={aiUsagePage.seg} data-uai-seg role="group" aria-label="Break down by">
                {(['feature', 'model', 'operation', 'day'] as const).map((dimension) => (
                  <button
                    aria-pressed={dimension === 'feature'}
                    class={aiUsagePage.segButton}
                    data-uai-dim={dimension}
                    key={dimension}
                    type="button"
                  >
                    {dimension === 'feature'
                      ? 'Feature'
                      : dimension === 'operation'
                        ? 'Operation'
                        : dimension === 'day'
                          ? 'Day'
                          : 'Model'}
                  </button>
                ))}
              </div>
            </div>
            <div class={aiUsagePage.drivers} data-uai-drivers />
          </section>

          <section class={aiUsagePage.card}>
            <p class={aiUsagePage.cardTitle}>Last 6 months</p>
            <div aria-label="Monthly AI cost" class={aiUsagePage.trend} data-uai-trend />
          </section>

          <section class={aiUsagePage.card}>
            <p class={aiUsagePage.cardTitle}>Waste &amp; efficiency</p>
            <div class={aiUsagePage.twoCol}>
              <div class={aiUsagePage.tally} data-uai-waste />
              <div class={aiUsagePage.tally} data-uai-efficiency />
            </div>
          </section>

          <section class={aiUsagePage.card} data-uai-impact>
            <div class={aiUsagePage.impactHead}>
              <a class={aiUsagePage.impactLink} href="/auth/settings/ai/footprint">
                Estimated footprint ↗
              </a>
              <p class={aiUsagePage.muted}>This month</p>
            </div>
            <div class={aiUsagePage.impactGrid} data-uai-impact-grid />
            <p class={aiUsagePage.muted}>
              A rough request-based estimate. Actual impact varies by model and data center.
            </p>
          </section>

          <p class={aiUsagePage.backLink}>
            <a href="/auth/settings">← Back to account</a>
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
