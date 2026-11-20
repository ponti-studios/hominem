import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { writeFileAtomic } from './files.js';
import { loadClient, loadToken } from './google.js';
import { RCLONE_REMOTE } from './paths.js';
import { rcloneTokenJson, upsertRcloneRemote } from './rclone-config.js';

const run = promisify(execFile);

export async function openUrl(url: string): Promise<void> {
  await run('open', [url]);
}

// Posts a macOS notification. Message text is ours, so no escaping needed.
export async function notify(title: string, message: string): Promise<void> {
  await run('osascript', ['-e', `display notification "${message}" with title "${title}"`]).catch(
    () => undefined,
  );
}

// Mirrors the Hominem token into the rclone `gdrive` remote, so one login serves both the CLI and
// rclone. Skips quietly when rclone isn't installed.
export async function syncRclone(): Promise<string> {
  let confPath: string;
  try {
    const { stdout } = await run('rclone', ['config', 'file']);
    // Output is "Configuration file is stored at:\n<path>\n" (or "doesn't exist" variant).
    confPath = stdout.trim().split('\n').at(-1)?.trim() ?? '';
  } catch {
    return 'rclone not installed; skipped rclone sync.';
  }
  if (!confPath.startsWith('/'))
    return 'Could not find the rclone config file; skipped rclone sync.';

  const [client, token] = await Promise.all([loadClient(), loadToken()]);
  const current = await readFile(confPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    // Only a missing file is an empty config; anything else must not be overwritten.
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  if (current.startsWith('RCLONE_ENCRYPT_V0:')) {
    return 'rclone config is encrypted; skipped rclone sync.';
  }
  // Edit the file directly: `rclone config update` would put the secrets in argv, visible to `ps`.
  const next = upsertRcloneRemote(current, RCLONE_REMOTE, {
    // Only a brand-new remote needs these; an existing one keeps its own.
    ...(current.includes(`[${RCLONE_REMOTE}]`) ? {} : { type: 'drive', scope: 'drive' }),
    client_id: client.client_id,
    client_secret: client.client_secret,
    token: rcloneTokenJson(token),
  });
  await writeFileAtomic(confPath, next);
  return `rclone remote '${RCLONE_REMOTE}' updated.`;
}
