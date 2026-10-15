import { type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { canUseTool, type McpRequestScope } from '../resources';
import { userPrompt } from './types';

export function registerNotePrompts(mcpServer: McpServer, scope: McpRequestScope): void {
  if (!canUseTool(scope, 'note_create')) return;

  mcpServer.registerPrompt(
    'capture_note',
    {
      title: 'Capture a note',
      description: 'Turn rough thoughts into a clean, titled note and save it.',
      argsSchema: z.object({ topic: z.string().optional() }),
    },
    ({ topic }) =>
      userPrompt(
        'Capture a note',
        [
          `I want to capture a note${topic ? ` about ${topic}` : ''}.`,
          'Take what I tell you next, give it a short descriptive title, tidy the wording without changing the meaning, and save it with note_create.',
          'Show me the title and saved content afterwards.',
        ].join('\n'),
      ),
  );
}
