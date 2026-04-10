## 1. Inventory and classify current boundaries

- [x] 1.1 Audit existing app, domain, data, RPC, and UI modules for mixed responsibilities.
- [x] 1.2 Identify every ambiguous file name that needs to be replaced with a suffix-specific module.
- [x] 1.3 Map each affected module to its target layer before moving any code.

## 2. Normalize module ownership and filenames

- [x] 2.1 Split mixed-concern modules into layer-specific files such as `*.types.ts`, `*.schema.ts`, `*.db.ts`, `*.rpc.ts`, `*.mapper.ts`, `*.service.ts`, `*.repository.ts`, `*.vm.ts`, and `*.hooks.ts`.
- [x] 2.2 Move or rename legacy `contracts.ts` and other vague files to precise layer-owned modules.
- [x] 2.3 Rehome shared code into narrowly scoped packages only when a clear boundary role exists.

## 3. Add explicit boundary transformations

- [x] 3.1 Introduce mappers for domain-to-transport and domain-to-UI shape changes in the major feature areas.
- [x] 3.2 Split runtime validation into `*.schema.ts` files at inbound API or RPC boundaries.
- [x] 3.3 Ensure persistence models stay isolated from RPC and UI shapes.

## 4. Enforce and verify architecture rules

- [x] 4.1 Update workspace or lint rules to block invalid dependency directions between layers.
- [x] 4.2 Verify the monorepo builds and typechecks with the new structure.
- [x] 4.3 Remove obsolete legacy modules once all imports have been migrated.
