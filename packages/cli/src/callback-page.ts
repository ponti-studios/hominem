// The page the browser lands on after sign-in. Self-contained (it's served from a throwaway
// loopback server) and matched to the monochrome Hominem account pages. Fixed text only: nothing
// from the redirect's query string ever gets echoed back into it.

export type SignInProvider = 'Google' | 'Hominem';

const COPY = {
  ok: {
    Hominem: {
      title: 'You’re signed in',
      body: 'The Hominem CLI is connected to your account.',
    },
    Google: { title: 'Google is connected', body: 'The Hominem CLI can use your Google account.' },
    next: 'Close this tab and head back to your terminal.',
    status: 'Complete',
    mark: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  },
  fail: {
    Hominem: { title: 'Sign-in didn’t go through', body: 'Nothing was connected.' },
    Google: { title: 'Google didn’t connect', body: 'Nothing was connected.' },
    next: 'Check your terminal for the reason, then close this tab and try again.',
    status: 'Failed',
    mark: '<path d="M7 7l10 10M17 7L7 17"/>',
  },
} as const;

const STYLE = `
:root{--bg:#fff;--ink:#0a0a0a;--muted:#5c5c5c;--line:#e0e0e0;--bad:#8a2b22;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f0f;--ink:#f2f2f2;--muted:#a3a3a3;--line:#2e2e2e;--bad:#ffb3aa;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;padding:32px 24px 48px;background:var(--bg);color:var(--ink);font:17px/1.5 'Hanken Grotesk',system-ui,-apple-system,Arial,sans-serif}
header,main{width:100%;max-width:560px;margin:0 auto}
header{display:flex;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--line)}
.mono{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
header strong{font-size:13px;letter-spacing:.08em}
header span{color:var(--muted)}
main{margin-block:auto;padding:48px 0 80px}
.mark{display:grid;place-items:center;width:56px;height:56px;margin-bottom:32px;background:var(--ink);color:var(--bg)}
.fail .mark{background:var(--bad)}
.mark svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:square}
h1{margin:0 0 16px;font-size:clamp(40px,9vw,64px);font-weight:500;letter-spacing:-.05em;line-height:1}
p{margin:0;color:var(--muted)}
.next{margin-top:32px;padding-top:20px;border-top:1px solid var(--line);color:var(--ink)}
`;

export function callbackPage(outcome: 'ok' | 'fail', provider: SignInProvider): string {
  const { next, status, mark, [provider]: copy } = COPY[outcome];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${copy.title} · Hominem</title>
<style>${STYLE}</style>
</head>
<body class="${outcome}">
<header class="mono"><strong>Hominem</strong><span>CLI sign-in · ${status}</span></header>
<main>
<div class="mark" aria-hidden="true"><svg viewBox="0 0 24 24">${mark}</svg></div>
<h1>${copy.title}</h1>
<p>${copy.body}</p>
<p class="next">${next}</p>
</main>
</body>
</html>
`;
}
