#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()

# Shared studio recipes (studio-version, studio-update, studio-check); see .studio/STUDIO.md.

import '.studio/studio.just'

# Ship Omiro to TestFlight, the studio's way (see .studio/STUDIO.md). Only when asked.
testflight *flags:
    scripts/ship-omiro.sh {{ flags }}

otp email:
    pnpm --filter @hominem/api exec tsx scripts/otp.ts "{{ email }}"

mod db 'just/db.just'
mod deploy 'just/deploy.just'
mod diagnostics 'just/diagnostics.just'
mod evals 'just/evals.just'
mod mcp 'just/mcp.just'
mod mobile 'just/mobile.just'
mod ui 'just/ui.just'
