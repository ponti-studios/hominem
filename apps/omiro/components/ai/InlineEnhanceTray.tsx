import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text, makeStyles, useThemeColors } from '~/components/theme';
import { radii, spacing } from '~/components/theme/ponti-tokens';
import { Button } from '~/components/ui/button';
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
        <View style={styles.iconWrap}>
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
                  backgroundColor: isActive ? themeColors['accent'] : themeColors['surface-raised'],
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
            backgroundColor: themeColors['surface-raised'],
            color: themeColors['text-primary'],
          },
        ]}
        returnKeyType="done"
        onSubmitEditing={onConfirm}
        editable={!isEnhancing}
      />

      <View style={styles.actions}>
        <View style={styles.actionSlot}>
          <Button label={t.enhance.cancel} onPress={onCancel} variant="ghost" size="sm" />
        </View>
        <View style={styles.actionSlot}>
          <Button
            label={t.enhance.confirm}
            onPress={onConfirm}
            variant="primary"
            size="sm"
            loading={isEnhancing}
          />
        </View>
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
    backgroundColor: theme.colors['surface-panel'],
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
    color: theme.colors['text-primary'],
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
    color: theme.colors['text-on-accent'],
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
  actionSlot: {
    flex: 1,
  },
  errorText: {
    color: theme.colors.destructive,
    fontSize: 12,
    lineHeight: 16,
  },
}));
