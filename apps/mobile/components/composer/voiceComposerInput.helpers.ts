export function mergeTranscriptIntoDraft(message: string, transcript: string) {
  const trimmedMessage = message.trimEnd();
  if (!trimmedMessage) return transcript;
  return `${trimmedMessage}\n${transcript}`;
}

export function replaceTranscriptInDraft(draft: string, rawText: string, cleanedText: string) {
  const suffix = draft.endsWith(rawText) ? rawText : null;
  if (!suffix) return draft;

  return `${draft.slice(0, -rawText.length)}${cleanedText}`;
}
