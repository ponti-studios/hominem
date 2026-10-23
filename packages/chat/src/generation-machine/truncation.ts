/**
 * Trim a reply that was cut off by the provider's output cap back to its last complete sentence.
 * Returns an empty string when no complete sentence is left.
 */
export function trimToLastSentence(text: string): string {
  const trimmed = text.trimEnd();
  let end = -1;
  // A terminator only counts when whitespace or the end follows it, so "3.5" is not a sentence end.
  for (const match of trimmed.matchAll(/[.!?]["'”’)\]]*(?=\s|$)/g)) {
    end = match.index + match[0].length;
  }
  return end === -1 ? '' : trimmed.slice(0, end);
}
