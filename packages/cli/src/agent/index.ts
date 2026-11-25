import { applyEnvDefaults } from '../env.ts';
import { main as calendar } from './calendar/main.ts';
import { chatMain } from './chat.ts';
import { main as tasks } from './connectors/google-tasks/google_tasks.ts';
import { main as gws } from './connectors/gws-log/gws_log.ts';
import { main as instagram } from './connectors/instagram/instagram.ts';
import { main as linear } from './connectors/linear-log/linear_log.ts';
import { main as notion } from './connectors/notion-log/notion_log.ts';
import { main as plaid } from './connectors/plaid/plaid.ts';
import { main as ponti } from './connectors/ponti-log/ponti_log.ts';
import { main as spotify } from './connectors/spotify/spotify.ts';
import { main as starling } from './connectors/starling/starling.ts';
import { main as ytm } from './connectors/youtube-music/ytm.ts';
import { main as knowledge } from './knowledge/main.ts';
import { main as cadence } from './routines/cadence_regen.ts';
import { main as studio } from './studio/main.ts';
import { main as workflow } from './workflows/main.ts';

export const AGENT_COMMANDS = new Set([
  'chat',
  'remember',
  'recall',
  'reflect',
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
  'plaid',
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
    case 'plaid':
      return plaid(args);
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
