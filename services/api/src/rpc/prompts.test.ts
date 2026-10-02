import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildChatSystemPrompt,
  CHAT_ASSISTANT_PROMPT,
  CHAT_RESPONSE_LENGTH_GUIDANCE,
  CHAT_TO_NOTE_PROMPT,
  getCurrentUtcDate,
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

    for (const [length, guidance] of Object.entries(CHAT_RESPONSE_LENGTH_GUIDANCE)) {
      const prompt = buildChatSystemPrompt(length as keyof typeof CHAT_RESPONSE_LENGTH_GUIDANCE);
      expect(prompt).toContain(CHAT_ASSISTANT_PROMPT);
      expect(prompt).toContain(guidance);
    }
  });

  // Regression: with a MEMORY section and no tasks section, a live model saved "i need to
  // renew my passport on november 16th" as a memory instead of creating a task.
  it('tells the assistant that things to do are tasks, not memories', () => {
    expect(CHAT_ASSISTANT_PROMPT).toContain('TASKS:');
    expect(CHAT_ASSISTANT_PROMPT).toContain('call task_create right away');
    expect(CHAT_ASSISTANT_PROMPT).toContain('even if they never say "add a task"');
    expect(CHAT_ASSISTANT_PROMPT).toContain('i need to renew my passport on march 15th');
    expect(CHAT_ASSISTANT_PROMPT).toContain('A task is not a memory');
    // Memory is steered away from commitments, and from loose references to tasks.
    expect(CHAT_ASSISTANT_PROMPT).toContain('is a task, not a memory (see TASKS)');
    expect(CHAT_ASSISTANT_PROMPT).toContain('does not apply to requests about the user');
    expect(CHAT_ASSISTANT_PROMPT).toContain('do not search memories for them');
    expect(CHAT_ASSISTANT_PROMPT).toContain('only when the user asked to filter by them');
    expect(CHAT_ASSISTANT_PROMPT).toContain('call task_list again without filters');
    // The original bug: "let me check your tasks" and no call.
    expect(CHAT_ASSISTANT_PROMPT).toContain('Never end a reply by announcing an action');
    // Deleting goes straight to task_delete; the app, not the model, asks for approval.
    expect(CHAT_ASSISTANT_PROMPT).toContain('call task_delete with its id right away');
    expect(CHAT_ASSISTANT_PROMPT).toContain('never ask "do you want me to delete it?"');
  });

  it('keeps the Ori chat prompt snapshot aligned with production', () => {
    const messages = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../ori/data/chat-assistant/prompt.json'),
        'utf8',
      ),
    ) as Array<{ role: string; content: string }>;
    expect(
      messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content.replace('{{current_date}}', getCurrentUtcDate()))
        .join('\n\n'),
    ).toBe(buildChatSystemPrompt(undefined, getCurrentUtcDate()));
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
