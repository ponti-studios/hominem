import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { Text, theme } from '~/components/theme';

import { styles } from '../../app/(protected)/(tabs)/settings/styles';
import { PersonSaveIcon } from './PersonSaveIcon';
import { SettingsRow } from './SettingsRow';

interface NameEditorProps {
  initialName: string;
  onSave: (name: string) => Promise<void>;
}

export function NameEditor({ initialName, onSave }: NameEditorProps) {
  const [name, setName] = useState(initialName);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'success' | 'error'>('idle');

  const normalizedName = name.trim();
  const initialNormalizedName = initialName.trim();
  const nameChanged = normalizedName !== initialNormalizedName;

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const timeout = setTimeout(() => {
      setSaveStatus('idle');
      setSaveFeedback('idle');
    }, 1500);
    return () => clearTimeout(timeout);
  }, [saveStatus]);

  const handleSavePress = async () => {
    if (!nameChanged) return;
    if (!normalizedName) {
      setSaveError('Name cannot be empty.');
      setSaveStatus('idle');
      return;
    }
    setSaveError(null);
    setSaveFeedback('idle');
    setSaveStatus('saving');
    try {
      await onSave(normalizedName);
      setSaveStatus('saved');
      setSaveFeedback('success');
    } catch (error) {
      setSaveStatus('idle');
      setSaveFeedback('error');
      setSaveError(error instanceof Error ? error.message : 'Could not save name.');
    }
  };

  return (
    <>
      <SettingsRow
        leading={<PersonSaveIcon feedback={saveFeedback} />}
        label="Name"
        trailing={
          <View style={styles.inlineEditRow}>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setSaveError(null);
                setSaveFeedback('idle');
                setSaveStatus('idle');
              }}
              style={styles.inlineInput}
              placeholderTextColor={theme.colors['text-tertiary']}
              placeholder="Your name"
              returnKeyType="done"
              onSubmitEditing={nameChanged ? handleSavePress : undefined}
              accessibilityLabel="Name"
            />
            {nameChanged && (
              <Pressable
                onPress={handleSavePress}
                disabled={saveStatus === 'saving'}
                style={styles.inlineSaveButton}
                accessibilityLabel="Save name"
                accessibilityRole="button"
              >
                {saveStatus === 'saving' ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Text style={styles.inlineSaveLabel}>Save</Text>
                )}
              </Pressable>
            )}
          </View>
        }
      />
      {saveError ? (
        <View style={styles.inlineErrorBanner}>
          <Text style={styles.inlineStatusError}>{saveError}</Text>
        </View>
      ) : null}
    </>
  );
}
