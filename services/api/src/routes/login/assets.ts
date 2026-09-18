import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type LoginEntry =
  | 'login'
  | 'consent'
  | 'logout'
  | 'error'
  | 'settings'
  | 'settings-ai'
  | 'settings-ai-footprint';

type ManifestChunk = {
  css?: string[];
  file: string;
  imports?: string[];
};

type Manifest = Record<string, ManifestChunk>;

const entrySource: Record<LoginEntry, string> = {
  login: 'src/routes/login/app/entries/login.tsx',
  consent: 'src/routes/login/app/entries/consent.tsx',
  logout: 'src/routes/login/app/entries/logout.tsx',
  error: 'src/routes/login/app/entries/error.tsx',
  settings: 'src/routes/login/app/entries/settings.tsx',
  'settings-ai': 'src/routes/login/app/entries/settings-ai.tsx',
  'settings-ai-footprint': 'src/routes/login/app/entries/settings-ai-footprint.tsx',
};

let productionManifest: Manifest | undefined;

function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every(
    (chunk) =>
      chunk && typeof chunk === 'object' && 'file' in chunk && typeof chunk.file === 'string',
  );
}

function getProductionManifest(): Manifest {
  if (productionManifest) return productionManifest;
  const manifestPath = join(process.cwd(), 'dist', 'public', '.vite', 'manifest.json');
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!isManifest(manifest)) throw new Error(`Invalid Vite manifest: ${manifestPath}`);
  productionManifest = manifest;
  return productionManifest;
}

function stylesFor(manifest: Manifest, source: string): string[] {
  const styles = new Set<string>();
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing Vite manifest entry: ${key}`);
    chunk.css?.forEach((css) => styles.add(`/${css}`));
    chunk.imports?.forEach(visit);
  };
  visit(source);
  return [...styles];
}

// Every entry imports app/mount.tsx, which imports styles.css (Tailwind +
// auth tokens) — so the shared stylesheet rides along with the entry chunk
// rather than needing its own synthetic entry.
export function loginAssets(entry: LoginEntry) {
  if (process.env.NODE_ENV !== 'production') {
    return {
      scripts: ['/@vite/client', `/${entrySource[entry]}`],
      styles: [],
    };
  }

  const manifest = getProductionManifest();
  const entrySourcePath = entrySource[entry];
  const entryChunk = manifest[entrySourcePath];
  if (!entryChunk) throw new Error(`Missing Vite login asset entry for ${entrySourcePath}`);

  return {
    scripts: [`/${entryChunk.file}`],
    styles: stylesFor(manifest, entrySourcePath),
  };
}

export type { LoginEntry };
