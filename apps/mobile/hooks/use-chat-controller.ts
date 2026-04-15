import type { PendingReview } from '@hominem/chat/react';
import { useChatLifecycle } from '@hominem/chat/react';
import { buildArtifactProposal } from '@hominem/chat/ui';
import { useApiClient } from '@hominem/rpc/react';
import { ENABLED_ARTIFACT_TYPES } from '@hominem/rpc/types';
import type { ArtifactType, SessionSource, ThoughtLifecycleState } from '@hominem/rpc/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Alert, Platform, Share, type TextInput } from 'react-native';

import { loadMarkdown } from '../components/chat/chat-message';
import type { ChatMessageItem, MarkdownComponent } from '@hominem/chat';


export interface ChatServices {
  useChatMessages: (args: { chatId: string }) => {
    isPending: boolean;
    data: ChatMessageItem[] | undefined;
  };
  useSendMessage: (args: { chatId: string }) => {
    sendChatMessage: (text: string) => Promise<unknown>;
    chatSendStatus: string;
  };
  useArchiveChat: (args: { chatId: string; onSuccess: () => void }) => {
    mutate: () => void;
    isPending: boolean;
  };
  chatKeys: { messages: (chatId: string) => readonly unknown[] };
  speech: { speakingId: string | null; speak: (id: string, text: string) => void };
  onNoteCreated?: () => Promise<void>;
  onArtifactCreated?: (artifact: {
    source: { kind: 'artifact'; id: string; type: Exclude<ArtifactType, 'tracker'>; title: string };
    updatedAt?: string;
  }) => Promise<void>;
}


interface MobileUiState {
  showDebug: boolean;
  showSearch: boolean;
  showActionsMenu: boolean;
  searchQuery: string;
}

type MobileUiAction =
  | { type: 'toggle-debug' }
  | { type: 'open-search' }
  | { type: 'close-search' }
  | { type: 'open-actions' }
  | { type: 'close-actions' }
  | { type: 'set-search-query'; searchQuery: string };

const initialMobileUiState: MobileUiState = {
  showDebug: false,
  showSearch: false,
  showActionsMenu: false,
  searchQuery: '',
};

function mobileUiReducer(state: MobileUiState, action: MobileUiAction): MobileUiState {
  switch (action.type) {
    case 'toggle-debug':
      return { ...state, showDebug: !state.showDebug };
    case 'open-search':
      return { ...state, showSearch: true };
    case 'close-search':
      return { ...state, showSearch: false, searchQuery: '' };
    case 'open-actions':
      return { ...state, showActionsMenu: true };
    case 'close-actions':
      return { ...state, showActionsMenu: false };
    case 'set-search-query':
      return { ...state, searchQuery: action.searchQuery };
  }
}


interface UseChatControllerInput {
  chatId: string;
  onChatArchive: () => void;
  source: SessionSource;
  services: ChatServices;
}

interface UseChatControllerResult {
  Markdown: MarkdownComponent | null;
  chatSendStatus: string;
  displayMessages: ChatMessageItem[];
  handleAcceptReview: () => Promise<void>;
  handleArchiveChat: () => void;
  handleCloseSearch: () => void;
  handleCopyMessage: (message: ChatMessageItem) => void;
  handleDeleteMessage: (messageId: string) => void;
  handleEditMessage: (messageId: string, content: string) => Promise<void>;
  handleOpenMenu: () => void;
  handleCloseMenu: () => void;
  handleToggleDebug: () => void;
  handleTransformFromMenu: (type: ArtifactType) => void;
  handleOpenSearch: () => void;
  handleRegenerate: (messageId: string) => Promise<void>;
  handleRejectReview: () => Promise<void>;
  handleSearchQueryChange: (query: string) => void;
  handleShareMessage: (message: ChatMessageItem) => Promise<void>;
  handleSpeakMessage: (message: ChatMessageItem) => void;
  enabledTransforms: Exclude<ArtifactType, 'tracker'>[];
  canTransform: boolean;
  isMessagesLoading: boolean;
  isArchiving: boolean;
  isReviewVisible: boolean;
  showActionsMenu: boolean;
  lifecycleState: ThoughtLifecycleState;
  pendingReview: PendingReview | null;
  resolvedSource: SessionSource;
  searchInputRef: RefObject<TextInput | null>;
  searchQuery: string;
  showDebug: boolean;
  showSearch: boolean;
  speakingId: string | null;
  statusCopy: string;
}

export function useChatController({
  chatId,
  onChatArchive,
  source,
  services,
}: UseChatControllerInput): UseChatControllerResult {
  const { speakingId, speak } = services.speech;
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { isPending: isMessagesLoading, data: messages } = services.useChatMessages({ chatId });
  const { mutate: archiveChat, isPending: isArchiving } = services.useArchiveChat({
    chatId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: services.chatKeys.messages(chatId) });
      onChatArchive();
    },
  });
  const { sendChatMessage, chatSendStatus } = services.useSendMessage({ chatId });
  const [Markdown, setMarkdown] = useState<MarkdownComponent | null>(null);
  const [uiState, dispatch] = useReducer(mobileUiReducer, initialMobileUiState);
  const searchInputRef = useRef<TextInput | null>(null);

  const formattedMessages = useMemo(
    () => (messages && messages.length > 0 ? messages : []),
    [messages],
  );

  const displayMessages = useMemo(() => {
    if (!uiState.searchQuery.trim()) return formattedMessages;
    const lower = uiState.searchQuery.toLowerCase();
    return formattedMessages.filter((message) => message.message?.toLowerCase().includes(lower));
  }, [formattedMessages, uiState.searchQuery]);

  const proposalMessages = useMemo(
    () => formattedMessages.map((message) => ({ role: message.role, content: message.message })),
    [formattedMessages],
  );

  const enabledTransforms = useMemo(
    () =>
      ENABLED_ARTIFACT_TYPES.filter(
        (type): type is Exclude<ArtifactType, 'tracker'> => type !== 'tracker',
      ),
    [],
  );

  const createTask = useMutation({
    mutationKey: ['chat-task', chatId],
    mutationFn: async (review: {
      proposedType: Exclude<ArtifactType, 'note' | 'tracker'>;
      proposedTitle: string;
      previewContent: string;
    }) => {
      return client.tasks.create({
        artifactType: review.proposedType,
        description: review.previewContent,
        title: review.proposedTitle,
      });
    },
    onSuccess: async (task) => {
      if (services.onArtifactCreated) {
        await services.onArtifactCreated({
          source: {
            kind: 'artifact',
            id: task.id,
            title: task.title,
            type: task.artifactType,
          },
          updatedAt: task.updatedAt,
        });
      }
    },
  });


  const createNote = useMutation({
    mutationKey: ['chat-note', chatId],
    mutationFn: async (review: { proposedTitle: string; previewContent: string }) => {
      return client.notes.create({
        content: review.previewContent,
        title: review.proposedTitle,
        type: 'note',
      });
    },
    onSuccess: async () => {
      if (services.onNoteCreated) {
        await services.onNoteCreated();
      }
    },
  });


  const {
    lifecycleState,
    pendingReview,
    resolvedSource,
    canTransform,
    statusCopy,
    isReviewVisible,
    handleTransform,
    handleAcceptReview,
    handleRejectReview,
  } = useChatLifecycle({
    messages: proposalMessages,
    source,
    onTransform: async (type: ArtifactType) =>
      buildArtifactProposal(
        proposalMessages,
        type === 'tracker' ? 'note' : (type as 'note' | 'task' | 'task_list'),
      ),
    onAcceptReview: async (review) => {
      if (review.proposedType === 'note') {
        const note = await createNote.mutateAsync(review);
        if (services.onArtifactCreated) {
          await services.onArtifactCreated({
            source: {
              kind: 'artifact',
              id: note.id,
              title: note.title || review.proposedTitle,
              type: 'note',
            },
            updatedAt: note.updatedAt,
          });
        }
        return {
          kind: 'artifact' as const,
          id: note.id,
          type: 'note' as const,
          title: note.title || review.proposedTitle,
        };
      }

      if (review.proposedType !== 'task' && review.proposedType !== 'task_list') {
        const note = await createNote.mutateAsync({
          proposedTitle: review.proposedTitle,
          previewContent: review.previewContent,
        });
        return {
          kind: 'artifact' as const,
          id: note.id,
          type: 'note' as const,
          title: note.title || review.proposedTitle,
        };
      }

      const task = await createTask.mutateAsync({
        proposedTitle: review.proposedTitle,
        previewContent: review.previewContent,
        proposedType: review.proposedType,
      });
      return {
        kind: 'artifact' as const,
        id: task.id,
        type: review.proposedType,
        title: task.title,
      };
    },
    onRejectReview: async () => {
    },
    onError: (_phase, _error) => {
      Alert.alert(
        _phase === 'accept' ? 'Could not save artifact' : 'Could not prepare review',
        'Please try again.',
      );
    },
  });


  const markdownLoadedRef = useRef(false);
  useEffect(() => {
    if (markdownLoadedRef.current) return;
    markdownLoadedRef.current = true;

    const controller = new AbortController();

    loadMarkdown()
      .then((component) => {
        if (!controller.signal.aborted) setMarkdown(() => component);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMarkdown(null);
      });

    return () => {
      controller.abort();
    };
  }, []);


  const handleArchiveChat = useCallback(() => {
    archiveChat();
  }, [archiveChat]);

  const handleCopyMessage = useCallback((copiedMessage: ChatMessageItem) => {
    const text = copiedMessage.message;
    if (!text) return;

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void Clipboard.setStringAsync(text).catch(() => {
        void Share.share({ message: text, title: 'Copy message' });
      });
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {
        void Share.share({ message: text, title: 'Copy message' });
      });
      return;
    }

    void Share.share({ message: text, title: 'Copy message' });
  }, []);

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      const messageIndex = formattedMessages.findIndex((message) => message.id === messageId);
      if (messageIndex === -1) return;

      const previousUserMessage = [...formattedMessages]
        .slice(0, messageIndex)
        .reverse()
        .find((message) => message.role === 'user' && message.message.trim().length > 0);

      if (!previousUserMessage) return;

      await sendChatMessage(previousUserMessage.message);
    },
    [formattedMessages, sendChatMessage],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      const existingMessage = formattedMessages.find((message) => message.id === messageId);
      const trimmedContent = content.trim();
      if (!trimmedContent) return;
      if (!existingMessage || existingMessage.role !== 'user') return;

      await sendChatMessage(trimmedContent);
    },
    [formattedMessages, sendChatMessage],
  );

  const handleShareMessage = useCallback(async (message: ChatMessageItem) => {
    const text = message.message;
    if (!text) return;
    const uri = `${FileSystem.cacheDirectory}message_${message.id}.txt`;
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
  }, []);

  const handleDeleteMessage = useCallback(
    (_messageId: string) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      queryClient.invalidateQueries({ queryKey: services.chatKeys.messages(chatId) });
    },
    [chatId, queryClient, services.chatKeys],
  );

  const handleSpeakMessage = useCallback(
    (message: ChatMessageItem) => {
      speak(message.id, message.message);
    },
    [speak],
  );

  const handleOpenSearch = useCallback(() => {
    dispatch({ type: 'open-search' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  const handleCloseSearch = useCallback(() => {
    dispatch({ type: 'close-search' });
  }, []);

  const handleSearchQueryChange = useCallback((searchQuery: string) => {
    dispatch({ type: 'set-search-query', searchQuery });
  }, []);

  const handleToggleDebug = useCallback(() => {
    dispatch({ type: 'toggle-debug' });
  }, []);

  const handleOpenMenu = useCallback(() => {
    dispatch({ type: 'open-actions' });
  }, []);

  const handleCloseMenu = useCallback(() => {
    dispatch({ type: 'close-actions' });
  }, []);

  const handleTransformFromMenu = useCallback(
    (type: ArtifactType) => {
      handleCloseMenu();
      void handleTransform(type);
    },
    [handleCloseMenu, handleTransform],
  );

  return {
    Markdown,
    chatSendStatus,
    displayMessages,
    enabledTransforms,
    handleAcceptReview,
    handleArchiveChat,
    handleCloseSearch,
    handleCloseMenu,
    handleCopyMessage,
    handleDeleteMessage,
    handleEditMessage,
    handleOpenMenu,
    handleOpenSearch,
    handleRegenerate,
    handleRejectReview,
    handleSearchQueryChange,
    handleShareMessage,
    handleSpeakMessage,
    handleTransformFromMenu,
    handleToggleDebug,
    canTransform,
    isMessagesLoading,
    isArchiving,
    lifecycleState,
    pendingReview,
    resolvedSource,
    searchInputRef,
    searchQuery: uiState.searchQuery,
    showDebug: uiState.showDebug,
    showActionsMenu: uiState.showActionsMenu,
    showSearch: uiState.showSearch,
    speakingId,
    statusCopy,
    isReviewVisible,
  };
}
