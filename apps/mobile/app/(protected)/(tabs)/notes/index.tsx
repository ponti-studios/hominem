import { colors, spacing } from '@hominem/ui/tokens';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Reanimated from 'react-native-reanimated';

import {
  createNotesEnterFade,
  createNotesExitFade,
  createNotesLayoutTransition,
} from '~/components/notes/notes-surface-motion';
import { useReducedMotion } from '~/lib/use-reduced-motion';
import { Text, theme } from '~/theme';
import { flattenNoteFeedPages, useNoteFeed } from '~/utils/services/notes/use-note-stream';

type FeedRow = {
  id: string;
  title: string | null;
  contentPreview: string;
  createdAt: string;
  hasAttachments: boolean;
};

function NoteCard({ item, onPress }: { item: FeedRow; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text variant="bodyLarge" color="foreground">
          {item.title || 'Untitled note'}
        </Text>
        <Text variant="caption" color="text-secondary">
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      <Text variant="body" color="text-secondary">
        {item.contentPreview || 'No content yet.'}
      </Text>
      {item.hasAttachments ? (
        <Text variant="caption" color="text-secondary">
          Has attachments
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function NotesFeedScreen() {
  const router = useRouter();
  const listRef = useRef<any>(null);
  const previousCountRef = useRef(0);
  const previousContentHeightRef = useRef(0);
  const previousOffsetRef = useRef(0);
  const isAnchoringOlderNotesRef = useRef(false);
  const isFirstContentSizeChangeRef = useRef(true);
  const feedQuery = useNoteFeed();
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const notes = useMemo(
    () =>
      flattenNoteFeedPages(feedQuery.data).map<FeedRow>((note) => ({
        id: note.id,
        title: note.title,
        contentPreview: note.contentPreview,
        createdAt: note.createdAt,
        hasAttachments: note.metadata.hasAttachments,
      })),
    [feedQuery.data],
  );

  const handleEndReached = useCallback(() => {
    if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
      isAnchoringOlderNotesRef.current = true;
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  const handleRefresh = useCallback(() => {
    void feedQuery.refetch();
  }, [feedQuery]);

  const renderItem = useCallback<ListRenderItem<FeedRow>>(
    ({ item }) => (
      <Reanimated.View
        entering={createNotesEnterFade(prefersReducedMotion)}
        layout={createNotesLayoutTransition(prefersReducedMotion)}
      >
        <NoteCard
          item={item}
          onPress={() => router.push(`/(protected)/(tabs)/notes/${item.id}` as RelativePathString)}
        />
      </Reanimated.View>
    ),
    [prefersReducedMotion, router],
  );

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    previousOffsetRef.current = contentOffset.y;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setIsNearBottom(distanceFromBottom <= 96);
  }, []);

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const previousCount = previousCountRef.current;
      const nextCount = notes.length;
      const didInitialHydrate = isFirstContentSizeChangeRef.current && nextCount > 0;
      const didAppendNewNote = nextCount > previousCount && !isAnchoringOlderNotesRef.current;

      if (didInitialHydrate || (didAppendNewNote && isNearBottom)) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: false });
        });
      }

      if (isAnchoringOlderNotesRef.current) {
        const heightDelta = height - previousContentHeightRef.current;

        if (heightDelta > 0) {
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              animated: false,
              offset: previousOffsetRef.current + heightDelta,
            });
          });
        }

        isAnchoringOlderNotesRef.current = false;
      }

      previousContentHeightRef.current = height;
      previousCountRef.current = nextCount;
      isFirstContentSizeChangeRef.current = false;
    },
    [isNearBottom, notes.length],
  );

  return (
    <View style={styles.container}>
      <Reanimated.View
        entering={createNotesEnterFade(prefersReducedMotion)}
        exiting={createNotesExitFade(prefersReducedMotion)}
        style={styles.header}
      >
        <Text variant="title">Notes</Text>
        <Text variant="body" color="text-secondary">
          The composer stays below. Older notes live above it.
        </Text>
      </Reanimated.View>

      {notes.length === 0 && !feedQuery.isLoading ? (
        <Reanimated.View
          entering={createNotesEnterFade(prefersReducedMotion)}
          exiting={createNotesExitFade(prefersReducedMotion)}
          style={styles.empty}
        >
          <Text variant="bodyLarge" color="foreground">
            Start with a thought
          </Text>
          <Text variant="body" color="text-secondary">
            Your notes will accumulate upward from the composer.
          </Text>
        </Reanimated.View>
      ) : (
        <FlashList
          ref={listRef}
          contentContainerStyle={styles.listContent}
          data={notes}
          keyExtractor={(item) => item.id}
          onContentSizeChange={handleContentSizeChange}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.15}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={feedQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors['text-tertiary']}
            />
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const PANEL_RADIUS = 24;
const NOTES_FEED_BOTTOM_PADDING = spacing[7] + spacing[7] + spacing[7];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  header: {
    gap: spacing[1],
    paddingBottom: spacing[3],
  },
  listContent: {
    paddingBottom: NOTES_FEED_BOTTOM_PADDING,
  },
  empty: {
    marginTop: spacing[7],
    borderColor: colors['border-default'],
    borderRadius: PANEL_RADIUS,
    borderWidth: 1,
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
  },
  card: {
    backgroundColor: colors['bg-base'],
    borderColor: colors['border-subtle'],
    borderRadius: PANEL_RADIUS,
    borderWidth: 1,
    gap: spacing[3],
    marginBottom: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
  },
  cardHeader: {
    gap: spacing[2],
  },
});
