import type { ChatMessageItem, ChatRenderIcon, MarkdownComponent } from '@hominem/chat';
import { getReferencedNoteLabel } from '@hominem/chat';
import { memo, useMemo, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import Reanimated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import {
  Text,
  fontFamiliesNative,
  fontSizes,
  makeStyles,
  radii,
  spacing,
  useThemeColors,
} from '~/components/theme';
import { AppIconButton } from '~/components/ui';
import { Button } from '~/components/ui/button';

type ToolCall = NonNullable<ChatMessageItem['toolCalls']>[number];

type ChatMessageProps = {
  message: ChatMessageItem;
  Markdown?: MarkdownComponent | null;
  showDebug?: boolean;
  onCopy?: (message: ChatMessageItem) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSpeak?: (message: ChatMessageItem) => void;
  isSpeaking?: boolean;
  onShare?: (message: ChatMessageItem) => void;
  isActive?: boolean;
  onActivate?: () => void;
  formatTimestamp: (value: string) => string;
};

const ACTIONS_ENTERING = FadeInDown.duration(240).springify().damping(20).stiffness(220).mass(0.9);
const ACTIONS_EXITING = FadeOutUp.duration(180).springify().damping(24).stiffness(260).mass(0.8);
const ACTIONS_LAYOUT = LinearTransition.duration(200);
const MESSAGE_BUBBLE_MAX_WIDTH = '84%';

function ActionIconButton({
  disabled = false,
  icon,
  isDestructive = false,
  onPress,
}: {
  disabled?: boolean;
  icon: Parameters<typeof AppIconButton>[0]['icon'];
  isDestructive?: boolean;
  onPress: () => void;
}) {
  const themeColors = useThemeColors();

  return (
    <AppIconButton
      accessibilityLabel={icon}
      disabled={disabled}
      disabledOpacity={0.35}
      icon={icon}
      iconSize={16}
      onPress={onPress}
      pressedOpacity={0.65}
      size={28}
      tintColor={isDestructive ? '#FF5A5F' : themeColors['icon-secondary']}
    />
  );
}

export async function loadMarkdown() {
  const mod = await import('react-native-markdown-display');
  return mod.default as MarkdownComponent;
}

function MessageEditModal({
  visible,
  draftMessage,
  content,
  styles,
  onChangeDraft,
  onCancel,
  onSave,
}: {
  visible: boolean;
  draftMessage: string;
  content: string;
  styles: ReturnType<typeof useChatMessageStyles>;
  onChangeDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const themeColors = useThemeColors();

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.editBackdrop}>
        <View style={styles.editSheet}>
          <Text style={styles.editTitle}>Edit message</Text>
          <TextInput
            multiline
            value={draftMessage}
            onChangeText={onChangeDraft}
            placeholder="Update your message"
            placeholderTextColor={themeColors['text-tertiary']}
            selectionColor={themeColors.foreground}
            cursorColor={themeColors.foreground}
            style={[
              styles.editInput,
              {
                backgroundColor: themeColors['bg-surface'],
                borderColor: themeColors['border-default'],
                color: themeColors.foreground,
              },
            ]}
          />
          <View style={styles.editActionsRow}>
            <View style={styles.editActionSlot}>
              <Button label="Cancel" onPress={onCancel} variant="secondary" />
            </View>
            <View style={styles.editActionSlot}>
              <Button
                label="Save"
                onPress={onSave}
                disabled={!draftMessage.trim() || draftMessage === content}
                variant="primary"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MessageToolCalls({
  toolCalls,
  styles,
}: {
  toolCalls: ToolCall[];
  styles: ReturnType<typeof useChatMessageStyles>;
}) {
  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <View style={styles.toolCalls}>
      {toolCalls.map((toolCall: ToolCall, index: number) => (
        <View key={toolCall.toolCallId || `tool-call-${index}`} style={styles.toolCall}>
          <Text style={styles.toolCallName}>{toolCall.toolName}</Text>
          <Text style={styles.toolCallArgs}>
            {toolCall.args ? JSON.stringify(toolCall.args, null, 2) : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ReferencedNotes({
  message,
  styles,
}: {
  message: ChatMessageItem;
  styles: ReturnType<typeof useChatMessageStyles>;
}) {
  if (!Array.isArray(message.referencedNotes) || message.referencedNotes.length === 0) {
    return null;
  }

  return (
    <View style={styles.referencedNotes}>
      {message.referencedNotes.map((note) => (
        <View key={note.id} style={styles.referencedNoteChip}>
          <Text style={styles.referencedNoteText}>{getReferencedNoteLabel(note)}</Text>
        </View>
      ))}
    </View>
  );
}

function MessageContent({
  content,
  isUser,
  Markdown,
  markdownStyle,
  textStyle,
  styles,
  children,
}: {
  content: string;
  isUser: boolean;
  Markdown?: MarkdownComponent | null;
  markdownStyle: object;
  textStyle: object;
  styles: ReturnType<typeof useChatMessageStyles>;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.transcriptBlock}>
      <View style={[styles.messageSurface, isUser ? styles.userSurface : styles.assistantSurface]}>
        {Markdown ? (
          <Markdown style={markdownStyle}>{content}</Markdown>
        ) : (
          <Text style={textStyle}>{content}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function MessageDebug({
  message,
  hasReasoning,
  styles,
}: {
  message: ChatMessageItem;
  hasReasoning: boolean;
  styles: ReturnType<typeof useChatMessageStyles>;
}) {
  return (
    <View style={styles.transcriptSurface}>
      <Text style={styles.reasoningText}>ID: {message.id}</Text>
      <Text style={styles.reasoningText}>Role: {message.role}</Text>
      <Text style={styles.reasoningText}>Created: {message.created_at || 'unknown'}</Text>
      <Text style={styles.reasoningText}>Reasoning: {hasReasoning ? 'present' : 'none'}</Text>
      <Text style={styles.reasoningText}>Tool calls: {message.toolCalls?.length ?? 0}</Text>
    </View>
  );
}

function FocusItems({
  message,
  styles,
}: {
  message: ChatMessageItem;
  styles: ReturnType<typeof useChatMessageStyles>;
}) {
  if (!message.focus_items?.length) {
    return null;
  }

  return (
    <View style={styles.focusItems}>
      {message.focus_items.map((focusItem) => (
        <View key={focusItem.id} style={styles.focusItem}>
          <Text>{focusItem.text}</Text>
        </View>
      ))}
    </View>
  );
}

function ActiveMessageActions({
  isActive,
  timestamp,
  message,
  isSpeaking,
  canCopy,
  canSpeak,
  canShare,
  canEdit,
  canRegenerate,
  canDelete,
  styles,
  onCopy,
  onSpeak,
  onShare,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  isActive: boolean;
  timestamp: string;
  message: ChatMessageItem;
  isSpeaking: boolean;
  canCopy: boolean;
  canSpeak: boolean;
  canShare: boolean;
  canEdit: boolean;
  canRegenerate: boolean;
  canDelete: boolean;
  styles: ReturnType<typeof useChatMessageStyles>;
  onCopy?: (message: ChatMessageItem) => void;
  onSpeak?: (message: ChatMessageItem) => void;
  onShare?: (message: ChatMessageItem) => void;
  onEdit: () => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}) {
  if (!isActive) {
    return null;
  }

  return (
    <Reanimated.View
      entering={ACTIONS_ENTERING}
      exiting={ACTIONS_EXITING}
      layout={ACTIONS_LAYOUT}
      style={styles.actionsWrap}
    >
      <View style={styles.actionsRow}>
        {timestamp ? <Text style={styles.actionTimestamp}>{timestamp}</Text> : null}
        <ActionIconButton disabled={!canCopy} icon="doc.on.doc" onPress={() => onCopy?.(message)} />
        {canSpeak ? (
          <ActionIconButton
            icon={isSpeaking ? 'stop.fill' : 'speaker.wave.2'}
            onPress={() => onSpeak?.(message)}
          />
        ) : null}
        {canShare ? (
          <ActionIconButton icon="square.and.arrow.up" onPress={() => onShare?.(message)} />
        ) : null}
        {canEdit ? <ActionIconButton icon="square.and.pencil" onPress={onEdit} /> : null}
        {canRegenerate ? (
          <ActionIconButton icon="arrow.clockwise" onPress={() => onRegenerate?.(message.id)} />
        ) : null}
        {canDelete ? (
          <ActionIconButton icon="trash" isDestructive onPress={() => onDelete?.(message.id)} />
        ) : null}
      </View>
    </Reanimated.View>
  );
}

const ChatMessage = memo(function ChatMessage({
  message,
  Markdown,
  showDebug = false,
  onCopy,
  onEdit,
  onRegenerate,
  onDelete,
  onSpeak,
  isSpeaking = false,
  onShare,
  isActive = false,
  onActivate,
  formatTimestamp,
}: ChatMessageProps) {
  const styles = useChatMessageStyles();
  const { role, message: content } = message;
  const isUser = role.toLowerCase() === 'user';
  const textStyle = isUser ? styles.userMessageText : styles.assistantMessageText;
  const timestamp = message.created_at ? formatTimestamp(message.created_at) : '';
  const canRegenerate = !isUser && onRegenerate !== undefined;
  const canEdit = isUser && onEdit !== undefined;
  const canDelete = onDelete !== undefined;
  const canCopy = onCopy !== undefined;
  const canSpeak = !isUser && onSpeak !== undefined && Boolean(content?.trim());
  const canShare = !isUser && onShare !== undefined && Boolean(content?.trim());
  const hasReasoning = Boolean(message.reasoning && message.reasoning.trim().length > 0);
  const renderedToolCalls = message.toolCalls ?? [];
  const [isEditing, setIsEditing] = useState(false);
  const [draftMessage, setDraftMessage] = useState(content);
  const markdownStyle = useMemo(
    () => ({
      body: isUser ? styles.userMessageText : styles.assistantMessageText,
    }),
    [isUser, styles],
  );

  const closeEdit = () => {
    setDraftMessage(content);
    setIsEditing(false);
  };

  const saveEdit = () => {
    const trimmedContent = draftMessage.trim();
    if (!trimmedContent) return;
    onEdit?.(message.id, trimmedContent);
    setIsEditing(false);
  };

  return (
    <Pressable
      onPress={onActivate}
      style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}
    >
      <MessageEditModal
        content={content}
        draftMessage={draftMessage}
        onCancel={closeEdit}
        onChangeDraft={setDraftMessage}
        onSave={saveEdit}
        styles={styles}
        visible={isEditing}
      />

      <View style={[styles.contentColumn, isUser ? styles.contentColumnUser : null]}>
        {!isUser && hasReasoning ? (
          <View style={styles.transcriptSurface}>
            <Text style={styles.reasoningText}>{message.reasoning}</Text>
          </View>
        ) : null}

        <MessageToolCalls styles={styles} toolCalls={renderedToolCalls} />

        <MessageContent
          Markdown={Markdown}
          content={content}
          isUser={isUser}
          markdownStyle={markdownStyle}
          styles={styles}
          textStyle={textStyle}
        >
          {isUser ? <ReferencedNotes message={message} styles={styles} /> : null}
        </MessageContent>

        {showDebug ? (
          <MessageDebug hasReasoning={hasReasoning} message={message} styles={styles} />
        ) : null}

        <FocusItems message={message} styles={styles} />

        <ActiveMessageActions
          canCopy={canCopy}
          canDelete={canDelete}
          canEdit={canEdit}
          canRegenerate={canRegenerate}
          canShare={canShare}
          canSpeak={canSpeak}
          isActive={isActive}
          isSpeaking={isSpeaking}
          message={message}
          onCopy={onCopy}
          onDelete={onDelete}
          onEdit={() => {
            setDraftMessage(content);
            setIsEditing(true);
          }}
          onRegenerate={onRegenerate}
          onShare={onShare}
          onSpeak={onSpeak}
          styles={styles}
          timestamp={timestamp}
        />
      </View>
    </Pressable>
  );
});

export function renderChatMessage(
  item: ChatMessageItem,
  Markdown: MarkdownComponent | null | undefined,
  _renderIcon: ChatRenderIcon,
  formatTimestamp: (value: string) => string,
  actions?: {
    showDebug?: boolean;
    onCopy?: (message: ChatMessageItem) => void;
    onEdit?: (messageId: string, content: string) => void;
    onRegenerate?: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    onSpeak?: (message: ChatMessageItem) => void;
    speakingId?: string | null;
    onShare?: (message: ChatMessageItem) => void;
    isActive?: boolean;
    onActivate?: () => void;
  },
) {
  const { speakingId, ...rest } = actions ?? {};
  return (
    <ChatMessage
      Markdown={Markdown ?? null}
      formatTimestamp={formatTimestamp}
      isSpeaking={speakingId === item.id}
      message={item}
      {...rest}
    />
  );
}

export { ChatMessage };

const useChatMessageStyles = makeStyles((theme) => ({
  actionTimestamp: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionsWrap: {
    marginTop: spacing[1],
  },
  assistantMessageText: {
    color: theme.colors.foreground,
    fontSize: fontSizes.md,
    lineHeight: fontSizes.md * 1.55,
  },
  contentColumn: {
    gap: spacing[2],
    width: '100%',
  },
  contentColumnUser: {
    alignItems: 'flex-end',
  },
  editBackdrop: {
    alignItems: 'center',
    backgroundColor: theme.colors['overlay-modal-medium'],
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: spacing[5],
    position: 'absolute',
    right: 0,
    top: 0,
  },
  editActionSlot: {
    flex: 1,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  editInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 90,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    textAlignVertical: 'top',
  },
  editSheet: {
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-subtle'],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    width: '100%',
  },
  editTitle: {
    color: theme.colors.foreground,
    fontSize: 16,
  },
  focusItem: {
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  focusItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  reasoningText: {
    color: theme.colors.foreground,
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.xs,
    opacity: 0.8,
  },
  referencedNoteChip: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  referencedNoteText: {
    color: theme.colors['text-secondary'],
    fontSize: fontSizes.xs,
  },
  referencedNotes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'flex-end',
    maxWidth: MESSAGE_BUBBLE_MAX_WIDTH,
  },
  row: {
    paddingVertical: spacing[2],
    width: '100%',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  toolCall: {
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-subtle'],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1],
    padding: spacing[3],
  },
  toolCallArgs: {
    color: theme.colors['text-secondary'],
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.xs,
  },
  toolCallName: {
    color: theme.colors.foreground,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  toolCalls: {
    gap: spacing[1],
  },
  messageSurface: {
    borderColor: theme.colors['border-subtle'],
    borderRadius: radii.md,
    borderWidth: 1,
    maxWidth: MESSAGE_BUBBLE_MAX_WIDTH,
    paddingHorizontal: spacing[2],
    paddingVertical: 0,
  },
  transcriptBlock: {
    gap: spacing[3],
    maxWidth: MESSAGE_BUBBLE_MAX_WIDTH,
  },
  transcriptSurface: {
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    width: '100%',
  },
  userMessageText: {
    color: theme.colors['accent-foreground'],
    fontSize: fontSizes.md,
    lineHeight: fontSizes.md * 1.5,
  },
  assistantSurface: {
    backgroundColor: theme.colors['bg-base'],
    borderBottomLeftRadius: 0,
  },
  userSurface: {
    backgroundColor: theme.colors['emphasis-highest'],
    borderBottomRightRadius: 0,
  },
}));
