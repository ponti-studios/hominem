import type { ChatFunctionTool } from '@hominem/ai';

/** A function tool's name; a built-in tool such as web search is named by its type. */
export function chatToolName(tool: ChatFunctionTool): string {
  return 'function' in tool ? tool.function.name : tool.type;
}
