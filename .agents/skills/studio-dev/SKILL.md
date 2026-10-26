---
name: studio-dev
description: "The studio repo convention: shared just verbs, port registry, habits, and .studio assembly. Use when adding a repo to the studio way, syncing drifted .studio copies, changing a shared verb or port, or shipping (which defers to ship-ios)."
license: MIT
metadata:
  author: ponti-studios
  version: "0.3.0"
  category: Operations
---

# studio-dev

Every studio repo works the same way: identical `just` verbs, one port
registry, one set of habits, one shipping pipeline. The canonical files live
in this skill (`scripts/`); each repo holds installed copies under
`.studio/`, assembled by `scripts/install.sh`. Change the skill, then
reinstall every repo — never edit a repo's copy in place.

## Verbs

`setup`, `doctor`, `run`, `sim`, `e2e`, `testflight`, plus `studio-version` /
`studio-update` / `studio-check` for the machinery itself. A verb a repo
does not support prints "not applicable here" and exits 0. `just testflight`
ships via `.studio/ship-ios.sh`; the pipeline is the `ship-ios` skill.

## Ports

`.studio/ports.env` is the one registry (Thames 8083, Still 8084, Omiro e2e
8082, API 4040). Give every new app its own port there. Never use 8081.

## Habits

- `pod install` with `LANG=en_US.UTF-8` / `LC_ALL=en_US.UTF-8`.
- Never commit version-only `Podfile.lock` bumps.
- Simulator builds are ad-hoc signed; unsigned builds cannot use the Keychain.
- Never commit `.env` files or real keys; local dev uses scripted no-cost providers.
- A fresh checkout or `git worktree` starts with `just setup`.

## Install and drift

- Install: `skills/studio-dev/scripts/install.sh <repo-root>...` — installs
  `studio.just`, `ports.env`, `STUDIO.md`, stamps `.studio/VERSION`, then
  chains the ship-ios installer for `ship-ios.sh` + `lib.sh`.
- Check: same command with `--check` — exits 1 on any drifted copy or stale
  version. Repos wire these as `just studio-update` / `just studio-check`.
- `.studio/VERSION` is the set version (currently 0.3.0), owned by this
  skill — the ship-ios installer manages only its two scripts. Bump it here
  when any bundled file changes.

## Adding a repo

1. `scripts/install.sh <repo-root>` to assemble `.studio/`.
2. Import the verbs in the repo justfile: `import '.studio/studio.just'`.
3. Add repo-specific recipes (`setup`, `check`, `testflight`, ...) around them.
4. Run `--check` before the first ship.
