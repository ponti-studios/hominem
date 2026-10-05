// Keyed by `mode` because the composer's whole behavior forks on it: inbox
// mode saves notes/starts chats and takes its draft from the caller, chat
// mode sends messages and manages its own draft (see useComposerSubmission).
interface ComposerInboxProps {
  mode: 'inbox';
  initialMessage?: string;
  onDraftChange?: (msg: string) => void;
  onClearDraft?: () => void;
  entryMode?: 'mixed' | 'note' | 'chat';
  // In mixed mode, the kind the composer starts (and resets) on: the tab it sits
  // on decides the default, the kind toggle can still change it.
  defaultEntryKind?: 'note' | 'chat';
  // Called once a note has been handed off (it is already in the Notes list).
  onNoteSaved?: () => void;
  onComplete?: () => void;
  onStartChatAccepted?: (chatId: string) => void;
  presentation?: 'inbox' | 'new-chat';
  // Shows a "plan" action that hands the text to a natural-language planner
  // (tasks, events, schedule questions). `restore` puts the text back if the
  // request fails or is cancelled.
  onPlan?: (message: string, restore: (message: string) => void) => void;
  isPlanning?: boolean;
  testID?: string;
}

interface ComposerChatSend {
  sendChatMessage: (input: {
    message: string;
    fileIds?: string[];
    responseModality?: 'text' | 'audio';
  }) => Promise<void>;
  isChatSending: boolean;
}

interface ComposerChatProps {
  mode: 'chat';
  chatId: string;
  testID?: string;
  // Owned by ChatScreen and shared with the message list's retry action, so
  // sending and retrying a failed message share one in-flight mutation
  // instead of racing two separate streams.
  chatSend: ComposerChatSend;
}

export type ComposerProps = ComposerInboxProps | ComposerChatProps;

export type ComposerSubmitKind = 'note' | 'start-chat' | 'message';
export type ComposerEntryKind = 'chat' | 'note';
