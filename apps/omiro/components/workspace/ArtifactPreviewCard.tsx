import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text, useThemeColors } from '~/components/theme';
import type { WorkspaceArtifactKind } from '~/services/workspace/routes';
import t from '~/translations';

interface ArtifactPreviewCardProps {
  kind: WorkspaceArtifactKind;
  preview: string | null;
  title: string | null;
}

export function ArtifactPreviewCard({ kind, preview, title }: ArtifactPreviewCardProps) {
  const themeColors = useThemeColors();
  const kindLabel = kind === 'chat' ? t.workspace.item.chatLabel : t.workspace.item.noteLabel;
  const resolvedTitle =
    title?.trim() ||
    (kind === 'chat' ? t.workspace.item.untitledSession : t.workspace.item.untitledNote);

  return (
    <View
      accessibilityLabel={t.workspace.home.previewLabel(kind)}
      style={[
        styles.card,
        {
          backgroundColor: themeColors['bg-surface'],
          borderColor: themeColors['border-default'],
        },
      ]}
    >
      <Text style={[styles.kind, { color: themeColors['text-tertiary'] }]}>{kindLabel}</Text>
      <Text style={[styles.title, { color: themeColors.foreground }]} numberOfLines={2}>
        {resolvedTitle}
      </Text>
      {preview ? (
        <Text style={[styles.preview, { color: themeColors['text-secondary'] }]} numberOfLines={4}>
          {preview}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    minHeight: 180,
    padding: 20,
  },
  kind: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  preview: {
    fontSize: 15,
    lineHeight: 21,
  },
});
