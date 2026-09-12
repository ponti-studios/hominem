import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type LoginEntry = 'login' | 'settings' | 'settings-ai' | 'settings-ai-footprint';

type ManifestChunk = {
  css?: string[];
  file: string;
  imports?: string[];
};

type Manifest = Record<string, ManifestChunk>;

const entrySource: Record<LoginEntry | 'login-assets', string> = {
  'login-assets': 'src/routes/login/client-assets.ts',
  login: 'src/routes/login/browser.ts',
  settings: 'src/routes/login/settings.ts',
  'settings-ai': 'src/routes/login/settings-ai.ts',
  'settings-ai-footprint': 'src/routes/login/settings-ai-footprint.ts',
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

export function loginAssets(entry: LoginEntry) {
  if (process.env.NODE_ENV !== 'production') {
    return {
      scripts: ['/@vite/client', '/src/routes/login/client-assets.ts', `/${entrySource[entry]}`],
      styles: [],
    };
  }

  const manifest = getProductionManifest();
  const assetsSource = entrySource['login-assets'];
  const entrySourcePath = entrySource[entry];
  const assetChunk = manifest[assetsSource];
  const entryChunk = manifest[entrySourcePath];
  if (!assetChunk || !entryChunk)
    throw new Error(`Missing Vite login asset entry for ${entrySourcePath}`);

  return {
    scripts: [`/${assetChunk.file}`, `/${entryChunk.file}`],
    styles: stylesFor(manifest, assetsSource),
  };
}

export type { LoginEntry };
