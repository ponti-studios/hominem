import { pageFrame } from './styles.generated';

type PageFrameProps = {
  children: unknown;
  wide?: boolean;
  script?: string;
  title?: string;
};

export function PageFrame({
  children,
  wide = false,
  script = '/login.js',
  title = 'Secure access | Hominem',
}: PageFrameProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="#fcfcfd" media="(prefers-color-scheme: light)" name="theme-color" />
        <meta content="#111113" media="(prefers-color-scheme: dark)" name="theme-color" />
        <title>{title}</title>
        <link href="/login.css?v=ai-usage-3" rel="stylesheet" />
        <script defer src={script} />
      </head>
      <body>
        <div class={pageFrame.authPage}>
          <div aria-hidden="true" class={pageFrame.authGrid} />
          <main class={`${pageFrame.authLayout}${wide ? ` ${pageFrame.authLayoutWide}` : ''}`}>
            <a aria-label="Hominem" class={pageFrame.brandLockup} href="https://hominem.app">
              <img
                alt=""
                class={pageFrame.brandLogo}
                height="28"
                src="/logo.hominem.500x500.webp"
                width="28"
              />
              <span>Hominem</span>
            </a>
            <section class={`${pageFrame.authCard}${wide ? ` ${pageFrame.authCardWide}` : ''}`}>
              {children}
            </section>
          </main>
        </div>
      </body>
    </html>
  );
}
