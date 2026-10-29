#!/usr/bin/env just --justfile

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

ROOT_DIR := justfile_directory()

# Shared studio skills, project-installed (see skills-lock.json).

SKILLS_DIR := justfile_directory() / ".agents/skills"

# Installed skill set version.
studio-version:
    @cat "{{ SKILLS_DIR }}/studio-dev/scripts/VERSION"

# Restore the installed skills from skills-lock.json.
studio-update:
    cd "{{ justfile_directory() }}" && npx -y skills experimental_install --yes

# Fail when an installed skill is missing or the lockfile is.
studio-check:
    @test -f "{{ SKILLS_DIR }}/ship-ios/SKILL.md" || (echo "missing ship-ios: run just studio-update"; exit 1)
    @test -f "{{ SKILLS_DIR }}/studio-dev/SKILL.md" || (echo "missing studio-dev: run just studio-update"; exit 1)
    @test -f "{{ justfile_directory() }}/skills-lock.json" || (echo "missing skills-lock.json"; exit 1)
    @echo "skills ok"

# Ship Omiro to TestFlight, the studio's way (see the ship-ios skill). Only when asked.
testflight *flags:
    scripts/ship-omiro.sh {{ flags }}

otp email:
    pnpm --filter @hominem/api exec tsx scripts/otp.ts "{{ email }}"

mod db 'just/db.just'
mod billing 'just/billing.just'
mod deploy 'just/deploy.just'
mod diagnostics 'just/diagnostics.just'
mod evals 'just/evals.just'
mod mcp 'just/mcp.just'
mod mobile 'just/mobile.just'
mod ui 'just/ui.just'
