const className = (module: string, local: string) => `hominem-${module}__${local}`;

export const shared = {
  field: className('shared', 'field'),
  primaryButton: className('shared', 'primary-button'),
  secondaryButton: className('shared', 'secondary-button'),
} as const;

export const pageFrame = {
  alert: className('page-frame', 'alert'),
  authCard: className('page-frame', 'auth-card'),
  authCardWide: className('page-frame', 'auth-card-wide'),
  authContent: className('page-frame', 'auth-content'),
  authContentWide: className('page-frame', 'auth-content-wide'),
  authGrid: className('page-frame', 'auth-grid'),
  authHeading: className('page-frame', 'auth-heading'),
  authLayout: className('page-frame', 'auth-layout'),
  authLayoutWide: className('page-frame', 'auth-layout-wide'),
  authPage: className('page-frame', 'auth-page'),
  brandLockup: className('page-frame', 'brand-lockup'),
  brandLogo: className('page-frame', 'brand-logo'),
  cardCopy: className('page-frame', 'card-copy'),
} as const;

export const progressButton = {
  fill: className('progress-button', 'fill'),
  progressButton: className('progress-button', 'progress-button'),
  action: className('progress-button', 'progress-button__action'),
  arrow: className('progress-button', 'progress-button__arrow'),
  border: className('progress-button', 'progress-button__border'),
  gradientEnd: className('progress-button', 'progress-button__gradient-end'),
  gradientStart: className('progress-button', 'progress-button__gradient-start'),
  helper: className('progress-button', 'progress-button__helper'),
  progress: className('progress-button', 'progress-button__progress'),
  track: className('progress-button', 'progress-button__track'),
} as const;

export const otpField = {
  field: className('otp-field', 'otp-field'),
  input: className('otp-field', 'otp-input'),
  tile: className('otp-field', 'otp-tile'),
} as const;

export const loginPage = { authLinks: className('login-page', 'auth-links') } as const;

export const consentPage = {
  scopeBadge: className('consent-page', 'scope-badge'),
  scopeBadgeRead: className('consent-page', 'scope-badge-read'),
  scopeBadgeWrite: className('consent-page', 'scope-badge-write'),
  scopeBadges: className('consent-page', 'scope-badges'),
  scopeIcon: className('consent-page', 'scope-icon'),
  scopeList: className('consent-page', 'scope-list'),
  scopeName: className('consent-page', 'scope-name'),
  scopeRow: className('consent-page', 'scope-row'),
} as const;

export const authErrorPage = {
  errorSymbol: className('auth-error-page', 'error-symbol'),
  secureLabel: className('auth-error-page', 'secure-label'),
} as const;

export const settingsPage = {
  avatar: className('settings-page', 'avatar'),
  dangerButton: className('settings-page', 'dangerButton'),
  email: className('settings-page', 'email'),
  identityRow: className('settings-page', 'identityRow'),
  nameInput: className('settings-page', 'nameInput'),
  saveButton: className('settings-page', 'saveButton'),
  saveRow: className('settings-page', 'saveRow'),
  saveStatus: className('settings-page', 'saveStatus'),
  section: className('settings-page', 'section'),
  sectionLabel: className('settings-page', 'sectionLabel'),
  usageAmount: className('settings-page', 'usageAmount'),
  usageBar: className('settings-page', 'usageBar'),
  usageBarFill: className('settings-page', 'usageBarFill'),
  usageLimit: className('settings-page', 'usageLimit'),
  usageReset: className('settings-page', 'usageReset'),
  usageSummary: className('settings-page', 'usageSummary'),
} as const;

export const aiUsagePage = {
  backLink: className('ai-usage-page', 'backLink'),
  bar: className('ai-usage-page', 'bar'),
  barFill: className('ai-usage-page', 'barFill'),
  bigNumber: className('ai-usage-page', 'bigNumber'),
  card: className('ai-usage-page', 'card'),
  cardTitle: className('ai-usage-page', 'cardTitle'),
  hero: className('ai-usage-page', 'hero'),
  driverCost: className('ai-usage-page', 'driverCost'),
  driverHead: className('ai-usage-page', 'driverHead'),
  driverMain: className('ai-usage-page', 'driverMain'),
  driverMeta: className('ai-usage-page', 'driverMeta'),
  driverName: className('ai-usage-page', 'driverName'),
  driverRow: className('ai-usage-page', 'driverRow'),
  drivers: className('ai-usage-page', 'drivers'),
  impactGrid: className('ai-usage-page', 'impactGrid'),
  impactHead: className('ai-usage-page', 'impactHead'),
  impactItem: className('ai-usage-page', 'impactItem'),
  impactLink: className('ai-usage-page', 'impactLink'),
  impactValue: className('ai-usage-page', 'impactValue'),
  muted: className('ai-usage-page', 'muted'),
  page: className('ai-usage-page', 'page'),
  pacing: className('ai-usage-page', 'pacing'),
  seg: className('ai-usage-page', 'seg'),
  segButton: className('ai-usage-page', 'segButton'),
  shareFill: className('ai-usage-page', 'shareFill'),
  shareTrack: className('ai-usage-page', 'shareTrack'),
  spark: className('ai-usage-page', 'spark'),
  sparkBar: className('ai-usage-page', 'sparkBar'),
  statusRow: className('ai-usage-page', 'statusRow'),
  tally: className('ai-usage-page', 'tally'),
  tallyLabel: className('ai-usage-page', 'tallyLabel'),
  tallyRow: className('ai-usage-page', 'tallyRow'),
  tallyValue: className('ai-usage-page', 'tallyValue'),
  trend: className('ai-usage-page', 'trend'),
  trendBar: className('ai-usage-page', 'trendBar'),
  trendCol: className('ai-usage-page', 'trendCol'),
  trendLabel: className('ai-usage-page', 'trendLabel'),
  twoCol: className('ai-usage-page', 'twoCol'),
} as const;

export const aiFootprintPage = {
  backLink: className('ai-footprint-page', 'backLink'),
  note: className('ai-footprint-page', 'note'),
  page: className('ai-footprint-page', 'page'),
  stepNumber: className('ai-footprint-page', 'stepNumber'),
  steps: className('ai-footprint-page', 'steps'),
  summary: className('ai-footprint-page', 'summary'),
  summaryHead: className('ai-footprint-page', 'summaryHead'),
} as const;
