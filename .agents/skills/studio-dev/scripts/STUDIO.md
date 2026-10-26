# Working in a studio repo

Every studio repo answers to the same `just` verbs. Run `just --list` to see what applies.

| Verb | What it does |
|---|---|
| `just setup` | Install dependencies, build local packages, create gitignored config, pod install. Safe to repeat. Run it first in any new checkout or `git worktree`. |
| `just doctor` | Read-only checks (Xcode, simulator, ports, devices). Says what to fix. |
| `just run` | Start Metro (and the local API when the app needs one) on this repo's port. |
| `just sim` | Build, install and launch on the booted simulator. |
| `just e2e` | End-to-end flows on the simulator, where the repo has them. |
| `just testflight` | Ship to TestFlight, the same way in every app (see Shipping). Only when asked. |

A verb a repo does not support prints "not applicable here" and exits 0.

## Ports

`.studio/ports.env` is the one list of ports (Thames 8083, Still 8084, Omiro e2e 8082, API 4040).
Never use 8081 for a studio app.

## Habits

- `pod install` needs `LANG=en_US.UTF-8` and `LC_ALL=en_US.UTF-8`; the recipes set them.
- Never commit a `Podfile.lock` change that only bumps versions.
- Simulator builds are signed ad hoc (`CODE_SIGN_IDENTITY=-`); an unsigned build cannot use the Keychain.
- Never commit `.env` files or real keys. Local development uses the scripted, no-cost providers.
- A `git worktree` has none of the gitignored files: run `just setup` in it.

## This folder

`.studio/` is assembled from the kernel skills (`studio-dev` for this file,
`ship-ios` for the shipping pipeline): run `just studio-update` in any repo
to install it, `just studio-check` to fail when a copy has drifted. Do not
edit it here: change the skill, then update every repo.

## Shipping

Every Apple app ships to TestFlight with `just testflight`, which runs `.studio/ship-ios.sh`. The
stages and rules are the same for every repo; each repo's `scripts/` file supplies only how its app
is built and uploaded. The full branch-to-TestFlight lifecycle is the `ship-ios` skill in kernel.

1. **Preflight.** No uncommitted changes to tracked files, and HEAD is `origin/main` (build from a
   merged commit, in a worktree if your checkout has other work). `--allow-branch` overrides, and the
   PR says why.
2. **Checks.** The repo's `just check` (or its own `ship_check`). `--skip-checks` skips them.
3. **Build.** The release artifact, with a build number that always goes up.
4. **Audit.** The repo's own "must not contain" checks (Thames: no provider key; Omiro: the release identity).
5. **Symbols and source maps.** So crashes read as code. A failure here warns; the build still ships.
6. **Upload.** To App Store Connect. It never stops to ask: asking for a release is the confirmation.
   `--no-upload` is the dry run.
7. **Report.** Name, version, build number, commit, artifact path, and the plain fact that Apple is
   still processing it, so it is not in TestFlight until App Store Connect shows it.

### New Relic keys

- The app token (`NEWRELIC_IOS_APP_TOKEN`, ends `NRMA`) is embedded in the app and uploads its dSYMs.
- Source maps need a New Relic **User** API key, `NRAK-...`. Keep it as `NEW_RELIC_USER_API_KEY` in
  `~/.localrc` (or `NEWRELIC_USER_API_KEY` in the repo's env file; Omiro takes it from EAS). An ingest license key (ends
  `NRAL`) is rejected: the endpoint redirects to the login page and the tool reports a misleading
  "413 too large". `ship_newrelic_user_key` checks the prefix for you.
- Never print a key, and never build one into an app. Mobile tokens are not secrets; the User key is.
- A watchOS app cannot report crashes to New Relic; Thames keeps Sentry for the Watch.

### Adding a new Apple app

Assemble `.studio/` (`just studio-update`, from the studio-dev skill), write a `scripts/ship.sh` that sources `.studio/lib.sh` and
`.studio/ship-ios.sh`, sets `SHIP_NAME` and `SHIP_ROOT`, defines `ship_build` and `ship_upload`
(`ship_audit`, `ship_symbols` and `ship_check` if it needs them), and ends with `ship_ios "$@"`. Point the
repo's `testflight` recipe at it. `scripts/archive-testflight.sh` in Thames and `scripts/ship-omiro.sh`
in hominem are the worked examples.
