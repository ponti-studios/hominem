/**
 * The models offered for writing replies, shared by the API (which only accepts these) and every
 * app that lets a person pick one. The first is the default.
 */

export type ReplyModel = { id: string; name: string; note: string };

export const REPLY_MODELS: readonly ReplyModel[] = [
  {
    id: 'anthropic/claude-haiku-5.5',
    name: 'Claude Haiku 5.5',
    note: 'Anthropic · the default, quickest to start',
  },
  { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna', note: 'OpenAI' },
  {
    id: 'deepseek/deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    note: 'DeepSeek · offers new angles',
  },
  { id: 'meta/muse-glimmer-30b', name: 'Muse Glimmer 30B', note: 'Meta · thinks briefly' },
  { id: 'z-ai/glm-4.7-flash', name: 'GLM 4.7 Flash', note: 'Z.ai · cheapest' },
];

export const DEFAULT_REPLY_MODEL = REPLY_MODELS[0].id;

export const isReplyModelId = (id: string): boolean =>
  REPLY_MODELS.some((model) => model.id === id);

export const replyModelName = (id: string): string =>
  REPLY_MODELS.find((model) => model.id === id)?.name ?? id.split('/').pop() ?? id;

export type ReplyModelPrice = { inputPerMillion: number; outputPerMillion: number };

/** A USD-per-million price as the people reading it expect: "$0.42", "$3", "$12.50". */
export function formatPrice(usdPerMillion: number): string {
  if (usdPerMillion < 1) return `$${usdPerMillion.toFixed(2)}`;
  return `$${usdPerMillion.toFixed(usdPerMillion % 1 === 0 ? 0 : 2)}`;
}
