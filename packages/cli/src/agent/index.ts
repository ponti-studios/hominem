import { main as calendar } from './calendar/main.ts';
import { chatMain } from './chat.ts';
import { main as tasks } from './connectors/google-tasks/google_tasks.ts';
import { main as gws } from './connectors/gws-log/gws_log.ts';
import { main as instagram } from './connectors/instagram/instagram.ts';
import { main as linear } from './connectors/linear-log/linear_log.ts';
import { main as notion } from './connectors/notion-log/notion_log.ts';
import { main as ponti } from './connectors/ponti-log/ponti_log.ts';
import { main as spotify } from './connectors/spotify/spotify.ts';
import { main as starling } from './connectors/starling/starling.ts';
import { main as ytm } from './connectors/youtube-music/ytm.ts';
import { main as knowledge } from './knowledge/main.ts';
import { main as cadence } from './routines/cadence_regen.ts';
import { main as studio } from './studio/main.ts';
import { main as balanceCheck } from './systems/wealth-manager/balance_check.ts';
import { main as sync } from './systems/wealth-manager/daily_sync.ts';
import { applyEnvDefaults } from './systems/wealth-manager/env.ts';
import { main as look } from './systems/wealth-manager/forward_look.ts';
import { main as integrity } from './systems/wealth-manager/integrity_check.ts';
import { main as close } from './systems/wealth-manager/monthly_close.ts';
import { main as brief } from './systems/wealth-manager/morning_brief.ts';
import { main as seed } from './systems/wealth-manager/seed.ts';
import { main as workflow } from './workflows/main.ts';

export const AGENT_COMMANDS = new Set([
  'chat',
  'remember',
  'recall',
  'reflect',
  'wealth',
  'cadence',
  'tasks',
  'gws',
  'spotify',
  'starling',
  'instagram',
  'ytm',
  'linear',
  'notion',
  'ponti',
  'knowledge',
  'workflow',
  'studio',
  'calendar',
]);

export async function runAgent(argv: string[]): Promise<number> {
  applyEnvDefaults();
  const [command, ...args] = argv;
  switch (command) {
    case 'chat':
      return chatMain('chat', args);
    case 'remember':
      return chatMain('remember', args);
    case 'recall':
      return chatMain('recall', args);
    case 'reflect':
      return chatMain('reflect', args);
    case 'wealth':
      return runWealth(args);
    case 'cadence':
      return cadence(args);
    case 'tasks':
      return tasks(args);
    case 'gws':
      return gws(args);
    case 'spotify':
      return spotify(args);
    case 'starling':
      return starling(args);
    case 'instagram':
      return instagram(args);
    case 'ytm':
      return ytm(args);
    case 'linear':
      return linear(args);
    case 'notion':
      return notion(args);
    case 'ponti':
      return ponti(args);
    case 'knowledge':
      return knowledge(args);
    case 'workflow':
      return workflow(args);
    case 'studio':
      return studio(args);
    case 'calendar':
      return calendar(args);
    default:
      return 2;
  }
}

async function runWealth(argv: string[]): Promise<number> {
  switch (argv[0]) {
    case 'sync':
      return sync();
    case 'integrity':
      return integrity();
    case 'brief':
      return brief();
    case 'look':
      return look();
    case 'close':
      return close();
    case 'balances':
      return balanceCheck();
    case 'seed':
      return seed();
    default:
      process.stderr.write(
        'hominem wealth: expected sync, integrity, brief, look, close, balances, or seed\n',
      );
      return 2;
  }
}
