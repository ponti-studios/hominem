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
  lineLimit,
} from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Text, useThemeColors } from '~/components/theme';
import { BlurSurface } from '~/components/ui/BlurSurface';
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

  if (!IS_IOS_26_OR_NEWER) {
    return (
      <BlurSurface tint="regular" style={styles.fallbackCard}>
        <Text style={[styles.fallbackTitle, { color: themeColors.foreground }]}>
          {t.workspace.home.title}
        </Text>
        <Text style={[styles.fallbackSubtitle, { color: themeColors['text-secondary'] }]} numberOfLines={2}>
          {resumeArtifact?.title ?? t.workspace.home.subtitle}
        </Text>
        <View style={styles.fallbackPrimary}>
          {resumeArtifact ? (
            <AppButton
              label={resumeLabel}
              onPress={() => onResumeArtifact?.()}
              variant="primary"
            />
          ) : (
            <AppButton label={t.workspace.home.newChat} onPress={onStartChat} variant="primary" />
          )}
        </View>
        <View style={styles.fallbackSecondary}>
          {resumeArtifact ? (
            <AppButton label={t.workspace.home.newChat} onPress={onStartChat} variant="secondary" />
          ) : null}
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
      </BlurSurface>
    );
  }

  const primaryModifiers = [
    buttonStyle('glassProminent'),
    glassEffectId('primary-action', namespaceId),
    glassEffect({
      glass: { variant: 'regular', interactive: true },
      shape: 'roundedRectangle',
      cornerRadius: 22,
    }),
    frame({ maxWidth: Number.POSITIVE_INFINITY }),
  ];

  const secondaryModifiers = [
    buttonStyle('glass'),
    glassEffect({
      glass: { variant: 'clear', interactive: true },
      shape: 'roundedRectangle',
      cornerRadius: 18,
    }),
    frame({ maxWidth: Number.POSITIVE_INFINITY }),
  ];

  return (
    <Host style={styles.host}>
      <Namespace id={namespaceId}>
        <VStack spacing={10}>
          <SwiftUIText modifiers={[font({ size: 40, weight: 'bold' })]}>
            {t.workspace.home.title}
          </SwiftUIText>
          <SwiftUIText
            modifiers={[
              font({ size: 15, weight: 'regular' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(2),
            ]}
          >
            {resumeArtifact
              ? resumeArtifact.title || t.workspace.home.subtitle
              : t.workspace.home.subtitle}
          </SwiftUIText>
          <GlassEffectContainer spacing={10}>
            <VStack spacing={8}>
              <HStack spacing={10}>
                {resumeArtifact ? (
                  <Button
                    label={resumeLabel}
                    onPress={onResumeArtifact}
                    modifiers={[
                      ...primaryModifiers,
                      frame({ maxWidth: Number.POSITIVE_INFINITY }),
                    ]}
                  />
                ) : null}
                <Button
                  label={t.workspace.home.newChat}
                  onPress={onStartChat}
                  modifiers={[
                    buttonStyle('glassProminent'),
                    glassEffect({
                      glass: { variant: 'regular', interactive: true },
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
                  modifiers={secondaryModifiers}
                />
                <Button
                  label={t.workspace.home.settings}
                  onPress={onOpenSettings}
                  modifiers={[
                    buttonStyle('glass'),
                    glassEffect({
                      glass: { variant: 'clear', interactive: true },
                      shape: 'roundedRectangle',
                      cornerRadius: 18,
                    }),
                    frame({ width: 120 }),
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
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  fallbackCard: {
    borderRadius: 24,
    gap: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  fallbackSubtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  fallbackPrimary: {
    marginTop: 4,
  },
  fallbackSecondary: {
    gap: 8,
  },
});
