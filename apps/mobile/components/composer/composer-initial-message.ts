export function resolveInitialComposerMessage({
  initialDraft,
  seedMessage,
}: {
  initialDraft?: string;
  seedMessage?: string;
}) {
  if (initialDraft && initialDraft.trim().length > 0) {
    return initialDraft;
  }

  return seedMessage ?? initialDraft ?? '';
}
