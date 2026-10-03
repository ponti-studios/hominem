import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ChatResponseLength } from '../chat/chat-prompts';
import {
  buildChatSystemPrompt,
  CHAT_ASSISTANT_PROMPT,
  CHAT_RESPONSE_LENGTH_GUIDANCE,
  CHAT_TO_NOTE_PROMPT,
  getCurrentUtcDate,
  TIME_BLOCK_EXTRACTION_PROMPT,
} from './prompts';

describe('chat assistant personality', () => {
  it('requires calm, respectful candor without a performed persona', () => {
    expect(CHAT_ASSISTANT_PROMPT).toContain('clear, calm, and capable');
    expect(CHAT_ASSISTANT_PROMPT).toContain('Correct flawed reasoning clearly');
    expect(CHAT_ASSISTANT_PROMPT).toContain('Do not mirror profanity, anger, or intensity');
    expect(CHAT_ASSISTANT_PROMPT).toContain('Never mock, shame, patronize, or use sarcasm');
  });

  it('does not instruct the assistant to be sarcastic or imitate familiarity', () => {
    expect(CHAT_ASSISTANT_PROMPT).not.toContain('slightly sarcastic');
    expect(CHAT_ASSISTANT_PROMPT).not.toContain('best friend of 30 years');
    expect(CHAT_ASSISTANT_PROMPT).not.toContain('Match the user’s intensity');
  });

  it('makes default brevity explicit and appends each selected length mode', () => {
    expect(CHAT_ASSISTANT_PROMPT).toContain('answer in one or two sentences');
    expect(CHAT_ASSISTANT_PROMPT).toContain(
      'Do not add context, action plans, generic reassurance',
    );
    expect(buildChatSystemPrompt()).toContain(CHAT_ASSISTANT_PROMPT);
    expect(buildChatSystemPrompt()).toMatch(/CURRENT DATE \(UTC\): \d{4}-\d{2}-\d{2}/);

    const lengths: ChatResponseLength[] = ['short', 'medium', 'long'];
    expect([...lengths].sort()).toEqual(Object.keys(CHAT_RESPONSE_LENGTH_GUIDANCE).sort());
    for (const length of lengths) {
      const prompt = buildChatSystemPrompt(length);
      expect(prompt).toContain(CHAT_ASSISTANT_PROMPT);
      expect(prompt).toContain(CHAT_RESPONSE_LENGTH_GUIDANCE[length]);
    }
  });

  it('keeps the Ori chat prompt snapshot aligned with production', () => {
    const messages: Array<{ role: string; content: string }> = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../ori/data/chat-assistant/prompt.json'),
        'utf8',
      ),
    );
    expect(
      messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content.replace('{{current_date}}', getCurrentUtcDate()))
        .join('\n\n'),
    ).toBe(buildChatSystemPrompt(undefined, getCurrentUtcDate()));
  });
});

describe('time-block extraction prompt', () => {
  it('keeps the Ori time-block snapshot aligned with production', () => {
    const messages: Array<{ role: string; content: string }> = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../ori/data/time-block-extraction/prompt.json'),
        'utf8',
      ),
    );
    const system = messages.find((message) => message.role === 'system')?.content;
    expect(system?.endsWith(TIME_BLOCK_EXTRACTION_PROMPT)).toBe(true);
  });
});

describe('chat-to-note transform prompt', () => {
  it('frames the input as a transcript to transform, not text to edit', () => {
    expect(CHAT_TO_NOTE_PROMPT).toContain('"User:" and "Assistant:" turns');
    expect(CHAT_TO_NOTE_PROMPT).toContain("Write one continuous document in the user's own voice");
  });

  it('forbids inventing facts and requires flagging unresolved threads', () => {
    expect(CHAT_TO_NOTE_PROMPT).toContain('Do not invent facts');
    expect(CHAT_TO_NOTE_PROMPT).toContain('say so plainly rather than resolving it yourself');
  });

  it('never emits a title, since the app sets it separately', () => {
    expect(CHAT_TO_NOTE_PROMPT).toContain('Do not add a title, heading, or front matter');
  });
});
