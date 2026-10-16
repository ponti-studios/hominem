# Omiro's studio verbs: setup, doctor, run, sim, check, e2e (see STUDIO.md in the studio-dev repo).
# The work is in apps/omiro/tests/scripts; these are the names everyone uses.

# Dependencies, workspace packages and the scripted API's database. Run first in any checkout or worktree.
setup:
    "{{ justfile_directory() }}/apps/omiro/tests/scripts/setup.sh"

# Read-only checks with a fix named for each problem.
doctor:
    "{{ justfile_directory() }}/apps/omiro/tests/scripts/doctor.sh"

# Build the dev client (ad-hoc signed), install it on the booted simulator. Skips when nothing native changed; FORCE=1 rebuilds.
sim:
    "{{ justfile_directory() }}/apps/omiro/tests/scripts/sim.sh"

# Add a few notes for the e2e user (needs the scripted API running; `just mobile e2e` starts it).
seed:
    "{{ justfile_directory() }}/apps/omiro/tests/scripts/seed.sh"

# Reuse the installed development client for JavaScript and TypeScript work.
run:
    pnpm --filter @hominem/omiro dev

# Regenerate native iOS, rebuild, install, and launch the development client.
rebuild:
    pnpm --filter @hominem/omiro prebuild:dev
    pnpm --filter @hominem/omiro run:ios

# Match the focused checks run by validate-mobile before a change is pushed.
check:
    pnpm run check:dts
    pnpm format:check --filter=@hominem/omiro...
    pnpm lint --filter=@hominem/omiro...
    pnpm build --filter=@hominem/api --filter=@hominem/omiro...
    pnpm typecheck --filter=@hominem/omiro...
    pnpm test --filter=@hominem/omiro...
    pnpm --filter @hominem/omiro export:embed:ios

# Run the installed development client against an isolated E2E Metro session.
maestro *flows:
    pnpm --filter @hominem/omiro run test:maestro -- {{ flows }}

# Runs apps/omiro/.eas/workflows/ota-update.yml to publish a JS-only update
# to the production EAS Update channel after validation and approval.
update message:
    cd apps/omiro && APP_ENV=production pnpm exec eas workflow:run .eas/workflows/ota-update.yml -F message="{{ message }}"
