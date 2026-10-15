import { completable, type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { canUseTool, type McpRequestScope } from '../resources';
import { userPrompt } from './types';

const AUDIENCES = ['manager', 'recruiter', 'linkedin', 'peers'] as const;

export function registerCareerPrompts(mcpServer: McpServer, scope: McpRequestScope): void {
  if (!canUseTool(scope, 'career_profile')) return;

  mcpServer.registerPrompt(
    'career_update_draft',
    {
      title: 'Career update draft',
      description: 'Draft a career update from your profile and recent engagements.',
      argsSchema: z.object({
        audience: completable(z.string(), (value) =>
          AUDIENCES.filter((candidate) => candidate.startsWith(value.toLowerCase())),
        ).optional(),
      }),
    },
    ({ audience }) =>
      userPrompt(
        'Career update draft',
        [
          `Draft a career update${audience ? ` for my ${audience}` : ''}.`,
          'Call career_profile to read my roles, skills and recent engagements, then write a concise update highlighting recent accomplishments and what I am working toward.',
          'Only state things that are in my profile; ask me about anything that seems missing rather than inventing it.',
        ].join('\n'),
      ),
  );
}
