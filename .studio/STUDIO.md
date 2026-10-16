# Working in a studio repo

Every studio repo answers to the same `just` verbs. Run `just --list` to see what applies.

| Verb | What it does |
|---|---|
| `just setup` | Install dependencies, build local packages, create gitignored config, pod install. Safe to repeat. Run it first in any new checkout or `git worktree`. |
| `just doctor` | Read-only checks (Xcode, simulator, ports, devices). Says what to fix. |
| `just run` | Start Metro (and the local API when the app needs one) on this repo's port. |
| `just sim` | Build, install and launch on the booted simulator. |
| `just device` | Build, install and launch on the paired physical devices. |
| `just check` | Everything to pass before pushing: lint, types, tests (and Swift checks). |
| `just e2e` | End-to-end flows on the simulator, where the repo has them. |
| `just testflight` | Release archive. Only when asked. |

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

`.studio/` is copied from the `studio-dev` repo. Do not edit it here: change `studio-dev`, then run
`just studio-update` in each repo. `just studio-check` fails when a copy has drifted.
