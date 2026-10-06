import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Pressable, Text, View } from 'react-native';

import { PRESET_INSTRUCTIONS } from '~/components/chat/build-note-draft';
import { NoteDraftPreview } from '~/components/notes/NoteDraftPreview';
import { useStyles } from '~/components/theme';
import { TextField } from '~/components/ui';
import { Button } from '~/components/ui/button';
import { updateChatTitleCaches } from '~/services/chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useCreateNote } from '~/services/notes/use-create-note';
import { useGenerateNote } from '~/services/notes/use-generate-note';
import t from '~/translations';

type NotePreset = (typeof t.chat.noteDraft.presets)[number];

type NoteDraftPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'preview'; text: string }
  | { kind: 'error'; message: string };

export default function ChatToNoteSheetScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    transcript: string;
    title: string;
    isTruncated: string;
    chatId: string;
  }>();

  const transcript = params.transcript ?? '';
  const title = params.title ?? '';
  const chatId = params.chatId ?? '';

  const { generate, isGenerating } = useGenerateNote();
  const createNote = useCreateNote();
  const [phase, setPhase] = useState<NoteDraftPhase>({ kind: 'idle' });
  const [selectedPreset, setSelectedPreset] = useState<NotePreset>(t.chat.noteDraft.presets[0]);
  const [instruction, setInstruction] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const customInputRef = useRef<TextInput>(null);
  const styles = useStyles((theme) => ({
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 8 },
    header: { alignItems: 'center', gap: 6, paddingBottom: 8 },
    title: {
      ...theme.textVariants.headline,
      fontSize: 20,
      color: theme.colors.foreground,
      fontWeight: '800',
    },
    subtitle: {
      ...theme.textVariants.subhead,
      color: theme.colors.mutedForeground,
      textAlign: 'center',
    },
    label: {
      ...theme.textVariants.caption1,
      color: theme.colors.mutedForeground,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginTop: 12,
    },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: 24,
      flex: 1,
      height: 48,
      justifyContent: 'center',
    },
    typeChipSelected: { backgroundColor: theme.colors.primary },
    typeChipLabel: { color: theme.colors.foreground, fontSize: 15, fontWeight: '800' },
    typeChipLabelSelected: { color: theme.colors.primaryForeground },
    customInput: {
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: 28,
      color: theme.colors.foreground,
      fontSize: 16,
      lineHeight: 22,
      minHeight: 56,
      paddingHorizontal: 20,
      paddingVertical: 16,
      textAlignVertical: 'top',
    },
    error: { ...theme.textVariants.footnote, color: theme.colors.destructive },
    footer: { flexDirection: 'row', gap: 10, marginTop: 10 },
    footerButton: { flex: 1 },
  }));

  const isLoading = phase.kind === 'loading';

  const runGeneration = useCallback(
    async (preset: NotePreset, customText: string) => {
      // Prevent multiple simultaneous generations
      if (isGenerating) {
        return;
      }

      setSaveError(null);
      setPhase({ kind: 'loading' });
      const trimmedCustom = customText.trim();
      const combinedInstruction = trimmedCustom
        ? `${PRESET_INSTRUCTIONS[preset]}\n\nAdditional user instructions:\n${trimmedCustom}`
        : PRESET_INSTRUCTIONS[preset];
      try {
        const text = await generate({
          transcript,
          instruction: combinedInstruction,
        });
        setPhase({ kind: 'preview', text });
      } catch (error) {
        setPhase({
          kind: 'error',
          message: error instanceof Error ? error.message : t.chat.noteDraft.generateError,
        });
      }
    },
    [generate, isGenerating, transcript],
  );

  const handleSubmit = () => {
    if (isLoading) {
      return;
    }
    void runGeneration(selectedPreset, instruction);
  };

  const handleDiscardPreview = () => {
    setSaveError(null);
    setPhase({ kind: 'idle' });
  };

  const handleAccept = async () => {
    if (phase.kind !== 'preview') {
      return;
    }

    setSaveError(null);
    try {
      const note = await createNote.mutateAsync({ text: phase.text, title });

      updateChatTitleCaches(queryClient, {
        chatId,
        title: note.title ?? title,
        updatedAt: note.updatedAt,
      });
      await invalidateInboxQueries(queryClient);
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.chat.noteDraft.saveError);
    }
  };

  const showForm = phase.kind === 'idle' || phase.kind === 'error';
  const showPreview = phase.kind === 'loading' || phase.kind === 'preview';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.chat.noteDraft.title}</Text>
        <Text style={styles.subtitle}>{t.chat.noteDraft.subtitle}</Text>
      </View>

      {showForm ? (
        <>
          <Text style={styles.label}>{t.chat.noteDraft.typeLabel.toUpperCase()}</Text>
          <View style={styles.typeRow}>
            {t.chat.noteDraft.presets.map((preset) => (
              <Pressable
                accessibilityLabel={`${t.chat.noteDraft.typeLabel}, ${preset}`}
                accessibilityRole="button"
                accessibilityState={{ selected: preset === selectedPreset }}
                key={preset}
                onPress={() => {
                  if (!isLoading) {
                    setSelectedPreset(preset);
                  }
                }}
                style={[styles.typeChip, preset === selectedPreset && styles.typeChipSelected]}
              >
                <Text
                  style={[
                    styles.typeChipLabel,
                    preset === selectedPreset && styles.typeChipLabelSelected,
                  ]}
                >
                  {preset}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{t.chat.noteDraft.instructionsLabel.toUpperCase()}</Text>
          <TextField
            ref={customInputRef}
            multiline
            value={instruction}
            onChangeText={setInstruction}
            placeholder={t.chat.noteDraft.instructionPlaceholder}
            style={styles.customInput}
            accessibilityLabel={t.chat.noteDraft.instructionsA11y}
          />

          {phase.kind === 'error' ? <Text style={styles.error}>{phase.message}</Text> : null}

          <View style={styles.footer}>
            <Button
              label={t.chat.noteDraft.cancel}
              onPress={() => router.back()}
              size="lg"
              style={styles.footerButton}
              variant="secondary"
            />
            <Button
              label={t.chat.noteDraft.submit}
              onPress={handleSubmit}
              size="lg"
              style={styles.footerButton}
            />
          </View>
        </>
      ) : null}

      {showPreview ? (
        <>
          <NoteDraftPreview
            text={phase.kind === 'preview' ? phase.text : ''}
            isLoading={isLoading}
            testID="note-draft-preview"
          />

          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

          {phase.kind === 'preview' ? (
            <View style={styles.footer}>
              <Button
                label={t.chat.noteDraft.discard}
                onPress={handleDiscardPreview}
                size="lg"
                style={styles.footerButton}
                variant="secondary"
              />
              <Button
                disabled={createNote.isPending}
                label={t.chat.noteDraft.accept}
                loading={createNote.isPending}
                onPress={() => {
                  void handleAccept();
                }}
                size="lg"
                style={styles.footerButton}
                testID="note-draft-accept"
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
