import {
  Button,
  GlassEffectContainer,
  Host,
  Namespace,
  Text as SwiftUIText,
  VStack,
  HStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  glassEffectId,
} from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Text, useThemeColors } from '~/components/theme';
import { Button as AppButton } from '~/components/ui/button';
import type { WorkspaceResumeArtifact } from '~/services/workspace/routes';
import t from '~/translations';

interface WorkspaceHeroProps {
  onOpenArchivedChats: () => void;
  onOpenSettings: () => void;
  onResumeArtifact?: () => void;
  onStartChat: () => void;
  resumeArtifact: WorkspaceResumeArtifact | null;
}

const IS_IOS_26_OR_NEWER = Platform.OS === 'ios' && Number(Platform.Version) >= 26;

export function WorkspaceHero({
  onOpenArchivedChats,
  onOpenSettings,
  onResumeArtifact,
  onStartChat,
  resumeArtifact,
}: WorkspaceHeroProps) {
  const namespaceId = React.useId();
  const themeColors = useThemeColors();
  const resumeLabel =
    resumeArtifact?.kind === 'chat' ? t.workspace.home.resumeChat : t.workspace.home.resumeNote;

  const primaryButtonModifiers = [
    buttonStyle(IS_IOS_26_OR_NEWER ? 'glassProminent' : 'borderedProminent'),
    glassEffectId('primary-action', namespaceId),
  ];
  const secondaryButtonModifiers = [buttonStyle(IS_IOS_26_OR_NEWER ? 'glass' : 'bordered')];

  if (!IS_IOS_26_OR_NEWER) {
    return (
      <View
        style={[
          styles.fallbackCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        <Text style={[styles.fallbackTitle, { color: themeColors.foreground }]}>
          {t.workspace.home.title}
        </Text>
        <Text style={[styles.fallbackSubtitle, { color: themeColors['text-secondary'] }]}>
          {t.workspace.home.subtitle}
        </Text>
        <View style={styles.fallbackActions}>
          {resumeArtifact ? (
            <AppButton
              label={resumeLabel}
              onPress={() => onResumeArtifact?.()}
              variant="secondary"
            />
          ) : null}
          <AppButton label={t.workspace.home.newChat} onPress={onStartChat} variant="secondary" />
          <AppButton
            label={t.workspace.home.archivedChats}
            onPress={onOpenArchivedChats}
            variant="secondary"
          />
          <AppButton
            label={t.workspace.home.settings}
            onPress={onOpenSettings}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <Host style={styles.host}>
      <Namespace id={namespaceId}>
        <VStack spacing={12}>
          <SwiftUIText modifiers={[font({ size: 34, weight: 'bold' })]}>
            {t.workspace.home.title}
          </SwiftUIText>
          <SwiftUIText
            modifiers={[
              font({ size: 16, weight: 'regular' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            {resumeArtifact
              ? resumeArtifact.title || t.workspace.home.subtitle
              : t.workspace.home.subtitle}
          </SwiftUIText>
          <GlassEffectContainer spacing={18}>
            <VStack spacing={10}>
              <HStack spacing={10}>
                {resumeArtifact ? (
                  <Button
                    label={resumeLabel}
                    onPress={onResumeArtifact}
                    modifiers={[
                      ...primaryButtonModifiers,
                      glassEffect({
                        glass: { variant: 'regular', interactive: true },
                        shape: 'roundedRectangle',
                        cornerRadius: 22,
                      }),
                      frame({ maxWidth: Number.POSITIVE_INFINITY }),
                    ]}
                  />
                ) : null}
                <Button
                  label={t.workspace.home.newChat}
                  onPress={onStartChat}
                  modifiers={[
                    ...secondaryButtonModifiers,
                    glassEffect({
                      glass: { variant: 'clear', interactive: true },
                      shape: 'roundedRectangle',
                      cornerRadius: 22,
                    }),
                    resumeArtifact
                      ? frame({ width: 132 })
                      : frame({ maxWidth: Number.POSITIVE_INFINITY }),
                  ]}
                />
              </HStack>
              <HStack spacing={10}>
                <Button
                  label={t.workspace.home.archivedChats}
                  onPress={onOpenArchivedChats}
                  modifiers={[
                    ...secondaryButtonModifiers,
                    glassEffect({
                      glass: { variant: 'clear', interactive: true },
                      shape: 'roundedRectangle',
                      cornerRadius: 18,
                    }),
                    frame({ maxWidth: Number.POSITIVE_INFINITY }),
                  ]}
                />
                <Button
                  label={t.workspace.home.settings}
                  onPress={onOpenSettings}
                  modifiers={[
                    ...secondaryButtonModifiers,
                    glassEffect({
                      glass: { variant: 'clear', interactive: true },
                      shape: 'roundedRectangle',
                      cornerRadius: 18,
                    }),
                    frame({ width: 128 }),
                  ]}
                />
              </HStack>
            </VStack>
          </GlassEffectContainer>
        </VStack>
      </Namespace>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    marginBottom: 18,
    marginHorizontal: 16,
    marginTop: 8,
  },
  fallbackActions: {
    gap: 10,
  },
  fallbackCard: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    marginBottom: 18,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 18,
  },
  fallbackSubtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  fallbackTitle: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
});
