import { Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { TextField } from '~/components/ui';
import { Button } from '~/components/ui/button';
import { ModalOverlay } from '~/components/ui/modal-overlay';
import t from '~/translations';

export function MessageEditModal({
  visible,
  draftMessage,
  content,
  onChangeDraft,
  onCancel,
  onSave,
}: {
  visible: boolean;
  draftMessage: string;
  content: string;
  onChangeDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { foreground: textPrimary, background } = useAppTheme().colors;
  const { borderRadii } = useAppTheme();
  const styles = useStyles((theme) => ({
    modalContainer: { paddingHorizontal: 20, width: '100%' },
    modalCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadii['2xl'],
      boxShadow: theme.shadows.float,
      gap: 14,
      padding: 20,
      width: '100%',
    },
    modalActions: { flexDirection: 'row', gap: 8 },
    cancelAction: { flex: 1 },
    saveAction: { flex: 1 },
  }));

  return (
    <ModalOverlay
      visible={visible}
      onClose={onCancel}
      dismissOnBackdropPress={false}
      position="center"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalCard}>
          <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
            {t.chat.messageEdit.title}
          </Text>
          <TextField
            multiline
            value={draftMessage}
            onChangeText={onChangeDraft}
            placeholder={t.chat.messageEdit.placeholder}
            selectionColor={textPrimary}
            cursorColor={textPrimary}
            style={{
              borderRadius: borderRadii.xl,
              borderWidth: 0,
              fontSize: 16,
              minHeight: 90,
              paddingHorizontal: 16,
              paddingVertical: 12,
              textAlignVertical: 'top',
              backgroundColor: background,
              color: textPrimary,
            }}
          />
          <View style={styles.modalActions}>
            <View style={styles.cancelAction}>
              <Button label={t.chat.messageEdit.cancel} onPress={onCancel} variant="secondary" />
            </View>
            <View style={styles.saveAction}>
              <Button
                label={t.chat.messageEdit.save}
                onPress={onSave}
                disabled={!draftMessage.trim() || draftMessage === content}
                variant="primary"
              />
            </View>
          </View>
        </View>
      </View>
    </ModalOverlay>
  );
}
