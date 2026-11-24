#!/usr/bin/env node
/**
 * Local dashboard for the launchd user services this studio runs (the
 * per-worktree dev stacks and anything else under com.ponti.*). Lists state,
 * tails each service's StandardOutPath, restarts live services, and reaps
 * stale ones whose worktree no longer exists — a Docker Desktop-shaped panel
 * for launchd.
 *
 * Dependency-free on purpose: the installer copies this file to
 * ~/.hominem/dev-dashboard/ so the dashboard survives any worktree being
 * deleted. Localhost only; never executes arbitrary labels.
 */
import { execFile } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PORT = Number(process.env.DEV_DASHBOARD_PORT ?? 4599);
const AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents');
const LABEL_PREFIX = 'com.ponti.';
const DOMAIN = `gui/${process.getuid?.() ?? 501}`;
const TAIL_WINDOW = 256 * 1024;

function readPlist(path) {
  return exec('plutil', ['-convert', 'json', '-o', '-', path])
    .then(({ stdout }) => JSON.parse(stdout))
    .catch(() => null);
}

async function serviceStatus(label) {
  try {
    const { stdout } = await exec('launchctl', ['print', `${DOMAIN}/${label}`]);
    const state = /^\s*state = (\w+)/m.exec(stdout)?.[1];
    const pid = Number(/^\s*pid = (\d+)/m.exec(stdout)?.[1] ?? 0) || null;
    const exitMatch = /last exit code = (\d+)/.exec(stdout);
    return {
      state: state === 'running' ? 'running' : state ? 'loaded' : 'stopped',
      pid,
      lastExitCode: exitMatch ? Number(exitMatch[1]) : null,
    };
  } catch {
    return { state: 'stopped', pid: null, lastExitCode: null };
  }
}

/** Extracts the worktree path from the installer's `cd "<path>"` command. */
function worktreeFromPlist(plist) {
  const args = Array.isArray(plist?.ProgramArguments) ? plist.ProgramArguments : [];
  const command = args.map(String).join(' ');
  return /cd "([^"]+)"/.exec(command)?.[1] ?? null;
}

async function listServices() {
  if (!existsSync(AGENTS_DIR)) return [];
  const services = [];
  for (const file of readdirSync(AGENTS_DIR).filter((name) => name.endsWith('.plist'))) {
    const plistPath = join(AGENTS_DIR, file);
    const plist = await readPlist(plistPath);
    const label = typeof plist?.Label === 'string' ? plist.Label : file.replace(/\.plist$/, '');
    if (!label.startsWith(LABEL_PREFIX)) continue;
    const logPath = typeof plist?.StandardOutPath === 'string' ? plist.StandardOutPath : null;
    const worktree = worktreeFromPlist(plist);
    const status = await serviceStatus(label);
    let logBytes = 0;
    if (logPath && existsSync(logPath)) {
      try {
        logBytes = statSync(logPath).size;
      } catch {
        logBytes = 0;
      }
    }
    services.push({
      label,
      name: label.slice(LABEL_PREFIX.length),
      ...status,
      plistPath,
      logPath,
      logExists: Boolean(logPath && existsSync(logPath)),
      logBytes,
      worktree,
      stale: Boolean(worktree && !existsSync(worktree)),
    });
  }
  return services.sort((a, b) => a.name.localeCompare(b.name));
}

/** Reads the tail of a file without loading the whole thing. */
async function tailLines(path, lines) {
  const size = statSync(path).size;
  const start = Math.max(0, size - TAIL_WINDOW);
  const chunks = [];
  await new Promise((resolve, reject) => {
    createReadStream(path, { start, end: size - 1 })
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', resolve)
      .on('error', reject);
  });
  const all = Buffer.concat(chunks).toString('utf8').split('\n');
  if (start > 0) all.shift();
  return { lines: all.slice(-lines), truncated: size > TAIL_WINDOW };
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Hominem dev services</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "JetBrains Mono", monospace; background: #020617; color: #e2e8f0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid #1e293b; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .dot.running { background: #34d399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.6); }
  .dot.loaded { background: #fbbf24; }
  .dot.stopped { background: #475569; }
  .dot.stale { background: #fb7185; box-shadow: 0 0 8px rgba(251, 113, 133, 0.6); }
  h1 { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .sub { color: #64748b; font-size: 0.65rem; }
  .main { display: flex; flex: 1; min-height: 0; }
  aside { width: 320px; border-right: 1px solid #1e293b; overflow-y: auto; flex: none; }
  .svc { width: 100%; padding: 0.6rem 0.9rem; border: 0; border-bottom: 1px solid rgba(30, 41, 59, 0.6); cursor: pointer; display: flex; gap: 0.6rem; align-items: center; background: transparent; color: inherit; font-family: inherit; text-align: left; }
  .svc:hover { background: rgba(30, 41, 59, 0.5); }
  .svc.active { background: rgba(30, 41, 59, 0.8); }
  .svc .meta { min-width: 0; flex: 1; }
  .svc .name { font-size: 0.75rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc .line { font-size: 0.6rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc .line.stale { color: #fb7185; }
  section { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .bar { display: flex; gap: 0.5rem; align-items: center; padding: 0.6rem 1rem; border-bottom: 1px solid #1e293b; flex-wrap: wrap; }
  .badge { font-size: 0.6rem; padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid; }
  .badge.running { color: #34d399; border-color: rgba(52, 211, 153, 0.5); background: rgba(6, 78, 59, 0.4); }
  .badge.loaded { color: #fbbf24; border-color: rgba(251, 191, 36, 0.5); background: rgba(120, 53, 15, 0.3); }
  .badge.stopped { color: #94a3b8; border-color: #334155; background: rgba(30, 41, 59, 0.5); }
  .badge.stale { color: #fb7185; border-color: rgba(251, 113, 133, 0.5); background: rgba(136, 19, 55, 0.4); }
  .kv { font-size: 0.62rem; color: #64748b; }
  .kv b { color: #cbd5e1; font-weight: 500; }
  button, input, select { font-family: inherit; font-size: 0.65rem; background: #0f172a; color: #cbd5e1; border: 1px solid #334155; border-radius: 0.35rem; padding: 0.25rem 0.55rem; }
  button { cursor: pointer; }
  button:hover { border-color: #475569; color: #fff; }
  button.restart { color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); }
  button.remove { color: #fb7185; border-color: rgba(251, 113, 133, 0.4); }
  button:disabled { opacity: 0.35; cursor: default; }
  input[type="text"] { width: 180px; }
  #log { flex: 1; overflow: auto; padding: 0.75rem 1rem; font-size: 0.68rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; color: #cbd5e1; }
  #log .err { color: #fb7185; }
  #log .warn { color: #fbbf24; }
  .hint { color: #475569; font-size: 0.65rem; padding: 1rem; }
</style>
</head>
<body>
<header>
  <span class="dot running"></span>
  <h1>Hominem dev services</h1>
  <span class="sub" id="summary">…</span>
</header>
<div class="main">
  <aside id="list"><p class="hint">Loading…</p></aside>
  <section>
    <div class="bar" id="bar" style="display:none">
      <span class="badge" id="state"></span>
      <span class="kv">pid <b id="pid">—</b></span>
      <span class="kv">exit <b id="exit">—</b></span>
      <span class="kv" id="paths"></span>
      <button class="restart" id="restart">restart</button>
      <button class="remove" id="remove" style="display:none">remove stale entry</button>
      <input type="text" id="filter" placeholder="filter log…" />
      <label class="kv"><input type="checkbox" id="pause" /> pause</label>
      <select id="lines">
        <option value="200">200 lines</option>
        <option value="400" selected>400 lines</option>
        <option value="1000">1000 lines</option>
        <option value="4000">4000 lines</option>
      </select>
    </div>
    <pre id="log">Select a service.</pre>
  </section>
</div>
<script>
  let services = [];
  let selected = null;
  let lastLogKey = '';

  const listEl = document.getElementById('list');
  const logEl = document.getElementById('log');
  const barEl = document.getElementById('bar');
  const summaryEl = document.getElementById('summary');
  const pauseEl = document.getElementById('pause');
  const filterEl = document.getElementById('filter');
  const linesEl = document.getElementById('lines');
  const el = (id) => document.getElementById(id);

  function renderList() {
    listEl.innerHTML = '';
    for (const svc of services) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'svc' + (selected === svc.label ? ' active' : '');
      row.onclick = () => { selected = svc.label; renderList(); renderBar(); refreshLog(true); };
      const dot = document.createElement('span');
      dot.className = 'dot ' + (svc.stale ? 'stale' : svc.state);
      const meta = document.createElement('div');
      meta.className = 'meta';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = svc.name;
      const line = document.createElement('div');
      line.className = 'line' + (svc.stale ? ' stale' : '');
      line.textContent = svc.stale
        ? 'stale — worktree deleted'
        : svc.state + (svc.pid ? ' · pid ' + svc.pid : '') + (svc.logExists ? ' · ' + Math.round(svc.logBytes / 1024) + 'k log' : ' · no log');
      meta.append(name, line);
      row.append(dot, meta);
      listEl.appendChild(row);
    }
    const running = services.filter((s) => s.state === 'running').length;
    const stale = services.filter((s) => s.stale).length;
    summaryEl.textContent = services.length + ' services · ' + running + ' running' + (stale ? ' · ' + stale + ' stale' : '') + ' · refresh 2s';
  }

  function current() { return services.find((s) => s.label === selected); }

  function renderBar() {
    const svc = current();
    if (!svc) { barEl.style.display = 'none'; return; }
    barEl.style.display = 'flex';
    el('state').className = 'badge ' + (svc.stale ? 'stale' : svc.state);
    el('state').textContent = svc.stale ? 'stale' : svc.state;
    el('pid').textContent = svc.pid ?? '—';
    el('exit').textContent = svc.lastExitCode ?? '—';
    el('paths').innerHTML = svc.logPath ? 'log <b>' + svc.logPath + '</b>' : 'log <b>none</b>';
    el('restart').disabled = svc.stale;
    el('restart').onclick = async () => {
      el('restart').disabled = true;
      await fetch('/api/restart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: svc.label }) });
      el('restart').disabled = false;
      refreshServices();
    };
    el('remove').style.display = svc.stale ? 'inline-block' : 'none';
    el('remove').onclick = async () => {
      await fetch('/api/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: svc.label }) });
      selected = null;
      refreshServices();
      refreshLog(true);
    };
  }

  async function refreshServices() {
    try {
      const res = await fetch('/api/services');
      services = await res.json();
      if (selected && !current()) selected = null;
      renderList();
      renderBar();
    } catch { /* server likely restarting */ }
  }

  function paint(lines) {
    const filter = filterEl.value.trim().toLowerCase();
    logEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const line of lines) {
      if (filter && !line.toLowerCase().includes(filter)) continue;
      const span = document.createElement('span');
      span.textContent = line + '\\n';
      if (/\\berror\\b|ERROR|✖|exception/i.test(line)) span.className = 'err';
      else if (/\\bwarn\\b|WARN|⚠/i.test(line)) span.className = 'warn';
      frag.appendChild(span);
    }
    logEl.appendChild(frag);
    if (!pauseEl.checked) logEl.scrollTop = logEl.scrollHeight;
  }

  async function refreshLog(force) {
    const svc = current();
    if (!svc) return;
    if (pauseEl.checked && !force) return;
    try {
      const res = await fetch('/api/logs?label=' + encodeURIComponent(svc.label) + '&lines=' + linesEl.value);
      const data = await res.json();
      const key = svc.label + ':' + data.mtime;
      if (!force && key === lastLogKey) return;
      lastLogKey = key;
      paint(data.lines);
    } catch {
      paint(['Failed to read log.']);
    }
  }

  filterEl.addEventListener('input', () => refreshLog(true));
  linesEl.addEventListener('change', () => refreshLog(true));
  pauseEl.addEventListener('change', () => { if (!pauseEl.checked) refreshLog(true); });

  refreshServices();
  setInterval(async () => { await refreshServices(); await refreshLog(false); }, 2000);
</script>
</body>
</html>`;

async function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const json = (body, status = 200) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  if (request.method === 'GET' && url.pathname === '/api/services') {
    return json(await listServices());
  }

  if (request.method === 'GET' && url.pathname === '/api/logs') {
    const label = url.searchParams.get('label') ?? '';
    const lines = Math.min(Math.max(Number(url.searchParams.get('lines') ?? 400), 10), 10_000);
    const svc = (await listServices()).find((entry) => entry.label === label);
    if (!svc || !svc.logPath || !svc.logExists) {
      return json({ lines: ['(no log file yet)'], mtime: 0 });
    }
    try {
      const tail = await tailLines(svc.logPath, lines);
      return json({ ...tail, mtime: statSync(svc.logPath).mtimeMs });
    } catch (error) {
      return json({ lines: [String(error)], mtime: 0 });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/restart') {
    let label = '';
    try {
      label = String(JSON.parse(await readBody(request)).label ?? '');
    } catch {
      label = '';
    }
    const svc = (await listServices()).find((entry) => entry.label === label);
    if (!svc || svc.stale) return json({ error: 'unknown or stale service' }, 404);
    try {
      await exec('launchctl', ['kickstart', '-k', `${DOMAIN}/${label}`]);
      return json({ ok: true });
    } catch (error) {
      return json({ error: String(error) }, 500);
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/remove') {
    let label = '';
    try {
      label = String(JSON.parse(await readBody(request)).label ?? '');
    } catch {
      label = '';
    }
    const svc = (await listServices()).find((entry) => entry.label === label);
    // Only stale entries are removable: this endpoint reaps leftovers, it is
    // not a general uninstall (live services are managed from their worktree).
    if (!svc || !svc.stale) return json({ error: 'only stale entries can be removed' }, 400);
    try {
      await exec('launchctl', ['bootout', `${DOMAIN}/${label}`]).catch(() => {});
      rmSync(svc.plistPath, { force: true });
      return json({ ok: true });
    } catch (error) {
      return json({ error: String(error) }, 500);
    }
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(page);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev services dashboard: http://127.0.0.1:${PORT}`);
});
