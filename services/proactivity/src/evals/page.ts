export type DemoCase = {
  id: string;
  title: string;
  category: string;
  goal: { title: string; domains: string[] };
  trigger: { kind: string; changedDomains?: string[]; occurredAt?: string; asOf?: string };
  previous: { evidence: Array<{ id: string; facts: Record<string, unknown> }> };
  current: { evidence: Array<{ id: string; facts: Record<string, unknown> }> };
  expected: { decision: string; rationale: string };
};

export function renderDemoPage(cases: readonly DemoCase[], model: string): string {
  const payload = JSON.stringify(cases).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Proactivity engine — live</title>
<style>
  :root {
    --paper: #f6f1e7; --paper-2: #fbf8f1; --ink: #1d1c19; --muted: #6d675e; --line: #ddd4c5;
    --propose: #b64b2b; --propose-bg: #f3e2d9; --defer: #9a6a14; --defer-bg: #f2e8cf;
    --quiet: #47644f; --quiet-bg: #e2e9df; --none: #5f5b54; --none-bg: #e9e4da;
    --shadow: 0 1px 0 rgba(29,28,25,.05), 0 18px 50px -30px rgba(29,28,25,.35);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.55 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; max-width: 1320px; margin: 0 auto; padding: 32px 24px 18px; border-bottom: 1px solid var(--line); }
  .top h1 { margin: 6px 0 0; font: 600 clamp(2rem, 4vw, 3.2rem)/1 ui-serif, Georgia, serif; letter-spacing: -.03em; }
  .top p { margin: 8px 0 0; color: var(--muted); max-width: 760px; }
  .live { display: inline-flex; align-items: center; gap: 7px; color: var(--propose); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--propose); box-shadow: 0 0 0 4px var(--propose-bg); }
  .model { color: var(--muted); font-size: 12px; text-align: right; }
  .model b { display: block; color: var(--ink); font-size: 13px; }
  .shell { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 24px; max-width: 1320px; margin: 0 auto; padding: 24px; }
  .rail { position: sticky; top: 18px; align-self: start; max-height: calc(100vh - 40px); overflow: auto; }
  .rail h2 { margin: 0 0 10px; font: 600 1.1rem ui-serif, Georgia, serif; }
  .case-list { display: flex; flex-direction: column; gap: 6px; }
  .case-list button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border: 1px solid transparent; background: transparent; border-radius: 10px; padding: 9px 10px; color: var(--ink); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
  .case-list button:hover { background: var(--paper-2); border-color: var(--line); }
  .case-list button[aria-current="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .case-list .cat { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
  .case-list button[aria-current="true"] .cat { color: rgba(246,241,231,.65); }
  .stage { background: var(--paper-2); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow); padding: 24px; }
  .stage-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
  .chip, .badge { border-radius: 999px; padding: 4px 9px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .chip { color: var(--muted); border: 1px solid var(--line); background: var(--paper); }
  .badge.propose { color: var(--propose); background: var(--propose-bg); }
  .badge.defer { color: var(--defer); background: var(--defer-bg); }
  .badge.quiet { color: var(--quiet); background: var(--quiet-bg); }
  .badge.none, .badge.error { color: var(--none); background: var(--none-bg); }
  .stage h2 { margin: 10px 0 4px; font: 600 1.9rem/1.08 ui-serif, Georgia, serif; letter-spacing: -.02em; }
  .goal { margin: 0; color: var(--muted); }
  .trigger { margin: 14px 0 20px; color: var(--muted); font-size: 12px; }
  .states { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .state { border: 1px solid var(--line); border-radius: 14px; padding: 14px; background: rgba(255,255,255,.35); min-width: 0; }
  .state h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
  .state h3 button { margin-left: auto; border: 1px solid var(--line); background: var(--paper); border-radius: 6px; padding: 2px 6px; color: var(--muted); font: inherit; font-size: 10px; cursor: pointer; }
  .evid { display: block; margin: 8px 0 3px; color: var(--muted); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .facts { margin: 0; display: grid; grid-template-columns: minmax(96px, .45fr) 1fr; gap: 3px 12px; font-size: .85rem; line-height: 1.4; }
  .facts dt { color: var(--muted); }
  .facts dd { margin: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  .redacted { color: var(--muted); font-style: italic; }
  .muted { color: var(--muted); font-size: .85rem; }
  textarea { display: none; width: 100%; min-height: 220px; margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; background: #fffdf8; color: var(--ink); padding: 10px; font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
  .actions { display: flex; align-items: center; gap: 14px; margin: 18px 0 0; }
  .actions button { border: 1px solid var(--ink); background: var(--ink); color: var(--paper); border-radius: 999px; padding: 11px 20px; font: inherit; font-weight: 800; cursor: pointer; }
  .actions button:disabled { opacity: .55; cursor: wait; }
  #status { color: var(--muted); font-size: 12px; }
  #status.error { color: var(--propose); }
  .result { margin-top: 20px; }
  .result:empty { display: none; }
  .result-card { border-top: 1px solid var(--line); padding-top: 18px; }
  .result-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .match { font-size: 11px; color: var(--muted); }
  .match.ok { color: var(--quiet); }
  .match.bad { color: var(--propose); }
  .summary { margin: 14px 0 6px; font-size: 1.1rem; font-weight: 800; }
  .reason { margin: 0; color: #413d36; }
  .next { margin: 12px 0 0; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 10px 12px; font-size: .9rem; }
  .next b { display: block; margin-bottom: 3px; color: var(--muted); font-size: 10px; letter-spacing: .09em; text-transform: uppercase; }
  .evidence { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
  .evidence span { border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; color: var(--muted); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .delivery { margin-top: 15px; border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: #fffdf8; }
  .delivery .label { display: block; margin-bottom: 6px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .delivery strong { display: block; font-size: .95rem; }
  .delivery p { margin: 4px 0 0; color: var(--muted); font-size: .86rem; }
  .delivery.withheld { border-style: dashed; background: transparent; color: var(--muted); font-size: .86rem; }
  .meta { margin-top: 10px; color: var(--muted); font-size: 11px; }
  .failures { margin: 10px 0 0; color: var(--propose); font-size: .85rem; }
  .history { margin-top: 28px; border-top: 1px solid var(--line); padding-top: 16px; }
  .history h3 { margin: 0 0 10px; font: 600 1.1rem ui-serif, Georgia, serif; }
  .history-list { display: flex; flex-direction: column; gap: 6px; }
  .history-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .history-row .badge { font-size: 9px; }
  .history-row b { color: var(--ink); font-weight: 700; }
  @media (max-width: 900px) {
    .shell { grid-template-columns: 1fr; }
    .rail { position: static; max-height: none; }
    .case-list { display: grid; grid-template-columns: 1fr 1fr; }
    .states { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) { .case-list { grid-template-columns: 1fr; } .top { display: block; } .model { text-align: left; margin-top: 12px; } }
</style>
</head>
<body>
<header class="top">
  <div>
    <span class="live">Live engine</span>
    <h1>Proactivity, in action</h1>
    <p>Pick a scenario, change the state if you like, and evaluate it. Every result on this page is a fresh model call — no canned answers.</p>
  </div>
  <div class="model"><b id="model"></b>structured OpenRouter evaluation<br />synthetic fixtures</div>
</header>
<main class="shell">
  <aside class="rail">
    <h2>Scenarios <span class="muted" id="count"></span></h2>
    <div class="case-list" id="case-list"></div>
  </aside>
  <section class="stage">
    <div class="stage-head">
      <div>
        <span class="chip" id="category"></span>
        <h2 id="title"></h2>
        <p class="goal" id="goal"></p>
      </div>
      <span class="badge" id="expected"></span>
    </div>
    <p class="trigger" id="trigger"></p>
    <div class="states">
      <div class="state"><h3>Before</h3><div id="before"></div></div>
      <div class="state">
        <h3>After <button id="edit">Edit state</button><button id="reset">Reset</button></h3>
        <div id="after"></div>
        <textarea id="after-json" spellcheck="false"></textarea>
      </div>
    </div>
    <div class="actions">
      <button id="evaluate">Evaluate now</button>
      <span id="status">Ready.</span>
    </div>
    <div class="result" id="result"></div>
    <div class="history"><h3>This session</h3><div class="history-list" id="history"></div></div>
  </section>
</main>
<script>
var CASES = ${payload};
var state = { selected: null, editing: false, history: [] };
var els = {
  list: document.getElementById('case-list'), count: document.getElementById('count'),
  category: document.getElementById('category'), title: document.getElementById('title'),
  goal: document.getElementById('goal'), expected: document.getElementById('expected'),
  trigger: document.getElementById('trigger'), before: document.getElementById('before'),
  after: document.getElementById('after'), json: document.getElementById('after-json'),
  evaluate: document.getElementById('evaluate'), status: document.getElementById('status'),
  result: document.getElementById('result'), history: document.getElementById('history'),
  edit: document.getElementById('edit'), reset: document.getElementById('reset'),
  model: document.getElementById('model')
};
els.model.textContent = ${JSON.stringify(model)};

function esc(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
  });
}
function humanize(key) { return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(); }
function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > 180 ? value.slice(0, 177) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map(formatItem).join(', ');
  if (typeof value === 'object') {
    return Object.keys(value).map(function (key) { return humanize(key) + ': ' + formatValue(value[key]); }).join(' · ');
  }
  return String(value);
}
function formatItem(value) {
  if (value && typeof value === 'object' && typeof value.name === 'string') {
    return value.amount === undefined ? value.name : value.name + ' (' + formatValue(value.amount) + ')';
  }
  return formatValue(value);
}
function facts(snapshot) {
  if (!snapshot.evidence.length) return '<p class="muted">No evidence yet.</p>';
  return snapshot.evidence.map(function (item) {
    var rows = Object.keys(item.facts).map(function (key) {
      var sensitive = key.toLowerCase().indexOf('private') >= 0;
      var value = sensitive ? '<span class="redacted">[redacted]</span>' : esc(formatValue(item.facts[key]));
      return '<dt>' + esc(humanize(key)) + '</dt><dd>' + value + '</dd>';
    }).join('');
    return '<span class="evid">' + esc(item.id) + '</span><dl class="facts">' + rows + '</dl>';
  }).join('');
}
function triggerText(input) {
  if (input.trigger.kind === 'critical-change') return 'Critical change · ' + input.trigger.changedDomains.join(', ') + ' · ' + new Date(input.trigger.occurredAt).toLocaleDateString('en-GB');
  if (input.trigger.kind === 'scheduled-pass') return 'Scheduled pass · ' + new Date(input.trigger.asOf).toLocaleDateString('en-GB');
  return 'Weekly summary · ' + new Date(input.trigger.asOf).toLocaleDateString('en-GB');
}
function renderList() {
  els.count.textContent = '(' + CASES.length + ')';
  els.list.innerHTML = CASES.map(function (input) {
    return '<button data-id="' + esc(input.id) + '"><span>' + esc(input.title) + '</span><span class="cat">' + esc(input.category) + '</span></button>';
  }).join('');
  Array.prototype.forEach.call(els.list.querySelectorAll('button'), function (button) {
    button.addEventListener('click', function () { select(button.dataset.id); });
  });
}
function select(id) {
  var input = CASES.filter(function (candidate) { return candidate.id === id; })[0];
  if (!input) return;
  state.selected = input;
  state.editing = false;
  els.json.style.display = 'none';
  els.after.style.display = 'block';
  els.edit.textContent = 'Edit state';
  els.category.textContent = input.category;
  els.title.textContent = input.goal.title;
  els.goal.textContent = 'Goal · ' + input.goal.domains.join(', ');
  els.expected.className = 'badge ' + input.expected.decision;
  els.expected.textContent = 'Target: ' + input.expected.decision;
  els.trigger.textContent = triggerText(input);
  els.before.innerHTML = facts(input.previous);
  els.after.innerHTML = facts(input.current);
  els.json.value = JSON.stringify(input.current, null, 2);
  els.result.innerHTML = '';
  els.status.textContent = 'Ready.';
  els.status.className = '';
  Array.prototype.forEach.call(els.list.querySelectorAll('button'), function (button) {
    button.setAttribute('aria-current', String(button.dataset.id === id));
  });
}
function parseCurrent() {
  return JSON.parse(els.json.value);
}
function toggleEdit() {
  if (state.editing) {
    try {
      var parsed = parseCurrent();
      els.after.innerHTML = facts(parsed);
      state.editing = false;
      els.json.style.display = 'none';
      els.after.style.display = 'block';
      els.edit.textContent = 'Edit state';
      els.status.textContent = 'State updated.';
      els.status.className = '';
    } catch (error) {
      els.status.textContent = 'Fix the JSON first: ' + error.message;
      els.status.className = 'error';
    }
    return;
  }
  state.editing = true;
  els.json.style.display = 'block';
  els.after.style.display = 'none';
  els.edit.textContent = 'Done editing';
  els.status.textContent = 'Editing the current state.';
  els.status.className = '';
}
function reset() {
  els.json.value = JSON.stringify(state.selected.current, null, 2);
  els.after.innerHTML = facts(state.selected.current);
  state.editing = false;
  els.json.style.display = 'none';
  els.after.style.display = 'block';
  els.edit.textContent = 'Edit state';
  els.status.textContent = 'Reset to the original state.';
  els.status.className = '';
}
function badge(kind) {
  return '<span class="badge ' + esc(kind) + '">' + esc(kind) + '</span>';
}
function showResult(result) {
  var kind = result.actual;
  var html = '<div class="result-card"><div class="result-head">' + badge(kind);
  var matched = kind === result.expected;
  html += '<span class="match ' + (matched ? 'ok' : 'bad') + '">' + (matched ? 'matches the target' : 'target was ' + esc(result.expected)) + '</span>';
  html += '</div>';
  if (result.decision) {
    if (result.decision.kind === 'propose') {
      html += '<p class="summary">' + esc(result.decision.summary) + '</p>';
      html += '<p class="reason">' + esc(result.decision.reason) + '</p>';
      html += '<div class="next"><b>One safe next step</b>' + esc(result.decision.nextStep) + '</div>';
    } else {
      html += '<p class="summary">' + esc(result.decision.kind === 'defer' ? 'Deferred' : 'Quiet') + '</p>';
      html += '<p class="reason">' + esc(result.decision.reason) + '</p>';
    }
    html += '<div class="evidence">' + result.decision.evidenceIds.map(function (id) { return '<span>' + esc(id) + '</span>'; }).join('') + '</div>';
  } else {
    html += '<p class="summary">Evaluation error</p><p class="reason">' + esc(result.error || 'The model did not return a decision.') + '</p>';
  }
  var proposal = (result.deliveryIntents || []).filter(function (intent) { return intent.kind === 'goal-proposal'; })[0];
  if (proposal) {
    html += '<div class="delivery"><span class="label">What the user would receive</span><strong>' + esc(proposal.subject) + '</strong><p>' + esc(proposal.body) + '</p></div>';
  } else {
    html += '<div class="delivery withheld"><span class="label">Delivery withheld</span>' + (kind === 'error' ? 'No decision, so no message.' : 'No email or notification was sent.') + '</div>';
  }
  html += '<p class="meta">' + esc(String(result.latencyMs)) + ' ms · live model call</p>';
  if (result.failures && result.failures.length) html += '<p class="failures">' + esc(result.failures.join(' ')) + '</p>';
  html += '</div>';
  els.result.innerHTML = html;
}
function addHistory(result) {
  state.history.unshift(result);
  state.history = state.history.slice(0, 8);
  els.history.innerHTML = state.history.map(function (entry) {
    var matched = entry.actual === entry.expected;
    return '<div class="history-row">' + badge(entry.actual) + '<b>' + esc(entry.caseId) + '</b><span>' + (matched ? 'match' : 'target ' + esc(entry.expected)) + '</span><span>' + esc(String(entry.latencyMs)) + ' ms</span></div>';
  }).join('');
}
function evaluate() {
  var current;
  try {
    current = parseCurrent();
  } catch (error) {
    els.status.textContent = 'Fix the JSON first: ' + error.message;
    els.status.className = 'error';
    return;
  }
  els.evaluate.disabled = true;
  els.status.textContent = 'Calling the model…';
  els.status.className = '';
  els.result.innerHTML = '<p class="muted">Waiting for a live decision…</p>';
  fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ caseId: state.selected.id, current: current })
  }).then(function (response) {
    return response.json().then(function (data) { return { ok: response.ok, data: data }; });
  }).then(function (payload) {
    if (!payload.ok) throw new Error(payload.data.error || 'Evaluation failed.');
    els.after.innerHTML = facts(current);
    showResult(payload.data.result);
    addHistory(payload.data.result);
    els.status.textContent = 'Live result.';
    els.status.className = '';
  }).catch(function (error) {
    els.result.innerHTML = '<p class="failures">' + esc(error.message) + '</p>';
    els.status.textContent = 'Failed.';
    els.status.className = 'error';
  }).finally(function () {
    els.evaluate.disabled = false;
  });
}

els.edit.addEventListener('click', toggleEdit);
els.reset.addEventListener('click', reset);
els.evaluate.addEventListener('click', evaluate);
renderList();
select(CASES[0].id);
</script>
</body>
</html>`;
}
