import { PageFrame } from './page-frame';
import { aiFootprintPage, aiUsagePage, pageFrame } from './styles.generated';

export function AIFootprintPage() {
  return (
    <PageFrame script="/settings-ai-footprint.js?v=1" title="AI footprint | Hominem" wide>
      <div class={`${pageFrame.authContent} ${pageFrame.authContentWide}`}>
        <div class={pageFrame.authHeading}>
          <a class={aiFootprintPage.backLink} href="/auth/settings/ai">
            ← AI usage
          </a>
          <h2 id="footprint-title">AI footprint</h2>
          <p class={pageFrame.cardCopy}>
            A transparent estimate of the water and electricity associated with your AI requests.
          </p>
        </div>

        <div class={aiFootprintPage.page}>
          <section class={`${aiUsagePage.card} ${aiFootprintPage.summary}`}>
            <div class={aiFootprintPage.summaryHead}>
              <p class={aiUsagePage.cardTitle}>Your estimated footprint</p>
              <p class={aiUsagePage.muted}>This month</p>
            </div>
            <div class={aiUsagePage.impactGrid}>
              <div class={aiUsagePage.impactItem}>
                <p class={aiUsagePage.tallyLabel}>Water</p>
                <p class={aiUsagePage.impactValue} data-footprint-water>
                  —
                </p>
                <p class={aiUsagePage.muted} data-footprint-water-formula>
                  Calculating…
                </p>
              </div>
              <div class={aiUsagePage.impactItem}>
                <p class={aiUsagePage.tallyLabel}>Electricity</p>
                <p class={aiUsagePage.impactValue} data-footprint-electricity>
                  —
                </p>
                <p class={aiUsagePage.muted} data-footprint-electricity-formula>
                  Calculating…
                </p>
              </div>
            </div>
            <p class={aiUsagePage.muted} data-footprint-requests>
              Loading request count…
            </p>
          </section>

          <section class={aiUsagePage.card}>
            <p class={aiUsagePage.cardTitle}>How we calculate it</p>
            <ol class={aiFootprintPage.steps}>
              <li>
                <span class={aiFootprintPage.stepNumber}>1</span>
                <div>
                  <strong>Count your requests</strong>
                  <p>We use every AI request recorded for the current usage period.</p>
                </div>
              </li>
              <li>
                <span class={aiFootprintPage.stepNumber}>2</span>
                <div>
                  <strong>Apply a water estimate</strong>
                  <p>
                    Each request is estimated at 10 mL of water used for cooling and operations.
                  </p>
                </div>
              </li>
              <li>
                <span class={aiFootprintPage.stepNumber}>3</span>
                <div>
                  <strong>Apply an electricity estimate</strong>
                  <p>Each request is estimated at 0.34 Wh of electricity.</p>
                </div>
              </li>
            </ol>
          </section>

          <section class={`${aiUsagePage.card} ${aiFootprintPage.note}`}>
            <p class={aiUsagePage.cardTitle}>What this does — and doesn’t — mean</p>
            <p class={aiUsagePage.muted}>
              These numbers are directional estimates based on request count, not readings from a
              utility meter or an AI provider. Actual impact changes with model size, prompt length,
              hardware, region, and data-center cooling. Use them to understand scale, not as an
              audited environmental report.
            </p>
          </section>

          <p class={aiUsagePage.backLink}>
            <a href="/auth/settings/ai">← Back to AI usage</a>
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
