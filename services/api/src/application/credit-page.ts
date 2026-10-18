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
:root{--bg:#fcfcfd;--card:#f9f9fb;--panel:#f0f0f3;--ink:#1c2024;--ink2:#70747c;--ink3:#8b8d98;--line:#cdced6;--acc:#0f9e84;--acc-ink:#fff;--warn:#a05a00;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111113;--card:#18191b;--panel:#212225;--ink:#edeef0;--ink2:#b0b4ba;--ink3:#80858c;--line:#43484e;--acc:#8ff0dc;--acc-ink:#06241d;--warn:#f2c668;color-scheme:dark}}
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
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

function shell(title: string, nonce: string, body: string, script = ''): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main>${body}</main>${
    script ? `<script nonce="${nonce}">${script}</script>` : ''
  }</body></html>`;
}

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
<label class="consent"><input type="checkbox" id="consent"><span>Use my credit straight away. I know I can't cancel it afterwards.</span></label>
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

export function donePage(nonce: string): string {
  return shell(
    'Credit added',
    nonce,
    `<span class="badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span><h1>Thank you</h1><p class="sub">We're checking your payment. For a UK card, your credit shows in Thames within a minute and a receipt is emailed to you. A card or address outside the UK is refunded in full.</p><a class="back quiet" href="/auth/settings?app=1">Back to account</a>`,
  );
}

export function cancelledPage(nonce: string): string {
  return shell(
    'Nothing charged',
    nonce,
    `<span class="badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 12h12"/></svg></span><h1>No payment made</h1><p class="sub">You were not charged.</p><a class="back quiet" href="/auth/settings?app=1">Back to account</a>`,
  );
}

export function problemPage(nonce: string, message: string): string {
  return shell(
    'Add Thames credit',
    nonce,
    `<h1>Add credit</h1><p class="sub">${escapeHtml(message)}</p>`,
  );
}
