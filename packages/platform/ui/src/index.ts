import type { LinkDescriptor } from 'react-router';

export * from './theme';
export * from './tokens';

export { AuthScaffold } from './components/auth/auth-scaffold';
export { AuthRouteLayout } from './components/auth/auth-route-layout';
export { AuthErrorBanner } from './components/auth/auth-error-banner';
export { EmailEntryForm } from './components/auth/email-entry-form';
export { OtpVerificationForm } from './components/auth/otp-verification-form';
export { ResendCodeButton } from './components/auth/resend-code-button';
export { PasskeyButton } from './components/auth/passkey-button';
export { PasskeyEnrollmentBanner } from './components/auth/passkey-enrollment-banner';
export { PasskeyManagement } from './components/auth/passkey-management';
export { Center, type CenterProps } from './components/layout/center';
export { Header, type HeaderProps, type NavItem } from './components/layout/header';
export { Inline, type InlineProps } from './components/layout/inline';
export { LandingPage, type LandingFeature, type LandingPageProps, type LandingStep } from './components/layout/landing-page';
export { Container, Page, Screen, type ContainerProps, type PageMaxWidth, type PageProps, type ScreenProps } from './components/layout/page';
export { PageContainer } from './components/layout/page-container';
export { Stack, type GapToken, type StackProps } from './components/layout/stack';
export * from './components/loading-state';
export * from './components/page-title';
export { MetaBadge } from './components/surfaces/meta-badge';
export { SectionIntro } from './components/surfaces/section-intro';
export { StatePanel } from './components/surfaces/state-panel';
export { SurfaceFrame } from './components/surfaces/surface-frame';
export { SurfacePanel } from './components/surfaces/surface-panel';
export { PreviewCard, type PreviewCardHeaderProps } from './components/surfaces/preview-card';
export { Heading, type HeadingProps, type HeadingLevel, type HeadingVariant } from './components/typography/heading';
export { Text, type TextProps, type TextVariant } from './components/typography/text';

export * from './components/update-guard';
export * from './constants/chart-colors';
export * from './hooks/sort.types';
export * from './hooks/use-api-client';
export * from './hooks/use-filter-state';
export * from './hooks/use-media-query';
export * from './hooks/use-mobile';

export const COMMON_FONT_LINKS: LinkDescriptor[] = [];

export const COMMON_ICON_LINKS: LinkDescriptor[] = [
  // Favicon
  { rel: 'icon', type: 'image/x-icon', href: '/icons/favicon.ico' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16x16.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32x32.png' },
  { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/icons/favicon-96x96.png' },

  // Apple Touch Icons
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  { rel: 'apple-touch-icon', sizes: '57x57', href: '/icons/apple-touch-icon-57x57.png' },
  { rel: 'apple-touch-icon', sizes: '60x60', href: '/icons/apple-touch-icon-60x60.png' },
  { rel: 'apple-touch-icon', sizes: '72x72', href: '/icons/apple-touch-icon-72x72.png' },
  { rel: 'apple-touch-icon', sizes: '76x76', href: '/icons/apple-touch-icon-76x76.png' },
  { rel: 'apple-touch-icon', sizes: '114x114', href: '/icons/apple-touch-icon-114x114.png' },
  { rel: 'apple-touch-icon', sizes: '120x120', href: '/icons/apple-touch-icon-120x120.png' },
  { rel: 'apple-touch-icon', sizes: '144x144', href: '/icons/apple-touch-icon-144x144.png' },
  { rel: 'apple-touch-icon', sizes: '152x152', href: '/icons/apple-touch-icon-152x152.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon-180x180.png' },

  // Android Icons
  { rel: 'icon', type: 'image/png', sizes: '36x36', href: '/icons/android-icon-36x36.png' },
  { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/icons/android-icon-48x48.png' },
  { rel: 'icon', type: 'image/png', sizes: '72x72', href: '/icons/android-icon-72x72.png' },
  { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/icons/android-icon-96x96.png' },
  { rel: 'icon', type: 'image/png', sizes: '144x144', href: '/icons/android-icon-144x144.png' },
  { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icons/android-icon-192x192.png' },

  // Web Manifest
  { rel: 'manifest', href: '/manifest.json' },

  // Safari Pinned Tab Icon
  { rel: 'mask-icon', href: '/icons/safari-pinned-tab.svg', color: '#ffffff' },
];
