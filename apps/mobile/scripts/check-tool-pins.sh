#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

# Verify Bun and EAS pins across repo files.
# This keeps local dev, CI, and workflows on the same toolchain.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

node -e "
const fs = require('node:fs')
const path = require('node:path')

const rootDir = process.argv[1]
const expectedBunVersion = '1.3.10'
const expectedEasVersionRange = '>= 10.0.3'
const expectedEasVersion = '10.0.3'

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + ' must be ' + expected + ', got ' + actual)
  }
}

const rootPackage = readJson('package.json')
const mobilePackage = readJson('apps/mobile/package.json')
const easConfig = readJson('apps/mobile/eas.json')

expectEqual(rootPackage.packageManager, 'bun@' + expectedBunVersion, 'root packageManager')
expectEqual(mobilePackage.packageManager, 'bun@' + expectedBunVersion, 'mobile packageManager')
expectEqual(easConfig.cli?.version, expectedEasVersionRange, 'mobile eas cli.version')

const setupAction = read('.github/actions/setup/action.yml')
if (!setupAction.includes('default: \"' + expectedBunVersion + '\"')) {
  throw new Error('setup action bun-version default must stay pinned to ' + expectedBunVersion)
}

for (const workflowPath of [
  '.github/workflows/mobile-release-candidate.yml',
  '.github/workflows/mobile-ota-deploy.yml',
  '.github/workflows/mobile-production-release.yml',
]) {
  const workflow = read(workflowPath)
  if (!workflow.includes('eas-version: ' + expectedEasVersion)) {
    throw new Error(workflowPath + ' must pin eas-version to ' + expectedEasVersion)
  }
}
" "$ROOT_DIR"

ok "Release tooling pins"
