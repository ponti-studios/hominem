import { completable, type GetPromptResult, type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { canUseTool, type McpRequestScope } from './resources';

function userPrompt(description: string, text: string): GetPromptResult {
  return { description, messages: [{ role: 'user', content: { type: 'text', text } }] };
}

// Argument completion over a fixed vocabulary; the client filters as the user types.
function oneOf(values: readonly string[]) {
  // completable() must wrap the base schema; the SDK unwraps .optional() before looking for it.
  return completable(z.string(), (value) =>
    values.filter((candidate) => candidate.startsWith(value.toLowerCase())),
  ).optional();
}

const PERIODS = ['week', 'month'] as const;
const ENERGY_LEVELS = ['low', 'medium', 'high'] as const;
const AUDIENCES = ['manager', 'recruiter', 'linkedin', 'peers'] as const;

export function registerPrompts(mcpServer: McpServer, scope: McpRequestScope): void {
  if (canUseTool(scope, 'task_list')) {
    mcpServer.registerPrompt(
      'weekly_review',
      {
        title: 'Weekly review',
        description: 'Review open and overdue tasks and propose priorities for what comes next.',
        argsSchema: z.object({ period: oneOf(PERIODS) }),
      },
      ({ period }) => {
        const window = period === 'month' ? 'month' : 'week';
        return userPrompt(
          `Review of the past ${window}`,
          [
            `Run a review of my tasks for the past ${window}.`,
            '1. Call task_list with status "pending" to see everything still open.',
            '2. Call task_list with status "pending" and dueBefore set to the current time to find what is overdue.',
            '3. Call task_list with status "completed" to see what I finished.',
            'Then summarize what got done, what is overdue and why it may have slipped, and propose the three most important things to do next. Do not change any tasks unless I ask.',
          ].join('\n'),
        );
      },
    );

    mcpServer.registerPrompt(
      'plan_my_day',
      {
        title: 'Plan my day',
        description: 'Build a realistic plan for today from due and pending tasks.',
        argsSchema: z.object({ energy: oneOf(ENERGY_LEVELS) }),
      },
      ({ energy }) =>
        userPrompt(
          'Plan for today',
          [
            `Help me plan today${energy ? ` — my energy level is ${energy}` : ''}.`,
            '1. Call task_list with status "pending" and dueBefore set to the end of today.',
            '2. Call task_list with status "pending" for anything without a due date that is high priority.',
            'Produce a short ordered plan that fits the day, matching harder work to my energy level, and call out anything that should be deferred. Ask before creating or changing tasks.',
          ].join('\n'),
        ),
    );
  }

  if (canUseTool(scope, 'career_profile')) {
    mcpServer.registerPrompt(
      'career_update_draft',
      {
        title: 'Career update draft',
        description: 'Draft a career update from your profile and recent engagements.',
        argsSchema: z.object({ audience: oneOf(AUDIENCES) }),
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

  if (canUseTool(scope, 'note_create')) {
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
}
