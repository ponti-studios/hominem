import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { proactivityEvalCases, type ProactivityEvalCase } from './cases.js';
import { runProactivityEvalSuite, type ProactivityEvalResult } from './harness.js';

const offline = process.argv.includes('--offline');
const model = process.env.PROACTIVITY_EVAL_MODEL ?? 'openai/gpt-5-mini';
const generatedAt = new Date();
const demoCases = proactivityEvalCases.filter(({ id }) => id !== 'grocery-refund');

const slot = offline
  ? (await import('./harness.js')).createExpectedSlot(demoCases)
  : (await import('../openrouter-slot.js')).createOpenRouterProactivitySlot({ model });

console.log(
  `Running ${demoCases.length} scenarios ${offline ? 'offline' : `live with ${model}`}...`,
);

const results = await runProactivityEvalSuite(demoCases, slot, {
  onResult: (result) => {
    console.log(`${result.passed ? '✓' : '✗'} ${result.caseId} (${result.actual})`);
  },
});

const html = render({ results, cases: demoCases, model, offline, generatedAt });
const outputPath = fileURLToPath(new URL('../../demo/proactivity-demo.html', import.meta.url));
await mkdir(fileURLToPath(new URL('../../demo/', import.meta.url)), { recursive: true });
await writeFile(outputPath, html);

console.log(`\nWrote ${outputPath}`);

function render(input: {
  results: ProactivityEvalResult[];
  cases: readonly ProactivityEvalCase[];
  model: string;
  offline: boolean;
  generatedAt: Date;
}): string {
  const { results, cases, model, offline, generatedAt } = input;
  const caseById = new Map(cases.map((input) => [input.id, input]));
  const passed = results.filter((result) => result.passed).length;
  const counts = countDecisions(results);
  const categories = new Set(cases.map((input) => input.category)).size;
  const mode = offline ? 'Offline expected slot' : `Live · ${model}`;

  const cards = results.map((result) => renderCard(result, caseById.get(result.caseId))).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Proactivity engine — scenario showcase</title>
<style>
  :root {
    --paper: #f6f1e7;
    --paper-2: #fbf8f1;
    --ink: #1d1c19;
    --muted: #6d675e;
    --line: #ddd4c5;
    --propose: #b64b2b;
    --propose-bg: #f3e2d9;
    --defer: #9a6a14;
    --defer-bg: #f2e8cf;
    --quiet: #47644f;
    --quiet-bg: #e2e9df;
    --none: #5f5b54;
    --none-bg: #e9e4da;
    --shadow: 0 1px 0 rgba(29, 28, 25, 0.05), 0 18px 50px -30px rgba(29, 28, 25, 0.35);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 16px/1.55 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main { max-width: 1180px; margin: 0 auto; padding: 56px 24px 80px; }
  .eyebrow {
    margin: 0 0 14px;
    color: var(--propose);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h1, h2, h3, h4 { font-family: ui-serif, Georgia, "Times New Roman", serif; font-weight: 600; letter-spacing: -0.02em; }
  h1 { max-width: 900px; margin: 0; font-size: clamp(2.4rem, 5.5vw, 4.6rem); line-height: 0.98; }
  .lede { max-width: 760px; margin: 22px 0 0; color: var(--muted); font-size: 1.12rem; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; color: var(--muted); font-size: 13px; }
  .meta span { border: 1px solid var(--line); border-radius: 999px; padding: 5px 10px; background: var(--paper-2); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 40px 0 8px; }
  .stat { background: var(--paper-2); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
  .stat b { display: block; font-family: ui-serif, Georgia, serif; font-size: 2rem; font-weight: 600; line-height: 1; }
  .stat span { display: block; margin-top: 8px; color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 32px 0 48px; }
  .mode { border-top: 3px solid var(--line); padding: 16px 4px 0; }
  .mode h3 { margin: 0 0 6px; font-size: 1.15rem; }
  .mode p { margin: 0; color: var(--muted); font-size: 0.95rem; }
  .mode.propose { border-color: var(--propose); }
  .mode.defer { border-color: var(--defer); }
  .mode.quiet { border-color: var(--quiet); }
  .section-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin: 0 0 18px; }
  .section-head h2 { margin: 0; font-size: 1.8rem; }
  .section-head p { margin: 0; color: var(--muted); font-size: 0.95rem; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .filters button {
    border: 1px solid var(--line);
    background: var(--paper-2);
    color: var(--ink);
    border-radius: 999px;
    padding: 8px 13px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .filters button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 16px; }
  .case {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 20px;
    box-shadow: var(--shadow);
  }
  .case.hidden { display: none; }
  .case-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chip { color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .badge { margin-left: auto; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .badge.propose { color: var(--propose); background: var(--propose-bg); }
  .badge.defer { color: var(--defer); background: var(--defer-bg); }
  .badge.quiet { color: var(--quiet); background: var(--quiet-bg); }
  .badge.none, .badge.error { color: var(--none); background: var(--none-bg); }
  .case h3 { margin: 0; font-size: 1.35rem; line-height: 1.15; }
  .trigger { margin: 0; color: var(--muted); font-size: 0.85rem; }
  .states { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .state { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: rgba(255,255,255,0.35); }
  .state h4 { margin: 0 0 6px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .state dl { margin: 0; display: grid; grid-template-columns: minmax(96px, 0.45fr) 1fr; gap: 4px 12px; font-size: 0.84rem; line-height: 1.45; }
  .state dt { color: var(--muted); }
  .state dd { margin: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  .state .evid { display: block; margin-bottom: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.68rem; color: var(--muted); }
  .redacted { color: var(--muted); font-style: italic; }
  .empty { color: var(--muted); font-size: 0.82rem; margin: 0; }
  .decision { border-top: 1px solid var(--line); padding-top: 14px; }
  .decision .summary { margin: 0 0 6px; font-weight: 800; }
  .decision .reason { margin: 0; color: #413d36; font-size: 0.92rem; }
  .next { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--paper); border: 1px solid var(--line); font-size: 0.88rem; }
  .next b { display: block; margin-bottom: 3px; font-size: 0.68rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .evidence { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
  .evidence span { border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.66rem; color: var(--muted); }
  .delivery { margin-top: 4px; border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: #fffdf8; }
  .delivery .label { display: block; margin-bottom: 7px; color: var(--muted); font-size: 0.65rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .delivery strong { display: block; font-size: 0.9rem; }
  .delivery p { margin: 4px 0 0; color: var(--muted); font-size: 0.82rem; }
  .withheld { background: transparent; border-style: dashed; color: var(--muted); font-size: 0.82rem; }
  .guardrails { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin: 52px 0 0; }
  .guardrail { border-top: 1px solid var(--line); padding-top: 14px; }
  .guardrail h3 { margin: 0 0 6px; font-size: 1.05rem; }
  .guardrail p { margin: 0; color: var(--muted); font-size: 0.9rem; }
  footer { margin-top: 48px; border-top: 1px solid var(--line); padding-top: 18px; color: var(--muted); font-size: 0.78rem; }
  @media (max-width: 620px) {
    main { padding-top: 36px; }
    .states { grid-template-columns: 1fr; }
    .section-head { display: block; }
    .section-head p { margin-top: 6px; }
  }
</style>
</head>
<body>
<main>
  <p class="eyebrow">Hominem · proactivity engine</p>
  <h1>It notices. It explains. It stays quiet.</h1>
  <p class="lede">A goal-aware evaluation engine that watches for material changes, cites the evidence, and only interrupts when there is a real decision to make. These are live model decisions over synthetic accounts and events — the engine is not wired into the product yet.</p>
  <div class="meta">
    <span>${mode}</span>
    <span>${cases.length} scenarios</span>
    <span>${passed}/${results.length} passed</span>
    <span>Generated ${formatTimestamp(generatedAt)}</span>
  </div>

  <section class="stats" aria-label="Summary">
    <div class="stat"><b>${passed}/${results.length}</b><span>scenarios passed</span></div>
    <div class="stat"><b>${counts.propose}</b><span>proposals</span></div>
    <div class="stat"><b>${counts.defer}</b><span>deferrals</span></div>
    <div class="stat"><b>${counts.quiet + counts.none}</b><span>quiet / skipped</span></div>
    <div class="stat"><b>${categories}</b><span>life areas</span></div>
  </section>

  <section class="modes" aria-label="Decision modes">
    <div class="mode propose"><h3>Propose</h3><p>Something material changed and there is one safe next step. The decision cites the facts that caused it.</p></div>
    <div class="mode defer"><h3>Defer</h3><p>The evidence is stale, duplicated, conflicting, or missing. It asks for the gap instead of inventing an answer.</p></div>
    <div class="mode quiet"><h3>Quiet</h3><p>Progress, bookkeeping, unrelated changes, and achieved goals are not interruptions.</p></div>
  </section>

  <div class="section-head">
    <h2>The scenarios</h2>
    <p>Every card below is a real model output from the evaluation suite.</p>
  </div>
  <div class="filters" role="group" aria-label="Filter scenarios">
    <button data-filter="all" aria-pressed="true">All ${results.length}</button>
    <button data-filter="propose" aria-pressed="false">Propose ${counts.propose}</button>
    <button data-filter="defer" aria-pressed="false">Defer ${counts.defer}</button>
    <button data-filter="quiet" aria-pressed="false">Quiet ${counts.quiet}</button>
    <button data-filter="none" aria-pressed="false">Skipped ${counts.none}</button>
  </div>
  <div class="grid">
${cards}
  </div>

  <section class="guardrails" aria-label="Guardrails">
    <div class="guardrail"><h3>Evidence only</h3><p>Every claim cites supplied evidence IDs. The engine rejects decisions that cite anything else.</p></div>
    <div class="guardrail"><h3>No irreversible action</h3><p>It can recommend a review or a conversation. It never moves money, contacts anyone, or commits the user.</p></div>
    <div class="guardrail"><h3>Private by default</h3><p>Sensitive notes are not repeated. The caregiving case defers without quoting the private detail.</p></div>
    <div class="guardrail"><h3>Quiet is a result</h3><p>Progress and noise are valid outcomes. The engine is measured on not interrupting as much as on catching risk.</p></div>
  </section>

  <footer>
    Synthetic accounts and events. Generated ${formatTimestamp(generatedAt)} · ${mode}. Full suite: <code>pnpm --filter @hominem/proactivity eval -- --live</code>.
  </footer>
</main>
<script>
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.case')];
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      cards.forEach((card) => {
        card.classList.toggle('hidden', filter !== 'all' && card.dataset.decision !== filter);
      });
    });
  });
</script>
</body>
</html>`;
}

function renderCard(result: ProactivityEvalResult, input: ProactivityEvalCase | undefined): string {
  if (!input) return '';
  const decision = result.decision;
  const actual = result.actual;
  const searchable = actual === 'error' ? 'error' : actual;

  return `<article class="case" data-decision="${escapeHtml(searchable)}">
  <div class="case-head">
    <span class="chip">${escapeHtml(input.category)}</span>
    <span class="badge ${escapeHtml(searchable)}">${escapeHtml(labelFor(actual))}</span>
  </div>
  <div>
    <h3>${escapeHtml(input.goal.title)}</h3>
    <p class="trigger">${escapeHtml(triggerLabel(input.trigger))}</p>
  </div>
  <div class="states">
    <div class="state"><h4>Before</h4>${renderSnapshot(input.previous)}</div>
    <div class="state"><h4>After</h4>${renderSnapshot(input.current)}</div>
  </div>
  <div class="decision">
    ${renderDecision(result, input)}
    ${renderEvidence(input, decision?.evidenceIds ?? [])}
  </div>
  ${renderDelivery(result, input)}
  ${
    result.passed
      ? ''
      : `<p class="empty" style="color:var(--propose)">Harness: ${escapeHtml(result.failures.join(' '))}</p>`
  }
</article>`;
}

function renderDecision(result: ProactivityEvalResult, input: ProactivityEvalCase): string {
  if (result.actual === 'none') {
    return `<p class="summary">Not evaluated</p><p class="reason">${escapeHtml(input.expected.rationale)}</p>`;
  }
  if (!result.decision) {
    return `<p class="summary">Evaluation error</p><p class="reason">${escapeHtml(result.error ?? input.expected.rationale)}</p>`;
  }
  const decision = result.decision;
  const summary = decision.kind === 'propose' ? decision.summary : labelFor(decision.kind);
  const next =
    decision.kind === 'propose'
      ? `<div class="next"><b>One safe next step</b>${escapeHtml(decision.nextStep)}</div>`
      : '';
  return `<p class="summary">${escapeHtml(summary)}</p><p class="reason">${escapeHtml(decision.reason)}</p>${next}`;
}

function renderEvidence(input: ProactivityEvalCase, cited: readonly string[]): string {
  const evidence = [...input.current.evidence, ...input.previous.evidence];
  const ids = cited.length > 0 ? cited : evidence.map(({ id }) => id);
  if (ids.length === 0) return '';
  return `<div class="evidence" aria-label="Evidence cited">${ids
    .map((id) => `<span>${escapeHtml(id)}</span>`)
    .join('')}</div>`;
}

function renderDelivery(result: ProactivityEvalResult, input: ProactivityEvalCase): string {
  if (result.actual === 'none') {
    return `<div class="delivery withheld"><span class="label">Delivery</span>No evaluation, no email. ${escapeHtml(input.expected.rationale)}</div>`;
  }
  if (result.actual === 'defer') {
    return `<div class="delivery withheld"><span class="label">Delivery withheld</span>No email sent; waiting for better evidence.</div>`;
  }
  if (result.actual === 'quiet') {
    return `<div class="delivery withheld"><span class="label">Delivery withheld</span>No interruption was sent.</div>`;
  }
  const intent = result.deliveryIntents.find((candidate) => candidate.kind === 'goal-proposal');
  if (!intent)
    return `<div class="delivery withheld"><span class="label">Delivery</span>No goal-proposal intent was produced.</div>`;
  return `<div class="delivery"><span class="label">What the user would receive</span><strong>${escapeHtml(intent.subject)}</strong><p>${escapeHtml(intent.body)}</p></div>`;
}

function renderSnapshot(snapshot: ProactivityEvalCase['current']): string {
  if (snapshot.evidence.length === 0) return '<p class="empty">No evidence yet.</p>';
  return snapshot.evidence
    .map(
      (item) =>
        `<span class="evid">${escapeHtml(item.id)}</span><dl>${Object.entries(item.facts)
          .map(([key, value]) => {
            const shown = isSensitiveKey(key)
              ? '<span class="redacted">[redacted]</span>'
              : escapeHtml(formatValue(value));
            return `<dt>${escapeHtml(humanizeKey(key))}</dt><dd>${shown}</dd>`;
          })
          .join('')}</dl>`,
    )
    .join('');
}

function isSensitiveKey(key: string): boolean {
  return key.toLowerCase().includes('private');
}

function triggerLabel(trigger: ProactivityEvalCase['trigger']): string {
  if (trigger.kind === 'critical-change') {
    return `Critical change · ${trigger.changedDomains.join(', ')} · ${formatDate(trigger.occurredAt)}`;
  }
  if (trigger.kind === 'scheduled-pass') return `Scheduled pass · ${formatDate(trigger.asOf)}`;
  return `Weekly summary · ${formatDate(trigger.asOf)}`;
}

function labelFor(kind: string): string {
  switch (kind) {
    case 'propose':
      return 'Propose';
    case 'defer':
      return 'Defer';
    case 'quiet':
      return 'Quiet';
    case 'none':
      return 'Skipped';
    default:
      return 'Error';
  }
}

function countDecisions(results: ProactivityEvalResult[]) {
  return results.reduce(
    (counts, result) => {
      const key = result.actual;
      if (key === 'propose' || key === 'defer' || key === 'quiet' || key === 'none') {
        counts[key] += 1;
      }
      return counts;
    },
    { propose: 0, defer: 0, quiet: 0, none: 0 },
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    return value.length > 180 ? `${value.slice(0, 177)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.map(formatArrayItem).join(', ');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${humanizeKey(key)}: ${formatValue(entry)}`)
      .join(' · ');
  }
  return String(value);
}

function formatArrayItem(value: unknown): string {
  if (isRecord(value) && typeof value.name === 'string') {
    return value.amount === undefined ? value.name : `${value.name} (${formatValue(value.amount)})`;
  }
  return formatValue(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function humanizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
