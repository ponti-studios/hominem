/**
 * promptfoo prompt function: every case carries its fully rendered chat messages in
 * `vars.messages`, so the prompt templates stay plain JSON and are never re-templated.
 */
export default function renderPrompt({ vars }: { vars: Record<string, unknown> }) {
  return vars.messages;
}
