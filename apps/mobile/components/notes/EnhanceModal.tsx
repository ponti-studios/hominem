import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useNoteEditor } from '~/hooks/use-note-editor';
import { useTextEnhance } from '~/services/ai/use-text-enhance';
import { useNoteQuery } from '~/services/notes/use-note-query';
import t from '~/translations';

import { useThemeColors } from '../theme';

export function EnhanceModal({
  noteId,
  visible,
  onClose,
}: {
  noteId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const themeColors = useThemeColors();
  const [instruction, setInstruction] = useState('');
  const { data: note } = useNoteQuery({ noteId });
  const { save, updateCache } = useNoteEditor(noteId);
  const { enhance, isEnhancing } = useTextEnhance();

  const handleConfirm = useCallback(async () => {
    if (!note?.content.trim()) return;
    const enhanced = await enhance(note.content, instruction.trim() || undefined);
    updateCache({ content: enhanced });
    void save(
      note.title,
      enhanced,
      note.files.map((f) => f.id),
    );
    setInstruction('');
    onClose();
  }, [note, instruction, enhance, updateCache, save, onClose]);

  const handleCancel = useCallback(() => {
    setInstruction('');
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={enhanceModalStyles.overlay} onPress={handleCancel}>
        <Pressable
          style={[enhanceModalStyles.sheet, { backgroundColor: themeColors['bg-elevated'] }]}
          onPress={() => {}}
        >
          <Text style={[enhanceModalStyles.title, { color: themeColors.foreground }]}>
            {t.notes.enhance.title}
          </Text>
          <Text style={[enhanceModalStyles.subtitle, { color: themeColors['text-secondary'] }]}>
            {t.notes.enhance.subtitle}
          </Text>

          <View style={enhanceModalStyles.chips}>
            {t.notes.enhance.suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => setInstruction(s)}
                style={({ pressed }) => [
                  enhanceModalStyles.chip,
                  {
                    backgroundColor:
                      instruction === s ? themeColors.accent : themeColors['bg-surface'],
                    borderColor: themeColors['border-default'],
                  },
                  pressed ? { opacity: 0.7 } : null,
                ]}
              >
                <Text
                  style={[
                    enhanceModalStyles.chipText,
                    { color: instruction === s ? '#fff' : themeColors['text-secondary'] },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={instruction}
            onChangeText={setInstruction}
            placeholder={t.notes.enhance.instructionPlaceholder}
            placeholderTextColor={themeColors['text-tertiary']}
            style={[
              enhanceModalStyles.input,
              {
                color: themeColors.foreground,
                backgroundColor: themeColors['bg-surface'],
                borderColor: themeColors['border-default'],
              },
            ]}
            multiline={false}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />

          <View style={enhanceModalStyles.actions}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                enhanceModalStyles.actionBtn,
                { backgroundColor: themeColors['bg-surface'] },
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <Text style={{ color: themeColors.foreground, fontSize: 15, fontWeight: '500' }}>
                {t.notes.enhance.cancel}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={isEnhancing}
              style={({ pressed }) => [
                enhanceModalStyles.actionBtn,
                enhanceModalStyles.confirmBtn,
                pressed ? { opacity: 0.8 } : null,
              ]}
            >
              {isEnhancing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                  {t.notes.enhance.confirm}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const enhanceModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sheet: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: '#000',
  },
});
