#!/usr/bin/env node
// Generates the hosted-login page's stylesheet artifacts:
//   - public/login.css                      (globals.css verbatim + every
//     *.module.css compiled with scoped class names)
//   - src/routes/login/components/styles.generated.ts (the scoped-name map
//     the page components import)
// Both are committed build artifacts (like public/login.js): dev.mjs keeps
// them rebuilt in watch mode, build.mjs builds them one-shot, so neither
// tsx dev-time transpilation nor the production build needs CSS awareness.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { transform } from 'lightningcss';

const componentsDir = join(process.cwd(), 'src', 'routes', 'login', 'components');
const publicCssPath = join(process.cwd(), 'public', 'login.css');
const generatedPath = join(componentsDir, 'styles.generated.ts');

// Module order matters for same-specificity conflicts: shared primitives
// first, then the components that override them (e.g. progress-button's
// .fill must win over shared's .primary-button).
const moduleOrder = [
  'shared',
  'page-frame',
  'progress-button',
  'otp-field',
  'login-page',
  'consent-page',
  'auth-error-page',
  'settings-page',
];

const toExportName = (stem) => stem.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// Each module's public export contract: css local name -> map key the
// components use. Keeping it explicit (rather than deriving it from the
// css) is what makes a missing/renamed class a build error instead of a
// runtime undefined class. Keyframes and other internal locals stay out on
// purpose. Keep the local names alphabetized within each module.
const exportKeys = {
  shared: {
    field: 'field',
    'primary-button': 'primaryButton',
    'secondary-button': 'secondaryButton',
  },
  'page-frame': {
    alert: 'alert',
    'auth-card': 'authCard',
    'auth-content': 'authContent',
    'auth-grid': 'authGrid',
    'auth-heading': 'authHeading',
    'auth-layout': 'authLayout',
    'auth-page': 'authPage',
    'brand-lockup': 'brandLockup',
    'brand-logo': 'brandLogo',
    'card-copy': 'cardCopy',
  },
  'progress-button': {
    fill: 'fill',
    'progress-button': 'progressButton',
    'progress-button__action': 'action',
    'progress-button__arrow': 'arrow',
    'progress-button__border': 'border',
    'progress-button__gradient-end': 'gradientEnd',
    'progress-button__gradient-start': 'gradientStart',
    'progress-button__helper': 'helper',
    'progress-button__progress': 'progress',
    'progress-button__track': 'track',
  },
  'otp-field': {
    'otp-field': 'field',
    'otp-input': 'input',
    'otp-tile': 'tile',
  },
  'login-page': {
    'auth-links': 'authLinks',
  },
  'consent-page': {
    'scope-badge': 'scopeBadge',
    'scope-badge-read': 'scopeBadgeRead',
    'scope-badge-write': 'scopeBadgeWrite',
    'scope-badges': 'scopeBadges',
    'scope-icon': 'scopeIcon',
    'scope-list': 'scopeList',
    'scope-name': 'scopeName',
    'scope-row': 'scopeRow',
  },
  'auth-error-page': {
    'error-symbol': 'errorSymbol',
    'secure-label': 'secureLabel',
  },
  'settings-page': {
    avatar: 'avatar',
    confirm: 'confirm',
    confirmActions: 'confirmActions',
    confirmCancel: 'confirmCancel',
    confirmCopy: 'confirmCopy',
    confirmSignOut: 'confirmSignOut',
    dangerButton: 'dangerButton',
    email: 'email',
    identityRow: 'identityRow',
    nameInput: 'nameInput',
    saveButton: 'saveButton',
    saveRow: 'saveRow',
    saveStatus: 'saveStatus',
    section: 'section',
    sectionLabel: 'sectionLabel',
    usageAmount: 'usageAmount',
    usageBar: 'usageBar',
    usageBarFill: 'usageBarFill',
    usageLimit: 'usageLimit',
    usageReset: 'usageReset',
    usageSummary: 'usageSummary',
  },
};

async function readOrThrow(path, label) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${label} missing at ${path}: ${error.code}`);
  }
}

export async function buildLoginStyles() {
  const globals = await readOrThrow(join(componentsDir, 'globals.css'), 'globals.css');

  const cssParts = [Buffer.from(globals)];
  const modules = {};

  for (const stem of moduleOrder) {
    const file = `${stem}.module.css`;
    const source = await readOrThrow(join(componentsDir, file), file);
    const { code, exports: exportsMap } = transform({
      filename: file,
      code: Buffer.from(source),
      cssModules: { pattern: 'hominem-[local]--[hash]' },
      minify: false,
    });
    const keys = exportKeys[stem] ?? {};
    modules[stem] = {};
    for (const [local, key] of Object.entries(keys)) {
      const scoped = exportsMap[local]?.name;
      if (!scoped) {
        throw new Error(
          `${file}: local '${local}' (exported as '${key}') is missing from the compiled module — did you rename or remove it?`,
        );
      }
      modules[stem][key] = scoped;
    }
    cssParts.push(code);
  }

  await writeFile(
    publicCssPath,
    Buffer.concat([
      Buffer.from('/* Generated by scripts/login-styles.mjs — edits belong in '),
      Buffer.from('src/routes/login/components/. */\n'),
      ...cssParts,
    ]),
  );

  const exportsTs = Object.entries(modules)
    .map(
      ([stem, map]) => `export const ${toExportName(stem)} = ${serializeAsOxfmtTs(map)} as const;`,
    )
    .join('\n');
  await writeFile(
    generatedPath,
    [
      '// Generated by scripts/login-styles.mjs from the *.module.css files in',
      '// src/routes/login/components — do not edit by hand.',
      '',
      exportsTs,
      '',
    ].join('\n'),
  );

  return { modules, cssBytes: cssParts.reduce((n, p) => n + p.length, 0) };
}

// oxfmt-compatible output: single quotes, trailing commas, no semicolons.
function serializeAsOxfmtTs(map) {
  const entries = Object.entries(map);
  if (entries.length === 0) return '{}';
  return `{
${entries.map(([local, name]) => `  ${local}: '${name}',`).join('\n')}
}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const start = performance.now();
  try {
    const { cssBytes } = await buildLoginStyles();
    console.log(
      `[login.css] rebuilt (${cssBytes} bytes) in ${Math.round(performance.now() - start)}ms`,
    );
  } catch (error) {
    console.error('[login.css] build failed:', error);
    process.exitCode = 1;
  }
}
