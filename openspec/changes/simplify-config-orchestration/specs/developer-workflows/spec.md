## ADDED Requirements

### Requirement: Canonical repo workflow commands

The repository SHALL define exactly one canonical root-level command for each common workflow category that spans multiple packages or services, including setup, checks, development, build, and end-to-end testing.

#### Scenario: Developer needs the primary web E2E command

- **WHEN** a developer or CI job needs to run the web E2E workflow
- **THEN** the repository exposes one documented root-level command for that workflow
- **AND** alternate wrappers that perform the same workflow are removed or explicitly marked as transitional

#### Scenario: Package-local actions remain local

- **WHEN** a workflow only concerns a single package action such as building or starting one package
- **THEN** that action remains implemented as a package-local script
- **AND** root orchestration calls it instead of re-encoding the implementation details in multiple places

### Requirement: Root orchestration owns cross-package composition

Cross-package workflows MUST be composed in a root orchestration layer rather than duplicated across configuration files, package scripts, and CI definitions.

#### Scenario: Repo check workflow spans multiple packages

- **WHEN** the repository defines a check workflow that runs linting, typechecking, tests, or builds across packages
- **THEN** the composition of those steps is defined in one root-level workflow command
- **AND** downstream callers reference that command instead of reproducing the package list or Turbo filters independently

#### Scenario: Workflow consumers need stable command names

- **WHEN** CI, docs, or local developer instructions reference a repo workflow
- **THEN** they all reference the same canonical command name
- **AND** the repo does not maintain parallel public names for the same behavior without a documented migration window

### Requirement: Command migrations update consumers atomically

When a canonical repo workflow command is renamed, added, or removed, the implementation MUST update the affected workflow consumers in the same change.

#### Scenario: A public Just recipe is renamed

- **WHEN** a root-level workflow command changes name or is replaced
- **THEN** CI workflow files, configuration references, and human-facing docs are updated in the same implementation
- **AND** stale references are not left behind as the only remaining consumers of the old command
