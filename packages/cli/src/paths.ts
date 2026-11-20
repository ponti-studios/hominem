import { homedir } from 'node:os';
import { join } from 'node:path';

// Same resolution as the Python skill scripts: $HOMINEM_HOME, else ~/.hominem.
export const HOMINEM_HOME = process.env.HOMINEM_HOME?.trim() || join(homedir(), '.hominem');
export const TOKEN_PATH = join(HOMINEM_HOME, 'google_token.json');
export const CLIENT_SECRET_PATH = join(HOMINEM_HOME, 'google_client_secret.json');

export const LAUNCH_AGENT_LABEL = 'io.ponti.hominem.auth-check';
export const LAUNCH_AGENT_PATH = join(
  homedir(),
  'Library',
  'LaunchAgents',
  `${LAUNCH_AGENT_LABEL}.plist`,
);
export const LAUNCH_AGENT_LOG = join(homedir(), 'Library', 'Logs', 'hominem-auth-check.log');

export const RCLONE_REMOTE = 'gdrive';
