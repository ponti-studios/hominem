import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const rootTsconfig = await Bun.file(path.join(rootDir, 'tsconfig.json')).json();

if (!Array.isArray(rootTsconfig.references)) {
  throw new Error('Root tsconfig.json does not define project references');
}

const configs = rootTsconfig.references
  .map((ref) => {
    if (!ref || typeof ref.path !== 'string') return null;
    return ref.path.endsWith('.json')
      ? path.resolve(rootDir, ref.path)
      : path.resolve(rootDir, ref.path, 'tsconfig.json');
  })
  .filter(Boolean);

// Run all tsgo checks in parallel, buffering each project's output
const results = await Promise.all(
  configs.map(async (configPath) => {
    const rel = path.relative(rootDir, configPath);
    const proc = Bun.spawn({
      cmd: ['bun', 'x', 'tsgo', '-p', configPath, '--noEmit'],
      cwd: rootDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { rel, stdout, stderr, exitCode };
  }),
);

const failed = [];
for (const { rel, stdout, stderr, exitCode } of results) {
  const ok = exitCode === 0;
  console.log(`\n[native-typecheck] ${rel} ${ok ? '✅' : '❌'}`);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (!ok) failed.push(rel);
}

if (failed.length > 0) {
  console.error('\nNative TypeScript checks failed for:');
  for (const rel of failed) console.error(`  - ${rel}`);
  process.exit(1);
}

console.log('\nNative TypeScript checks passed');
