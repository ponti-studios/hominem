// Browser calls must target the public API origin (root AGENTS.md): the web
// server is not an API proxy. In unit tests the env var is unset, so keeping the
// path relative lets existing fetch assertions stay meaningful.
export function careerApiUrl(path: string): string {
  const base = import.meta.env.VITE_PUBLIC_API_URL;
  return base ? new URL(path, base).toString() : path;
}
