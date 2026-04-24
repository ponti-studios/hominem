import { readFileSync } from 'node:fs';
import path from 'node:path';

import { apiSchema } from '../packages/core/env/src/api';
import { webSchema } from '../packages/core/env/src/web';

function parseEnvKeys(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf8');
  const keys: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    keys.push(line.split('=', 1)[0]!.trim());
  }

  return keys;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function asSet(values: Iterable<string>): Set<string> {
  return new Set(values);
}

function schemaKeys(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape);
}

function reportList(title: string, values: string[]) {
  if (values.length === 0) return;
  console.error(`  ${title}: ${values.join(', ')}`);
}

function checkExact(filePath: string, expectedKeys: Iterable<string>) {
  const actual = asSet(parseEnvKeys(filePath));
  const expected = asSet(expectedKeys);

  const missing = sorted([...expected].filter((key) => !actual.has(key)));
  const extra = sorted([...actual].filter((key) => !expected.has(key)));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${filePath}`);
    return true;
  }

  console.error(`✗ ${filePath}`);
  reportList('missing', missing);
  reportList('extra', extra);
  return false;
}

function checkAllowedSubset(filePath: string, allowedKeys: Iterable<string>) {
  const actual = asSet(parseEnvKeys(filePath));
  const allowed = asSet(allowedKeys);
  const extra = sorted([...actual].filter((key) => !allowed.has(key)));

  if (extra.length === 0) {
    console.log(`✓ ${filePath}`);
    return true;
  }

  console.error(`✗ ${filePath}`);
  reportList('unknown', extra);
  return false;
}

const apiExampleKeys = [
  ...schemaKeys(apiSchema),
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_SERVICE_NAME',
  'OTEL_DEPLOYMENT_ENVIRONMENT',
  'OTEL_TRACES_SAMPLER_ARG',
  'OTEL_LOGS_EXPORTER',
];

const webExampleKeys = schemaKeys(webSchema).filter((key) => key.startsWith('VITE_'));

const dbKeys = ['DATABASE_URL', 'DB_MAX_CONNECTIONS', 'DB_IDLE_TIMEOUT', 'DB_MAX_LIFETIME'];

const mobileKeys = [
  'APP_VARIANT',
  'EXPO_APPLE_TEAM_ID',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_E2E_AUTH_SECRET',
  'EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED',
  'EXPO_PUBLIC_POSTHOG_API_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
];

const sharedExampleKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'API_URL',
  'WEB_URL',
  'BETTER_AUTH_SECRET',
  'AUTH_PASSKEY_RP_ID',
  'AUTH_PASSKEY_ORIGIN',
  'AUTH_COOKIE_DOMAIN',
  'AUTH_E2E_ENABLED',
  'AUTH_E2E_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_FROM_NAME',
  'SEND_EMAILS',
  'OPENROUTER_API_KEY',
  'AI_MODEL',
  'R2_ENDPOINT',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_SERVICE_NAME',
  'SERVICE_NAME',
  'OTEL_SERVICE_NAMESPACE',
  'OTEL_DEPLOYMENT_ENVIRONMENT',
  'OTEL_TRACES_SAMPLER',
  'OTEL_TRACES_SAMPLER_ARG',
  'OTEL_LOG_LEVEL',
  'SENTRY_DSN',
];

const deployRootAllowedKeys = [...sharedExampleKeys, ...webExampleKeys];
const apiAllowedKeys = apiExampleKeys;
const webAllowedKeys = webExampleKeys;
const dbAllowedKeys = dbKeys;
const staleForbiddenKeys = [
  'NOTES_URL',
  'AI_PROVIDER',
  'TEST_DATABASE_URL',
  'PROD_DATABASE_URL',
  'BETTER_AUTH_URL',
  'AUTH_CAPTCHA_SECRET_KEY',
  'NOTION_SECRET',
  'AUTH_OTP_ENABLED',
  'AUTH_OTP_TTL_SECONDS',
  'GOOGLE_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'TWITTER_CLIENT_ID',
  'TWITTER_CLIENT_SECRET',
  'GEOCODE_EARTH_API_KEY',
  'TAVILY_API_KEY',
  'PLAID_API_KEY',
  'PLAID_CLIENT_ID',
  'COOKIE_SECRET',
  'AUTH_ISSUER',
  'AUTH_AUDIENCE',
  'APPLE_CLIENT_ID',
  'APPLE_TEAM_ID',
];

const root = process.cwd();
const files = {
  rootExample: path.join(root, '.env.example'),
  rootPreview: path.join(root, '.env.preview'),
  rootProduction: path.join(root, '.env.production'),
  apiEnv: path.join(root, 'services/api/.env'),
  apiExample: path.join(root, 'services/api/.env.example'),
  apiProduction: path.join(root, 'services/api/.env.production'),
  webEnv: path.join(root, 'apps/web/.env'),
  webExample: path.join(root, 'apps/web/.env.example'),
  webProduction: path.join(root, 'apps/web/.env.production'),
  mobileExample: path.join(root, 'apps/mobile/.env.example'),
  dbEnv: path.join(root, 'packages/core/db/.env'),
  dbExample: path.join(root, 'packages/core/db/.env.example'),
  dbProduction: path.join(root, 'packages/core/db/.env.production'),
};

let ok = true;

ok = checkExact(files.rootExample, sharedExampleKeys) && ok;
ok = checkAllowedSubset(files.rootPreview, deployRootAllowedKeys) && ok;
ok = checkAllowedSubset(files.rootProduction, deployRootAllowedKeys) && ok;
ok = checkAllowedSubset(files.apiEnv, apiAllowedKeys) && ok;
ok = checkExact(files.apiExample, apiExampleKeys) && ok;
ok = checkAllowedSubset(files.apiProduction, apiAllowedKeys) && ok;
ok = checkAllowedSubset(files.webEnv, webAllowedKeys) && ok;
ok = checkExact(files.webExample, webExampleKeys) && ok;
ok = checkAllowedSubset(files.webProduction, webAllowedKeys) && ok;
ok = checkExact(files.mobileExample, mobileKeys) && ok;
ok = checkAllowedSubset(files.dbEnv, dbAllowedKeys) && ok;
ok = checkAllowedSubset(files.dbExample, dbAllowedKeys) && ok;
ok = checkAllowedSubset(files.dbProduction, dbAllowedKeys) && ok;

for (const [label, filePath] of Object.entries(files)) {
  const actual = parseEnvKeys(filePath);
  const foundStale = sorted(actual.filter((key) => staleForbiddenKeys.includes(key)));
  if (foundStale.length > 0) {
    ok = false;
    console.error(`✗ ${label} (${filePath})`);
    reportList('stale', foundStale);
  }
}

if (!ok) {
  console.error('\nEnvironment consistency check failed.');
  process.exit(1);
}

console.log('\nEnvironment consistency check passed.');
