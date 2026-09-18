import { loginAssets, type LoginEntry } from './assets';

// Server shell for the client-rendered auth UI: renders the document head,
// a JSON blob of initial props on window.__AUTH_INIT__, and the React mount
// point. The React entry then reads __AUTH_INIT__ and renders the page.
// All form POSTs and redirect handling stay on the server routes.

function escapeScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderAuthShell(input: { entry: LoginEntry; init?: unknown; title: string }) {
  const assets = loginAssets(input.entry);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="#fcfcfd" media="(prefers-color-scheme: light)" name="theme-color" />
        <meta content="#111113" media="(prefers-color-scheme: dark)" name="theme-color" />
        <title>{input.title}</title>
        {assets.styles.map((href) => (
          <link href={href} rel="stylesheet" />
        ))}
        {input.init !== undefined ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__AUTH_INIT__=${escapeScript(input.init)};`,
            }}
          />
        ) : null}
        {assets.scripts.map((src) => (
          <script defer src={src} type="module" />
        ))}
      </head>
      <body>
        <div id="root" />
      </body>
    </html>
  );
}
