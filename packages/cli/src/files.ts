import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Write to a temp file in the same folder, then rename over the target. Readers (the
// Python skills share the token file) see the old file or the new one, never a half write.
// The mode is set on the temp file, so it holds even when the target already exists.
export async function writeFileAtomic(path: string, data: string, mode = 0o600): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, data, { mode });
  await rename(temp, path);
}
