import AgentInstall from './agent/install.js';
import AgentUninstall from './agent/uninstall.js';
import AuthCheck from './auth/check.js';
import AuthGoogle from './auth/google.js';
import Auth from './auth/index.js';
import AuthSyncRclone from './auth/sync-rclone.js';
import Cadence from './cadence.js';
import CalendarAnalyze from './calendar/analyze.js';
import Chat from './chat.js';
import FinanceSync from './finance/sync.js';
import Gws from './gws.js';
import Instagram from './instagram.js';
import Knowledge from './knowledge.js';
import Linear from './linear.js';
import Notion from './notion.js';
import Plaid from './plaid.js';
import Ponti from './ponti.js';
import Recall from './recall.js';
import Reflect from './reflect.js';
import Remember from './remember.js';
import Spotify from './spotify.js';
import Starling from './starling.js';
import Studio from './studio.js';
import Tasks from './tasks.js';
import WealthBalances from './wealth/balances.js';
import WealthBrief from './wealth/brief.js';
import WealthClose from './wealth/close.js';
import WealthIntegrity from './wealth/integrity.js';
import WealthLook from './wealth/look.js';
import WealthSeed from './wealth/seed.js';
import WealthSync from './wealth/sync.js';
import Workflow from './workflow.js';
import Ytm from './ytm.js';

// A compiled binary can't scan this folder, so every command gets listed here.
export const COMMANDS = {
  'agent:install': AgentInstall,
  'agent:uninstall': AgentUninstall,
  auth: Auth,
  'auth:check': AuthCheck,
  'auth:google': AuthGoogle,
  'auth:sync-rclone': AuthSyncRclone,
  cadence: Cadence,
  'calendar:analyze': CalendarAnalyze,
  chat: Chat,
  'finance:sync': FinanceSync,
  gws: Gws,
  instagram: Instagram,
  knowledge: Knowledge,
  linear: Linear,
  notion: Notion,
  plaid: Plaid,
  ponti: Ponti,
  recall: Recall,
  reflect: Reflect,
  remember: Remember,
  spotify: Spotify,
  starling: Starling,
  studio: Studio,
  tasks: Tasks,
  'wealth:balances': WealthBalances,
  'wealth:brief': WealthBrief,
  'wealth:close': WealthClose,
  'wealth:integrity': WealthIntegrity,
  'wealth:look': WealthLook,
  'wealth:seed': WealthSeed,
  'wealth:sync': WealthSync,
  workflow: Workflow,
  ytm: Ytm,
};
