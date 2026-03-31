#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

# Verify the resolved Expo config matches the variant contract.
# This checks the final config Expo will use, not just source declarations.

CONFIG_JSON="$(bash -lc 'bunx expo config --json --type public')"

export CONFIG_JSON

bun -e "
const { EXPO_OWNER, EXPO_PROJECT_ID, EXPO_PROJECT_SLUG } = require('./config/expo-config.js')
const { getAppVariantConfig } = require('./config/appVariant.js')

const config = JSON.parse(process.env.CONFIG_JSON ?? '{}')
const variant = process.env.APP_VARIANT

if (!variant) {
  throw new Error('Expo config mismatch: APP_VARIANT must be set')
}

const variantConfig = getAppVariantConfig(variant)
const resolvedConfig = {
  owner: config.owner,
  projectId: config.extra?.eas?.projectId,
  slug: config.slug,
}
const expectedConfig = {
  owner: EXPO_OWNER,
  projectId: EXPO_PROJECT_ID,
  slug: EXPO_PROJECT_SLUG,
}

if (JSON.stringify(resolvedConfig) !== JSON.stringify(expectedConfig)) {
  throw new Error(
    'Expo config mismatch: expected ' +
      JSON.stringify(expectedConfig) +
      ', got ' +
      JSON.stringify(resolvedConfig),
  )
}

if (config.extra?.mobilePasskeyEnabled === undefined) {
  throw new Error('Expo config mismatch: extra.mobilePasskeyEnabled must be present')
}

if (config.extra?.appVariant !== variant) {
  throw new Error('Expo config mismatch: extra.appVariant must match the resolved app variant')
}

if (config.extra?.appScheme !== variantConfig.scheme) {
  throw new Error('Expo config mismatch: extra.appScheme must match the variant scheme')
}

if (config.extra?.isDevClient !== variantConfig.usesDevClient) {
  throw new Error('Expo config mismatch: extra.isDevClient must match the variant dev-client policy')
}

if (config.ios?.bundleIdentifier !== variantConfig.bundleIdentifier) {
  throw new Error('Expo config mismatch: ios.bundleIdentifier must match the variant bundle identifier')
}

if (config.runtimeVersion?.policy !== 'fingerprint') {
  throw new Error('Expo config mismatch: runtimeVersion.policy must be fingerprint')
}

if (variantConfig.updatesChannel === null) {
  if (config.updates?.enabled !== false) {
    throw new Error('Expo config mismatch: local-only variants must disable updates')
  }
} else {
  if (config.updates?.requestHeaders?.['expo-channel-name'] !== variantConfig.updatesChannel) {
    throw new Error('Expo config mismatch: release variants must publish to the expected update channel')
  }
}
"

ok "Expo config"
