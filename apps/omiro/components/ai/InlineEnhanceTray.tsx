import { Host, Circle, RoundedRectangle } from '@expo/ui/swift-ui';
import { glassEffect } from '@expo/ui/swift-ui/modifiers';
import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text, makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

const isGlassSupported = Platform.OS === 'ios';

interface InlineEnhanceTrayProps {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isEnhancing?: boolean;
  error?: string | null;
}

export function InlineEnhanceTray({
  instruction,
  onInstructionChange,
  onCancel,
  onConfirm,
  isEnhancing = false,
  error = null,
}: InlineEnhanceTrayProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          {isGlassSupported ? (
            <Host style={StyleSheet.absoluteFill} pointerEvents="none">
              <Circle
                modifiers={[glassEffect({ glass: { variant: 'regular' }, shape: 'circle' })]}
              />
            </Host>
          ) : null}
          <AppIcon name="wand.and.sparkles" size={16} tintColor={themeColors['text-secondary']} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t.enhance.title}</Text>
          <Text style={styles.subtitle}>{t.enhance.subtitle}</Text>
        </View>
      </View>

      <View style={styles.chips}>
        {t.enhance.suggestions.map((suggestion) => {
          const isActive = instruction === suggestion;
          return (
            <Pressable
              key={suggestion}
              onPress={() => onInstructionChange(suggestion)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isActive ? themeColors['accent'] : themeColors['bg-elevated'],
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                {suggestion}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={instruction}
        onChangeText={onInstructionChange}
        placeholder={t.enhance.instructionPlaceholder}
        placeholderTextColor={themeColors['text-tertiary']}
        style={[
          styles.input,
          {
            backgroundColor: themeColors['bg-elevated'],
            color: themeColors.foreground,
          },
        ]}
        returnKeyType="done"
        onSubmitEditing={onConfirm}
        editable={!isEnhancing}
      />

      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.secondaryActionText}>{t.enhance.cancel}</Text>
        </Pressable>

        <Pressable
          onPress={onConfirm}
          disabled={isEnhancing}
          style={({ pressed }) => [
            styles.action,
            styles.primaryAction,
            { opacity: pressed || isEnhancing ? 0.8 : 1 },
          ]}
        >
          {isGlassSupported ? (
            <Host style={StyleSheet.absoluteFill} pointerEvents="none">
              <RoundedRectangle
                cornerRadius={radii.full}
                modifiers={[
                  glassEffect({
                    glass: { variant: 'regular', interactive: true, tint: themeColors.accent },
                    shape: 'roundedRectangle',
                    cornerRadius: radii.full,
                  }),
                ]}
              />
            </Host>
          ) : null}
          {isEnhancing ? (
            <ActivityIndicator size="small" color={themeColors.white} />
          ) : (
            <Text style={styles.primaryActionText}>{t.enhance.confirm}</Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    gap: spacing[3],
    paddingTop: spacing[1],
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[2],
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: isGlassSupported ? 'transparent' : theme.colors['bg-elevated'],
    borderRadius: radii.full,
    height: spacing[6],
    justifyContent: 'center',
    overflow: 'hidden',
    width: spacing[6],
  },
  headerText: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    color: theme.colors.foreground,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    color: theme.colors['text-secondary'],
    fontSize: 13,
    lineHeight: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
  },
  chipText: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  chipTextActive: {
    color: theme.colors.white,
  },
  input: {
    borderRadius: radii.md,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  action: {
    alignItems: 'center',
    borderRadius: radii.full,
    flex: 1,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  secondaryActionText: {
    color: theme.colors['text-secondary'],
    fontSize: 14,
    fontWeight: '500',
  },
  primaryAction: {
    backgroundColor: isGlassSupported ? 'transparent' : theme.colors.accent,
  },
  primaryActionText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.destructive,
    fontSize: 12,
    lineHeight: 16,
  },
}));
