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
:root{--bg:#07100f;--card:#0e1b19;--ink:#eef5f2;--ink2:#9db3ad;--ink3:#6e8782;--mint:#8ff0dc;--teal:#17947f;--line:#ffffff14;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 ui-rounded,"SF Pro Rounded",system-ui,sans-serif;padding:24px max(18px,env(safe-area-inset-left)) 40px}
main{max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
h1{font-size:24px;margin:0}
.sub{color:var(--ink2);font-size:14px;margin:0}
.have{color:var(--ink2);font-size:14px}.have b{font-family:ui-monospace,Menlo,monospace;font-weight:500;color:var(--ink)}
.tiers{display:flex;flex-direction:column;gap:10px}
.tier{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;cursor:pointer}
.tier .p{font-size:20px;font-weight:700}.tier .c{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:var(--ink2)}
.tier[aria-pressed=true]{border-color:var(--mint);background:#8ff0dc14}.tier[aria-pressed=true] .c{color:var(--mint)}
details{font-size:12.5px;color:var(--ink3)}summary{cursor:pointer;color:var(--ink2)}
dl{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-family:ui-monospace,Menlo,monospace;font-size:12px;margin:8px 0 0}dt{color:var(--ink3)}dd{margin:0;color:var(--ink2);text-align:right}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--ink2);line-height:1.4}.consent input{margin-top:3px;accent-color:var(--teal);width:16px;height:16px;flex:none}
button.pay{font:inherit;font-weight:600;font-size:16px;color:#07100f;background:var(--mint);border:0;border-radius:14px;padding:14px 16px;width:100%;cursor:pointer}
button.pay:disabled{opacity:.45;cursor:default}
.fine{font-size:12px;color:var(--ink3);line-height:1.45;margin:0}.err{color:#f2c668;font-size:13px;min-height:1.2em;margin:0}
:focus-visible{outline:2px solid var(--mint);outline-offset:2px}
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
<p class="have">You have <b>${pounds(input.balancePence)}</b></p>
<h1>Add credit</h1>
${input.testMode ? '<p class="sub">Test mode: use a Stripe test card, no money moves.</p>' : ''}
<div class="tiers" role="group" aria-label="Amount">${rows}</div>
<details><summary>How is this worked out?</summary><dl id="how"></dl></details>
<label class="consent"><input type="checkbox" id="consent"><span>Use my credit straight away. I know I can't cancel it afterwards.</span></label>
<p class="err" id="err" role="status"></p>
<button type="button" class="pay" id="pay" disabled>Pay £20</button>
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
    `<h1>Thank you</h1><p class="sub">We're checking your payment. For a UK card, your credit shows in Thames within a minute and a receipt is emailed to you. A card or address outside the UK is refunded in full.</p>`,
  );
}

export function cancelledPage(nonce: string): string {
  return shell(
    'Nothing charged',
    nonce,
    `<h1>No payment made</h1><p class="sub">You were not charged.</p>`,
  );
}

export function problemPage(nonce: string, message: string): string {
  return shell(
    'Add Thames credit',
    nonce,
    `<h1>Add credit</h1><p class="sub">${escapeHtml(message)}</p>`,
  );
}
