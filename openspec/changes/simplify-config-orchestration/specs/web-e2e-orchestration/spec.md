## ADDED Requirements

### Requirement: Web E2E orchestration uses explicit workflow commands

The web Playwright workflow SHALL use explicit commands for preparation, service startup, and test execution instead of embedding multi-step orchestration directly inside Playwright configuration strings.

#### Scenario: Playwright starts required services

- **WHEN** the web E2E suite needs to start the API and web servers
- **THEN** each server startup path is invoked through an explicit workflow command or minimal wrapper with a single responsibility
- **AND** the Playwright configuration does not inline unrelated preparation steps such as database setup or dependency installation into the server command itself

#### Scenario: Developer reproduces startup outside Playwright

- **WHEN** a developer needs to debug a startup failure locally
- **THEN** the same startup commands used by Playwright can be run directly from the command line
- **AND** the startup path does not depend on hidden command assembly logic inside the configuration file

### Requirement: Web E2E behavior is deterministic across local and CI environments

The web E2E workflow MUST define which setup steps run locally, which setup steps are assumed to be provided by CI, and how those modes are selected.

#### Scenario: Local E2E run needs environment preparation

- **WHEN** a developer runs the web E2E workflow in a local environment
- **THEN** the workflow performs or invokes the required local preparation steps before tests start
- **AND** those preparation steps are defined outside the Playwright server command strings

#### Scenario: CI E2E run reuses external setup

- **WHEN** the web E2E workflow runs in CI after database or environment setup has already been performed
- **THEN** the workflow uses the CI startup path without rerunning the preparation steps that CI already satisfied
- **AND** the selected behavior is visible from the invoked command surface or configuration inputs

### Requirement: Web E2E startup failures isolate orchestration from application regressions

The web E2E workflow MUST separate orchestration failures from application-level test failures so startup debugging does not obscure product regressions.

#### Scenario: Startup fails before tests execute

- **WHEN** a server or environment preparation step fails during E2E startup
- **THEN** the failing preparation or startup command is identifiable as the source of failure
- **AND** the failure can be reproduced without running the full Playwright suite

#### Scenario: Application flow fails after successful startup

- **WHEN** Playwright reaches test execution and an application behavior assertion fails
- **THEN** the workflow preserves that failure as an application regression
- **AND** the orchestration layer does not reclassify it as a startup or environment failure
