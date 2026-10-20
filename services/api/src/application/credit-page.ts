/**
 * The top-up page (option A in docs/prd/top-up.md): three amounts, the credit each gives, the
 * cancellation consent, and Pay. One self-contained HTML document with a nonce for its script.
 */
import { creditPenceFor, TOP_UP_POUNDS } from './credit';

export function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

const STYLE = `
:root{--bg:#fcfcfd;--card:#f9f9fb;--panel:#f0f0f3;--ink:#1c2024;--ink2:#70747c;--ink3:#8b8d98;--line:#cdced6;--acc:#0f9e84;--acc-ink:#fff;--warn:#a05a00;--ok:#1a9a58;--bad:#c13a45;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111113;--card:#18191b;--panel:#212225;--ink:#edeef0;--ink2:#b0b4ba;--ink3:#80858c;--line:#43484e;--acc:#8ff0dc;--acc-ink:#06241d;--warn:#f2c668;--ok:#34c77b;--bad:#d14b55;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"SF Pro Text",sans-serif;padding:max(28px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-left)) max(40px,env(safe-area-inset-bottom))}
main{max-width:480px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
h1{font-size:34px;font-weight:700;letter-spacing:-.6px;line-height:1.1;margin:4px 0 0}
.sub{color:var(--ink2);font-size:15px;margin:0}
.hero{display:grid;gap:4px;padding:18px 20px;border:1px solid color-mix(in srgb,var(--acc) 28%,var(--line));border-radius:24px;background:radial-gradient(120% 90% at 0% 0%,color-mix(in srgb,var(--acc) 18%,transparent),transparent 70%),var(--card)}
.hero .l{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.hero .n{font-size:44px;font-weight:700;letter-spacing:-1px;line-height:1.05;font-variant-numeric:tabular-nums}
.tiers{display:flex;flex-direction:column;gap:10px}
.tier{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px 18px;cursor:pointer;transition:border-color .15s,background .15s}
.tier .p{font-size:22px;font-weight:700}.tier .c{font-size:14px;color:var(--ink2);font-variant-numeric:tabular-nums}
.tier[aria-pressed=true]{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,var(--card))}.tier[aria-pressed=true] .c{color:var(--acc)}
details{font-size:13px;color:var(--ink3)}summary{cursor:pointer;color:var(--ink2)}
dl{display:grid;grid-template-columns:1fr auto;gap:6px 10px;font-size:13px;margin:10px 0 0;padding:12px 14px;border-radius:16px;background:var(--card);border:1px solid var(--line);font-variant-numeric:tabular-nums}dt{color:var(--ink3)}dd{margin:0;color:var(--ink2);text-align:right}
.consent{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:var(--ink2);line-height:1.4}.consent input{margin-top:2px;accent-color:var(--acc);width:18px;height:18px;flex:none}
.pay,.back{display:block;font:inherit;font-weight:700;font-size:16px;color:var(--acc-ink);background:var(--acc);border:0;border-radius:999px;padding:15px 16px;width:100%;text-align:center;text-decoration:none;cursor:pointer;transition:opacity .15s,transform .15s}
.pay:active,.back:active{transform:scale(.98)}
button.pay:disabled{opacity:.4;cursor:default}
.back.quiet{color:var(--ink);background:var(--card);border:1px solid var(--line)}
.fine{font-size:12.5px;color:var(--ink3);line-height:1.5;margin:0}.err{color:var(--warn);font-size:13px;min-height:1.2em;margin:0}
.badge{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:color-mix(in srgb,var(--acc) 16%,transparent);color:var(--acc)}
.badge svg{width:28px;height:28px}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.stage{display:grid;place-items:center;padding:8px 0 0}.stage svg{width:208px;height:208px;overflow:visible}
.center{text-align:center;display:grid;gap:6px;justify-items:center}
.tag{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}
.num{font-size:44px;font-weight:700;letter-spacing:-1px;line-height:1.05;font-variant-numeric:tabular-nums;display:inline-block;min-width:6.4ch;text-align:center}
.num.pending{color:var(--ink3)}
.plus{font-size:14px;font-weight:600;color:var(--ok)}
.track{fill:none;stroke:var(--ink);stroke-opacity:.1;stroke-width:2.4}
.ring{fill:none;stroke-width:2.4;stroke-linecap:round;transform:rotate(-90deg);transform-origin:66px 66px}
.ring.sweep{animation:sweep 1.3s .15s cubic-bezier(.3,.7,.2,1) both}
@keyframes sweep{from{stroke-dasharray:0 100}to{stroke-dasharray:100 100}}
.breathe{transform-origin:66px 66px;animation:breathe 2.4s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(.95);opacity:.8}}
.orbit{transform-origin:66px 66px;animation:orbit 2.4s linear infinite}
@keyframes orbit{to{transform:rotate(360deg)}}
.dot{animation:blink 1.2s ease-in-out infinite}
@keyframes blink{50%{opacity:.25}}
.settle{transform-origin:66px 66px;animation:settle .6s ease-out both}
@keyframes settle{from{transform:scale(1.06);opacity:.5}to{transform:scale(1);opacity:1}}
.stop *{animation:none!important}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

function shell(title: string, nonce: string, body: string, script = ''): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main>${body}</main>${
    script ? `<script nonce="${nonce}">${script}</script>` : ''
  }</body></html>`;
}

/** The orb on the 132-unit grid the app uses: glow, thin credit ring, core and glyph. */
type OrbKind = 'wait' | 'added' | 'failed';

function orb(kind: OrbKind, label: string): string {
  const glyph = {
    wait: '<g fill="#fff"><circle class="dot" cx="54" cy="66" r="3.4"/><circle class="dot" style="animation-delay:.2s" cx="66" cy="66" r="3.4"/><circle class="dot" style="animation-delay:.4s" cx="78" cy="66" r="3.4"/></g>',
    added:
      '<path d="m50 67 11 11 22-23" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>',
    failed:
      '<path d="m54 54 24 24M78 54 54 78" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>',
  }[kind];
  const mint = '#8ff0dc';
  const colours = {
    wait: { glow: mint, core: '#17947f' },
    added: { glow: 'var(--ok)', core: '#17947f' },
    failed: { glow: 'var(--bad)', core: '#d14b55' },
  }[kind];
  const ring =
    kind === 'added'
      ? '<circle class="ring sweep" cx="66" cy="66" r="61" pathLength="100" stroke="var(--ok)" stroke-opacity=".55" stroke-dasharray="100 100"/>'
      : kind === 'failed'
        ? '<circle class="ring" cx="66" cy="66" r="61" pathLength="100" stroke="var(--bad)" stroke-opacity=".55" stroke-dasharray="100 100"/>'
        : '<g class="orbit"><circle cx="66" cy="5" r="3.4" fill="#8ff0dc"/></g>';
  const core = `<circle cx="66" cy="66" r="42" fill="${colours.core}"/>`;
  const body = kind === 'wait' ? `<g class="breathe">${core}</g>` : `<g class="settle">${core}</g>`;
  return `<div class="stage"><svg viewBox="0 0 132 132" role="img" aria-label="${escapeHtml(label)}"><circle cx="66" cy="66" r="64" fill="${colours.glow}" opacity=".08"/><circle class="track" cx="66" cy="66" r="61"/>${ring}${body}${glyph}</svg></div>`;
}

const BACK = '<a class="back quiet" href="/auth/settings?app=1">Back to account</a>';

export function creditCsp(nonce: string): string {
  return `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
}

export function topUpPage(input: {
  nonce: string;
  token: string;
  balancePence: number;
  testMode: boolean;
}): string {
  const tiers = TOP_UP_POUNDS.map((pound) => {
    const price = pound * 100;
    const credit = creditPenceFor(price);
    const fee = Math.round(price * 0.015) + 20;
    return { pound, price, credit, fee, provider: price - fee - 100 - credit };
  });
  const rows = tiers
    .map(
      (t) =>
        `<button type="button" class="tier" data-pound="${t.pound}" aria-pressed="${t.pound === 20}"><span class="p">£${t.pound}</span><span class="c">${pounds(t.credit)} of credit</span></button>`,
    )
    .join('');
  const data = JSON.stringify(
    Object.fromEntries(
      tiers.map((t) => [
        t.pound,
        {
          pay: pounds(t.price),
          fee: pounds(t.fee),
          provider: pounds(t.provider),
          credit: pounds(t.credit),
        },
      ]),
    ),
  ).replace(/</g, '\\u003c');
  const body = `
<h1>Add credit</h1>
<div class="hero"><span class="l">You have</span><span class="n">${pounds(input.balancePence)}</span></div>
${input.testMode ? '<p class="sub">Test mode: use a Stripe test card, no money moves.</p>' : ''}
<div class="tiers" role="group" aria-label="Amount">${rows}</div>
<details><summary>How is this worked out?</summary><dl id="how"></dl></details>
<label class="consent"><input type="checkbox" id="consent"><span>Add my credit as soon as I've paid. I understand that once it's added, I lose my 14-day right to cancel.</span></label>
<p class="err" id="err" role="status"></p>
<button type="button" class="pay" id="pay" disabled>Pay £20</button>
<a class="back quiet" href="/auth/settings?app=1">Back to account</a>
<p class="fine">Credit works only in Thames and doesn't expire. Not refundable except where the law requires. UK cards and addresses only. Card and Apple Pay, through Stripe.</p>`;
  const script = `
var D=${data},T=${JSON.stringify(input.token)},sel=20;
var pay=document.getElementById('pay'),box=document.getElementById('consent'),err=document.getElementById('err');
function draw(){
  document.querySelectorAll('.tier').forEach(function(b){b.setAttribute('aria-pressed',String(Number(b.dataset.pound)===sel))});
  var d=D[sel];
  document.getElementById('how').innerHTML='<dt>You pay</dt><dd>'+d.pay+'</dd><dt>Card fee</dt><dd>'+d.fee+'</dd><dt>Thames</dt><dd>£1.00</dd><dt>Model provider fee</dt><dd>'+d.provider+'</dd><dt>Your credit</dt><dd>'+d.credit+'</dd>';
  pay.textContent='Pay '+d.pay.replace('.00','');
  pay.disabled=!box.checked;
}
document.querySelectorAll('.tier').forEach(function(b){b.addEventListener('click',function(){sel=Number(b.dataset.pound);draw()})});
box.addEventListener('change',draw);
pay.addEventListener('click',function(){
  pay.disabled=true;err.textContent='';
  fetch('/credit/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:T,amountPounds:sel,consent:box.checked})})
    .then(function(r){return r.json().then(function(j){if(!r.ok||!j.url)throw new Error(j.error||'failed');return j})})
    .then(function(j){location.href=j.url})
    .catch(function(){err.textContent='That did not work. Try again in a moment.';draw()});
});
draw();`;
  return shell('Add Thames credit', input.nonce, body, script);
}

/**
 * Where Stripe sends a person after paying. With a signed link and the Checkout session id the page
 * asks /credit/status until the webhook has credited the payment, then shows the new balance;
 * without them it says the credit will show in Thames.
 */
export function donePage(nonce: string, live: { token: string; sessionId: string } | null): string {
  const waiting = `<div data-state="wait">${orb('wait', 'Confirming your payment')}<div class="center"><span class="tag">Confirming</span><span class="num pending" id="scram">£00.00</span><p class="sub">You can close this page. Your credit appears in Thames and we email you.</p></div></div>`;
  const added = `<div data-state="added" hidden>${orb('added', 'Credit added')}<div class="center"><span class="tag">You have</span><span class="num" id="bal">£0.00</span><span class="plus" id="plus"></span><p class="sub">A receipt is on its way to your email.</p></div></div>`;
  const refunded = `<div data-state="refunded" hidden>${orb('failed', 'Payment not taken')}<div class="center"><span class="tag">Not charged</span><p class="sub">Thames credit is for UK cards and addresses only. If your bank shows a pending amount, it is released within a few days.</p></div></div>`;
  const slow = `<div data-state="slow"${live ? ' hidden' : ''}>${orb('wait', 'Still confirming')}<div class="center"><span class="tag">Still confirming</span><p class="sub">Your card has not been charged yet. Once confirmed, your credit appears in Thames and we email you. If it cannot be confirmed, the hold on your card is released.</p></div></div>`;
  const body = live ? `${waiting}${added}${refunded}${slow}${BACK}` : `${slow}${BACK}`;
  const script = live
    ? `
var T=${JSON.stringify(live.token)},S=${JSON.stringify(live.sessionId)};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function show(n){document.querySelectorAll('[data-state]').forEach(function(e){e.hidden=e.dataset.state!==n})}
function gbp(p){return '£'+(p/100).toFixed(2)}
function d(){return Math.floor(Math.random()*10)}
var sc=document.getElementById('scram'),spin=null;
if(reduce){sc.textContent='£––.––'}else{spin=setInterval(function(){sc.textContent='£'+d()+d()+'.'+d()+d()},70)}
function count(el,from,to){
  if(reduce){el.textContent=gbp(to);return}
  var t0=performance.now();
  (function f(now){var k=Math.min(1,(now-t0)/900),e=1-Math.pow(1-k,3);el.textContent=gbp(from+(to-from)*e);if(k<1)requestAnimationFrame(f)})(t0);
}
var started=Date.now(),timer=null;
function stop(){clearInterval(spin);clearTimeout(timer)}
function poll(){
  fetch('/credit/status?t='+encodeURIComponent(T)+'&s='+encodeURIComponent(S),{cache:'no-store'})
    .then(function(r){return r.ok?r.json():null})
    .then(function(j){
      if(j&&j.state==='credited'){
        stop();show('added');
        document.getElementById('plus').textContent='+ '+gbp(j.creditPence)+' added';
        count(document.getElementById('bal'),Math.max(0,j.balancePence-j.creditPence),j.balancePence);
        return}
      if(j&&j.state==='refunded'){stop();show('refunded');return}
      next();
    }).catch(next);
}
function next(){
  if(Date.now()-started>60000){stop();show('slow');document.querySelector('[data-state=slow] svg').parentNode.classList.add('stop');return}
  timer=setTimeout(poll,1500);
}
poll();`
    : '';
  return shell('Credit added', nonce, body, script);
}

export function cancelledPage(
  nonce: string,
  link: { token: string; balancePence: number | null } | null,
): string {
  const again = link
    ? `<a class="back" href="/credit?t=${escapeHtml(encodeURIComponent(link.token))}">Try again</a>`
    : '';
  const balance =
    link && link.balancePence !== null
      ? `<span class="num">${pounds(link.balancePence)}</span>`
      : '';
  return shell(
    'Nothing charged',
    nonce,
    `${orb('failed', 'No payment made')}<div class="center"><span class="tag">No payment made</span>${balance}<p class="sub">You were not charged.</p></div>${again}${BACK}`,
  );
}

export function problemPage(nonce: string, message: string): string {
  return shell(
    'Add Thames credit',
    nonce,
    `<h1>Add credit</h1><p class="sub">${escapeHtml(message)}</p>`,
  );
}
