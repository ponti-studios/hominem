import { type GetPromptResult, type McpServer } from '@modelcontextprotocol/server';

import type { McpRequestScope } from '../resources';

export type PromptRegistrar = (mcpServer: McpServer, scope: McpRequestScope) => void;

export function userPrompt(description: string, text: string): GetPromptResult {
  return { description, messages: [{ role: 'user', content: { type: 'text', text } }] };
}
