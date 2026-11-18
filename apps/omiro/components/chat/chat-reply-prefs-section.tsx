import { REPLY_MODELS } from '@hominem/ai/reply-models';
import { REPLY_LENGTHS, REPLY_STYLES } from '@hominem/ai/reply-profile';
import { ChoicePickerView, FormGroup } from '@hominem/rn-kit';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ChatSheetCloseButton } from '~/components/chat/chat-sheet-close-button';
import { SettingsRow } from '~/components/settings/SettingsRow';
import { useAppTheme } from '~/components/theme';
import {
  CHAT_REPLY_STYLES,
  setChatReplyModel,
  setChatReplyStyle,
  useChatReplyModel,
  useChatReplyStyle,
} from '~/hooks/use-chat-reply-prefs';
import {
  CHAT_RESPONSE_LENGTHS,
  setChatResponseLength,
  useChatResponseLength,
} from '~/hooks/use-chat-response-length';
import t from '~/translations';

export type ChatReplyPickerKind = 'length' | 'style' | 'model';

function useChatReplyColors() {
  const { card, mutedForeground, primary, border, background, foreground } = useAppTheme().colors;
  return { background, foreground, mutedForeground, primary, card, border };
}

/** The three rows. Tapping one asks the settings sheet to show its picker in place. */
export function ChatReplyPrefsSection({ onOpen }: { onOpen: (kind: ChatReplyPickerKind) => void }) {
  const { card, mutedForeground, border } = useAppTheme().colors;
  const responseLength = useChatResponseLength();
  const replyStyle = useChatReplyStyle();
  const replyModel = useChatReplyModel();

  // Keyed by the value, so a new choice fades in as the row's value changes.
  const valueText = (name: string) => (
    <Animated.Text
      key={name}
      entering={FadeIn.duration(180)}
      style={{ color: mutedForeground, fontSize: 15 }}
    >
      {name}
    </Animated.Text>
  );

  return (
    <FormGroup colors={{ card, border }} style={{ paddingVertical: 4 }}>
      <SettingsRow
        icon="text.alignleft"
        label={t.chat.settings.responseLengthLabel}
        accessory={valueText(REPLY_LENGTHS[responseLength].name)}
        onPress={() => onOpen('length')}
        testID="chat-response-length-row"
      />
      <SettingsRow
        icon="person.crop.circle"
        label={t.chat.settings.replyStyleLabel}
        accessory={valueText(REPLY_STYLES[replyStyle].name)}
        onPress={() => onOpen('style')}
        testID="chat-reply-style-row"
      />
      <SettingsRow
        icon="cpu"
        label={t.chat.settings.replyModelLabel}
        accessory={valueText(
          REPLY_MODELS.find((model) => model.id === replyModel)?.name ?? replyModel,
        )}
        onPress={() => onOpen('model')}
        testID="chat-reply-model-row"
      />
    </FormGroup>
  );
}

/**
 * One of the three pickers, drawn inside the settings sheet. The options and wording come from
 * @hominem/ai and the picker layout from @hominem/rn-kit, the same as Thames; this file only wires
 * them to omiro's theme and storage.
 */
export function ChatReplyPicker({
  kind,
  onClose,
}: {
  kind: ChatReplyPickerKind;
  onClose: () => void;
}) {
  const colors = useChatReplyColors();
  const responseLength = useChatResponseLength();
  const replyStyle = useChatReplyStyle();
  const replyModel = useChatReplyModel();
  const renderClose = ({ onPress, label }: { onPress: () => void; label: string }) => (
    <ChatSheetCloseButton onPress={onPress} label={label} />
  );
  const closeLabel = t.chat.settings.close;

  if (kind === 'length') {
    return (
      <ChoicePickerView
        title={t.chat.settings.responseLengthLabel}
        closeLabel={closeLabel}
        choices={CHAT_RESPONSE_LENGTHS.map((id) => ({
          id,
          name: REPLY_LENGTHS[id].name,
          note: REPLY_LENGTHS[id].note,
        }))}
        selected={responseLength}
        onSelect={setChatResponseLength}
        onClose={onClose}
        footer={t.chat.settings.responseLengthDescription}
        colors={colors}
        renderClose={renderClose}
        testIDPrefix="chat-response-length"
      />
    );
  }

  if (kind === 'style') {
    return (
      <ChoicePickerView
        title={t.chat.settings.replyStyleLabel}
        closeLabel={closeLabel}
        choices={CHAT_REPLY_STYLES.map((id) => ({
          id,
          name: REPLY_STYLES[id].name,
          note: REPLY_STYLES[id].note,
        }))}
        selected={replyStyle}
        onSelect={setChatReplyStyle}
        onClose={onClose}
        footer={t.chat.settings.replyStyleDescription}
        colors={colors}
        renderClose={renderClose}
        testIDPrefix="chat-reply-style"
      />
    );
  }

  return (
    <ChoicePickerView
      title={t.chat.settings.replyModelLabel}
      closeLabel={closeLabel}
      choices={REPLY_MODELS.map((model) => ({
        id: model.id,
        name: model.name,
        note: model.note,
      }))}
      selected={replyModel}
      onSelect={setChatReplyModel}
      onClose={onClose}
      footer={t.chat.settings.replyModelDescription}
      colors={colors}
      renderClose={renderClose}
      testIDPrefix="chat-reply-model"
    />
  );
}
