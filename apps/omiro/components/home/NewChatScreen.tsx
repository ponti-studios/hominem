import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Composer } from '~/components/composer/Composer';
import { ComposerDock, useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { useStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui';
import {
  clearNewChatDraft,
  readNewChatDraft,
  writeNewChatDraft,
} from '~/services/navigation/launch-state';
import { getContentRoute } from '~/services/navigation/routes';
import t from '~/translations';

export function NewChatScreen() {
  const router = useRouter();
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const { restingInset } = useComposerDockMetrics();
  const initialMessage = seed?.trim() || readNewChatDraft();
  const styles = useStyles((theme) => ({
    container: { backgroundColor: theme.colors.background, flex: 1 },
    content: { flex: 1 },
  }));

  return (
    <View style={styles.container} testID="new-chat-screen">
      <View style={styles.content}>
        <EmptyState
          description={t.chat.emptyState.description}
          sfSymbol="bubble.left"
          title={t.chat.emptyState.title}
        />
      </View>
      <ComposerDock restingInset={restingInset} testID="new-chat-composer-dock">
        <Composer
          entryMode="chat"
          initialMessage={initialMessage}
          mode="inbox"
          onClearDraft={clearNewChatDraft}
          onDraftChange={writeNewChatDraft}
          onStartChatAccepted={(chatId) => router.replace(getContentRoute('chat', chatId))}
          presentation="new-chat"
        />
      </ComposerDock>
    </View>
  );
}
