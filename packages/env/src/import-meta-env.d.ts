// Vite inlines `import.meta.env` only for the literal expression, so the access in
// `createClientEnv` must stay literal. Declared here, not in a module, so it is never
// emitted into the package's public declarations (which would clash with Vite's own).
interface ImportMeta {
  readonly env?: unknown;
}
