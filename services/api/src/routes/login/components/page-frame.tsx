import { loginAssets, type LoginEntry } from '../assets';
import { pageFrame } from '../styles';

type PageFrameProps = {
  children: unknown;
  wide?: boolean;
  entry?: LoginEntry;
  title?: string;
};

export function PageFrame({
  children,
  wide = false,
  entry = 'login',
  title = 'Secure access | Hominem',
}: PageFrameProps) {
  const assets = loginAssets(entry);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="#fcfcfd" media="(prefers-color-scheme: light)" name="theme-color" />
        <meta content="#111113" media="(prefers-color-scheme: dark)" name="theme-color" />
        <title>{title}</title>
        {assets.styles.map((href) => (
          <link href={href} rel="stylesheet" />
        ))}
        {assets.scripts.map((src) => (
          <script defer src={src} type="module" />
        ))}
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
