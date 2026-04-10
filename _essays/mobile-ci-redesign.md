# Mobile CI Redesign

## Problem

The mobile CI/CD pipeline was misaligned with how the team actually distributed builds. EAS builds were triggered on every push to both the main and develop branches, but only the main branch had a distribution target (TestFlight). Develop pushes generated unusable artifacts that wasted build minutes and created confusion about which build represented the current state.

The pipeline used the wrong build profile: `--profile preview` builds for internal ad-hoc distribution, not App Store submission. Pushing to TestFlight requires `--profile production` with App Store signing. Without an explicit `eas.json`, the EAS CLI used defaults that may not have matched the intended configuration.

Detox E2E testing had been considered for CI integration, but the architecture was incompatible. Detox requires a macOS runner with a simulator and Xcode, costs roughly 10 times what a standard Ubuntu runner costs, and targets simulator environments. EAS cloud builds produce signed binaries for real devices—fundamentally different targets. Running Detox in CI offered diminishing returns for high cost.

## Exploration

The team considered several distribution strategies. One approach was triggering EAS builds on both main and develop, with develop building to the preview profile for internal QA distribution. This would have provided more testing avenues but at the cost of build minutes and the overhead of managing two distribution channels. Another option was consolidating to a single distribution path (main only) but keeping the preview profile instead of switching to production, which would avoid the profile change at the cost of not actually publishing to TestFlight.

For E2E testing, keeping Detox local-only meant foregoing per-PR automated E2E validation in favor of developer responsibility before merging. The alternative was investing in macOS CI runners and EAS simulator builds, which would catch regressions earlier but at significant cost. The team also considered whether to add a preview-channel E2E flow in CI that tested the preview build, but decided that local testing before merge was a clearer ownership model.

## Solution

The team chose to trigger EAS builds only on pushes to the main branch. The build uses `--profile production` to target App Store signing and bundle IDs. An `eas submit` step automatically pushes the built artifact to TestFlight, completing the release pipeline in one job.

Type checking and unit tests in the `mobile-checks` job continue running on all pushes and pull requests (fast, cheap, high signal), but EAS builds are reserved for main-branch pushes only (expensive, destination-specific, no value on feature branches).

An explicit `eas.json` was created to formalize build profiles for the `development`, `preview`, and `production` variants defined in `app.config.ts`. This made the EAS CLI configuration explicit and discoverable, rather than relying on defaults or undocumented behavior.

Detox remained a local developer tool. The `detox:e2e` script stays available in package.json for developers to run before merging significant changes, but CI does not attempt to execute it. This reflects the architectural reality that simulator-based testing doesn't mesh with cloud build artifacts.

## Learnings

Build pipelines accumulate triggers and jobs that seemed reasonable individually but become wasteful at scale. Running EAS on every push provided the illusion of validation but generated artifacts that were never used, making the pipeline feel authoritative while being operationally incomplete.

Choosing the right build profile is non-obvious but critical. The repository had previously used `preview` without realizing it creates a different bundle ID and signing profile than what TestFlight requires. The distinction between ad-hoc internal distribution and App Store submission gets buried in configuration details and is easy to overlook.

Making configuration explicit and named is better than relying on defaults. Without `eas.json`, developers and CI both had to guess or consult EAS documentation to understand which profile was active. Creating the file made the configuration discoverable and updated it when build profiles changed.

Some tools don't belong in CI despite team discussion suggesting they might. Detox is a first-class local development tool; it's not cheaper or more reliable to run on shared CI infrastructure. The team learned to distinguish between "would be nice to test this way" and "this tool is architecturally suited for CI," which are not the same question.

CI job ownership should be clear. By separating `mobile-checks` (fast, developer-facing, runs everywhere) from `eas-build-submit` (expensive, release-focused, main-only), the pipeline's intent became obvious. A developer sees that checks must pass before any commit, while the expensive build job only runs when pushing to release.

Cost and latency are hidden incentives in CI pipeline design. Running EAS builds on develop wastes minutes and delays feedback; keeping them main-only prioritizes fast iteration on non-release branches. Making cost explicit in pipeline design decisions prevents accumulation of wasteful jobs.
