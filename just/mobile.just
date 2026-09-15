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
