# Auth Workflow Tools Log

This file records the helper tools used while working through the auth plan, route fixes, and browser verification. It is meant as a practical reference for the next session, not as a full audit trail of every single call.

## Repo And File Inspection

- `read_file` - Read existing auth plan, route handlers, helpers, configs, and test files before making changes. Used to inspect current behavior and avoid duplicating work.
- `grep_search` - Searched the workspace for auth-related symbols, routes, and test fixtures such as OTP helpers, redirect paths, and cleanup patterns.
- `file_search` - Found the actual file locations for auth test suites and route modules so the right files could be edited.
- `get_changed_files` - Checked the active diff so unrelated user changes were not overwritten.
- `get_errors` - Validated edited files after patches and caught type or syntax issues early.

## Memory And Planning

- `memory` - Read repo memory notes for prior auth cleanup and web-auth bootstrap context, then stored the new cleanup and routing facts for later reuse.
- `manage_todo_list` - Tracked the next work items while moving from infrastructure cleanup to Web auth verification.

## Editing

- `apply_patch` - Updated existing files and added new files in one shot, including auth cleanup helpers, route aliases, Playwright config, and web test helpers.
- `create_file` - Created new helper and alias modules when the cleanest approach was to add a full file instead of patching piecemeal.

## Terminal And Process Control

- `run_in_terminal` - Started and probed local services, ran focused Vitest and Playwright suites, inspected ports with `lsof`, and checked HTTP responses with `curl`.
- `get_terminal_output` - Retrieved the output from long-running or background terminal commands to see the real startup failure or test results.
- `await_terminal` - Waited for a background command to finish when the output needed to be collected after the fact.
- `terminal_last_command` - Used earlier in the session context to understand the most recent shell action.

## Browser Automation And UI Verification

- `open_browser_page` - Opened the live Hakumi web app in the integrated browser to inspect actual rendered pages.
- `read_page` - Inspected page structure, URL state, and visible UI elements without relying on screenshots.
- `click_element` - Clicked buttons and links in the live browser when driving auth flows.
- `type_in_page` - Entered email addresses and other form values directly into browser elements.
- `run_playwright_code` - Executed small Playwright snippets against a live browser page to inspect DOM behavior and validate submission strategies.
- `screenshot_page` - Available during the work, though the main verification path relied on `read_page` and direct interaction instead.

## Validation And Test Execution

- `runTests` - Available for unit test execution, though the focused verification here was done with `run_in_terminal` and Playwright/Vitest commands directly.
- `playwright config and webServer probing` - Used the browser test config together with terminal checks to make sure the dev stack could be reused instead of restarted unnecessarily.

## Practical Lessons

- The Web auth journey suite needed the real hidden OTP form field submitted, not the masked digit inputs shown in the UI.
- The Web app’s `/home` route needed to be made real again as a protected alias route so the journey tests matched the shipped behavior.
- Playwright server reuse depends on stable readiness URLs; probing an unhealthy root path caused the local stack to look broken when it was actually up.
- The API test cleanup route was the right place to centralize auth-state resets, because the browser tests and API contract tests needed the same reset behavior.
