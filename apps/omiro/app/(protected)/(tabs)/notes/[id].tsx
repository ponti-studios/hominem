import { Redirect, useLocalSearchParams } from 'expo-router';

import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';

export default function LegacyNoteRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = String(id ?? '');

  if (!noteId) {
    return null;
  }

  return <Redirect href={getWorkspaceArtifactRoute('note', noteId)} />;
}
