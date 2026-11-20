import type { TokenFile } from './google.js';

// The token in the shape rclone's drive backend stores it.
export function rcloneTokenJson(token: TokenFile): string {
  return JSON.stringify({
    access_token: token.token,
    token_type: 'Bearer',
    refresh_token: token.refresh_token,
    expiry: token.expiry,
  });
}

// Sets `fields` in the `[name]` section of an rclone.conf, creating the section if it's missing
// and leaving every other key and section alone. We edit the file instead of calling
// `rclone config update` because that would put the client secret and token in argv, where
// `ps` can see them.
export function upsertRcloneRemote(
  conf: string,
  name: string,
  fields: Record<string, string>,
): string {
  const lines = conf === '' ? [] : conf.replace(/\n$/, '').split('\n');
  const header = `[${name}]`;
  const start = lines.findIndex((line) => line.trim() === header);

  if (start === -1) {
    const section = [header, ...Object.entries(fields).map(([key, value]) => `${key} = ${value}`)];
    return `${[...lines, ...(lines.length ? [''] : []), ...section].join('\n')}\n`;
  }

  let end = lines.findIndex((line, index) => index > start && /^\s*\[.+\]\s*$/.test(line));
  if (end === -1) end = lines.length;
  const pending = new Map(Object.entries(fields));
  const section = lines.slice(start + 1, end).map((line) => {
    const key = line.split('=')[0]?.trim() ?? '';
    const value = pending.get(key);
    if (value === undefined) return line;
    pending.delete(key);
    return `${key} = ${value}`;
  });
  // Insert new keys before any trailing blank lines so sections stay separated.
  let insertAt = section.length;
  while (insertAt > 0 && section[insertAt - 1] === '') insertAt -= 1;
  section.splice(insertAt, 0, ...[...pending].map(([key, value]) => `${key} = ${value}`));
  return `${[...lines.slice(0, start + 1), ...section, ...lines.slice(end)].join('\n')}\n`;
}
