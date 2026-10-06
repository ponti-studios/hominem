import { getReasoningConfig as getModelReasoningConfig, type ChatMessages } from '@hominem/ai';
import type { ChatMessageSnapshot } from '@hominem/chat';
import type { ChatMessageFileRecord, NoteContext } from '@hominem/db/chats';
import { isObject } from '@hominem/utils';

export const RESPONSE_LENGTH_MAX_TOKENS: Record<'short' | 'medium' | 'long', number> = {
  short: 250,
  medium: 1600,
  long: 6000,
};

export const getReasoningConfig = getModelReasoningConfig;

export function getMaxTokens(
  model: string,
  responseLength?: keyof typeof RESPONSE_LENGTH_MAX_TOKENS,
) {
  if (model.startsWith('meta/muse-spark-1.3')) return 1_600;
  return responseLength ? RESPONSE_LENGTH_MAX_TOKENS[responseLength] : undefined;
}

export function toStoredUserMessageContent(
  message: string,
  files: ChatMessageFileRecord[],
): string {
  const trimmed = message.trim();
  if (trimmed.length > 0) return trimmed;
  if (files.length > 0) return files.map((file) => file.filename ?? 'Attachment').join(', ');
  return '';
}

export function formatUserContentWithContext(
  message: string,
  notes: NoteContext[],
  files: ChatMessageFileRecord[],
): string {
  const sections = [message.trim()];
  if (notes.length > 0) {
    sections.push(
      [
        'Referenced notes:',
        ...notes.map((note, index) => {
          const fileText = note.files
            .flatMap((file) => {
              const snippet = file.textContent ?? file.content;
              return snippet ? [`- ${file.originalName}: ${snippet.slice(0, 1_000)}`] : [];
            })
            .join('\n');
          return [
            `${index + 1}. ${note.title ?? 'Untitled note'} (${note.id})`,
            note.content,
            ...(fileText ? ['Attached files:', fileText] : []),
          ].join('\n');
        }),
      ].join('\n\n'),
    );
  }
  if (files.length > 0) {
    sections.push(
      [
        'Attached files:',
        ...files.map((file, index) => {
          const extractedText =
            isObject(file.metadata) && 'extractedText' in file.metadata
              ? String(file.metadata.extractedText)
              : '';
          return [
            `${index + 1}. ${file.filename ?? 'Attachment'} (${file.mimeType ?? 'application/octet-stream'})`,
            ...(extractedText ? [extractedText] : []),
          ].join('\n');
        }),
      ].join('\n\n'),
    );
  }
  return sections.filter(Boolean).join('\n\n');
}

export function buildMessages(
  history: ChatMessageSnapshot[],
  currentUserContent: string,
  systemPrompt: string,
): ChatMessages[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history.map((entry): ChatMessages => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content,
    })),
    { role: 'user', content: currentUserContent },
  ];
}
