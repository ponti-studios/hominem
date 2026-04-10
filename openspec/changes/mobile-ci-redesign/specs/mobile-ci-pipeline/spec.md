## ADDED Requirements

### Requirement: CI pipeline triggers EAS build on main branch push

The CI pipeline SHALL trigger an EAS build and submit job when a commit is pushed to the `main` branch.

### Requirement: CI pipeline skips EAS build on develop branch and PRs

The CI pipeline SHALL NOT trigger an EAS build when a commit is pushed to `develop` branch or when a pull request is opened/updated.

### Requirement: CI pipeline runs typecheck and tests on all mobile-relevant pushes

The CI pipeline SHALL run `mobile-checks` (TypeScript typecheck + Jest unit tests) on every push to `main` or `develop` and on every pull request targeting those branches.

### Requirement: EAS build uses production profile

The EAS build step in CI SHALL use `--profile production`, which targets the `com.pontistudios.hakumi` bundle identifier and App Store distribution.

### Requirement: EAS build is followed by EAS submit to TestFlight

After a successful EAS build, the CI pipeline SHALL run `eas submit --platform ios --latest` to publish the built artifact to TestFlight.

### Requirement: EAS submit uses production submit profile

The EAS submit step SHALL use the `production` submit profile, configured with the Apple Team ID `3QHJ2KN8AL`.
