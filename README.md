## hominem

### Scripts

**local environment check**

```sh
`bun run dev:doctor`
```

**Install deps**

```sh
$ bun install
```

**Build all packages:**

```sh
$ bun run build
```

**Develop**

```sh
$ bun run dev
```

Root scripts are intentionally minimal during the rebuild:

- `bun run dev`
- `bun run build`
- `bun run test`
- `bun run lint` (workspace lint + native typecheck + duplication)
- `bun run format`

Use filtering for targeted work instead of extra root aliases:

- `bun run build --filter @hominem/web`
- `bun run test --filter @hominem/api`
- `bun run dev --filter @hominem/api --filter @hominem/web`
- `bun run --filter @hominem/mobile check:expo-config`
- `bun run --filter @hominem/api test:auth:contract`

### Rebuild command surface

The repo is in a rebuild phase. Use the root `Makefile` only for:

- core orchestration
- local infra bootstrap
- current DB verification helpers
