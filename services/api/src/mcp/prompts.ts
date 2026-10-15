import type { McpServer } from '@modelcontextprotocol/server';

import { registerCareerPrompts } from './prompts/career';
import { registerFinanceReviewPrompt } from './prompts/finance-review';
import { registerNotePrompts } from './prompts/notes';
import { registerTaskPrompts } from './prompts/tasks';
import type { PromptRegistrar } from './prompts/types';
import type { McpRequestScope } from './resources';

// Add a prompt module here; each registrar owns its prompt definitions and scope checks.
const promptModules: readonly PromptRegistrar[] = [
  registerCareerPrompts,
  registerFinanceReviewPrompt,
  registerNotePrompts,
  registerTaskPrompts,
];

export function registerPrompts(mcpServer: McpServer, scope: McpRequestScope): void {
  for (const registerPromptModule of promptModules) registerPromptModule(mcpServer, scope);
}
