import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { promisify } from 'node:util';

import { HOMINEM_HOME, LAUNCH_AGENT_LABEL, LAUNCH_AGENT_LOG, LAUNCH_AGENT_PATH } from './paths.js';

const run = promisify(execFile);

export function escapeXml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderPlist(input: {
  label: string;
  binary: string;
  log: string;
  home: string;
}): string {
  const { label, binary, log, home } = input;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(label)}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${escapeXml(binary)}</string>
        <string>auth</string>
        <string>check</string>
        <string>--notify</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOMINEM_HOME</key>
        <string>${escapeXml(home)}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${escapeXml(log)}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(log)}</string>
</dict>
</plist>
`;
}

const domain = () => `gui/${process.getuid?.() ?? 501}`;

// Point the agent at the compiled binary. macOS lists background items by the
// executable name, so this must be the `hominem` binary, not `bun` or `node`.
export async function installAgent(): Promise<string> {
  if (basename(process.execPath) !== 'hominem') {
    throw new Error('Run `agent install` from the compiled hominem binary, not via bun/node.');
  }
  await mkdir(dirname(LAUNCH_AGENT_PATH), { recursive: true });
  await mkdir(dirname(LAUNCH_AGENT_LOG), { recursive: true });
  await writeFile(
    LAUNCH_AGENT_PATH,
    renderPlist({
      label: LAUNCH_AGENT_LABEL,
      binary: process.execPath,
      log: LAUNCH_AGENT_LOG,
      home: HOMINEM_HOME,
    }),
  );
  await run('launchctl', ['bootout', domain(), LAUNCH_AGENT_PATH]).catch(() => undefined);
  await run('launchctl', ['bootstrap', domain(), LAUNCH_AGENT_PATH]);
  return `Installed ${LAUNCH_AGENT_LABEL} → ${process.execPath}`;
}

export async function uninstallAgent(): Promise<string> {
  await run('launchctl', ['bootout', domain(), LAUNCH_AGENT_PATH]).catch(() => undefined);
  await rm(LAUNCH_AGENT_PATH, { force: true });
  return `Removed ${LAUNCH_AGENT_LABEL}`;
}
