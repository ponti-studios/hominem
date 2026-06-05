import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text, makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

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
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors['border-default'],
            },
          ]}
        >
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
                  backgroundColor: isActive
                    ? themeColors.background
                    : themeColors['bg-surface'],
                  borderColor: themeColors['border-default'],
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={styles.chipText}>{suggestion}</Text>
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
            backgroundColor: themeColors.background,
            borderColor: themeColors['border-default'],
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
          style={({ pressed }) => [
            styles.action,
            styles.secondaryAction,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors['border-default'],
              opacity: pressed ? 0.75 : 1,
            },
          ]}
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
          {isEnhancing ? (
            <ActivityIndicator size="small" color="#fff" />
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
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[3],
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[2],
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    height: spacing[6],
    justifyContent: 'center',
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
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
  },
  chipText: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
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
    borderRadius: radii.md,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  secondaryAction: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryActionText: {
    color: theme.colors.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  primaryAction: {
    backgroundColor: theme.colors.foreground,
  },
  primaryActionText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.destructive,
    fontSize: 12,
    lineHeight: 16,
  },
}));
