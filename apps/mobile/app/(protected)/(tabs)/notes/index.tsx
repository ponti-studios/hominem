import { radiiNative, spacing } from '@hominem/ui/tokens';
import { shadowsNative } from '@hominem/ui/tokens/shadows';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Image } from 'expo-image';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { Text, theme } from '~/components/theme';
import { flattenNoteFeedPages, useNoteFeed } from '~/services/notes/use-note-stream';


type FeedRow = {
  id: string;
  title: string | null;
  contentPreview: string;
  createdAt: string;
  hasAttachments: boolean;
};


function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart.getTime() - targetStart.getTime()) / 86_400_000);

  if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  if (diffDays < 365) return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}


const RowSeparator = React.memo(() => <View style={styles.separator} />);
RowSeparator.displayName = 'RowSeparator';


const NoteRow = React.memo(({ item, onPress }: { item: FeedRow; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    accessibilityRole="button"
    accessibilityLabel={item.title ?? 'Untitled note'}
  >
    <View style={styles.rowInner}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title ?? 'Untitled note'}
        </Text>
        <Text style={styles.rowDate}>{formatNoteDate(item.createdAt)}</Text>
      </View>

      {item.contentPreview ? (
        <Text style={styles.rowPreview} numberOfLines={2}>
          {item.contentPreview}
        </Text>
      ) : null}

      {item.hasAttachments ? (
        <View style={styles.attachmentRow}>
          <Image
            source="sf:paperclip"
            style={styles.attachmentIcon}
            tintColor={theme.colors['text-tertiary']}
            contentFit="contain"
          />
          <Text style={styles.attachmentText}>Attachment</Text>
        </View>
      ) : null}
    </View>
  </Pressable>
));

NoteRow.displayName = 'NoteRow';


function EmptyNotes() {
  return (
    <Reanimated.View entering={FadeIn.duration(280)} style={styles.empty}>
      <View style={styles.emptyIconRing}>
        <Image
          source="sf:note.text"
          style={styles.emptyIcon}
          tintColor={theme.colors['text-tertiary']}
          contentFit="contain"
        />
      </View>
      <Text style={styles.emptyTitle}>No notes yet</Text>
      <Text style={styles.emptyBody}>
        Use the composer below to capture your first thought.
      </Text>
    </Reanimated.View>
  );
}


export default function NotesFeedScreen() {
  const router = useRouter();
  const listRef = useRef<any>(null);
  const previousCountRef = useRef(0);
  const previousContentHeightRef = useRef(0);
  const previousOffsetRef = useRef(0);
  const isAnchoringRef = useRef(false);
  const isFirstRef = useRef(true);
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
      isAnchoringRef.current = true;
      void feedQuery.fetchNextPage();
    }
  }, [feedQuery]);

  const handleRefresh = useCallback(() => void feedQuery.refetch(), [feedQuery]);

  const renderItem = useCallback<ListRenderItem<FeedRow>>(
    ({ item }) => (
      <Reanimated.View
        entering={
          prefersReducedMotion
            ? FadeIn.duration(120)
            : FadeInDown.duration(220).springify().damping(22).stiffness(260)
        }
        layout={LinearTransition.duration(160)}
      >
        <NoteRow
          item={item}
          onPress={() =>
            router.push(`/(protected)/(tabs)/notes/${item.id}` as RelativePathString)
          }
        />
      </Reanimated.View>
    ),
    [prefersReducedMotion, router],
  );

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    previousOffsetRef.current = contentOffset.y;
    setIsNearBottom(contentSize.height - layoutMeasurement.height - contentOffset.y <= 96);
  }, []);

  const handleContentSizeChange = useCallback(
    (_w: number, height: number) => {
      const prevCount = previousCountRef.current;
      const nextCount = notes.length;
      const initialHydrate = isFirstRef.current && nextCount > 0;
      const newNoteAppended = nextCount > prevCount && !isAnchoringRef.current;

      if (initialHydrate || (newNoteAppended && isNearBottom)) {
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
      }

      if (isAnchoringRef.current) {
        const delta = height - previousContentHeightRef.current;
        if (delta > 0) {
          requestAnimationFrame(() =>
            listRef.current?.scrollToOffset({
              animated: false,
              offset: previousOffsetRef.current + delta,
            }),
          );
        }
        isAnchoringRef.current = false;
      }

      previousContentHeightRef.current = height;
      previousCountRef.current = nextCount;
      isFirstRef.current = false;
    },
    [isNearBottom, notes.length],
  );

  const isEmpty = notes.length === 0 && !feedQuery.isLoading;

  return (
    <View style={styles.screen}>
      {isEmpty ? (
        <EmptyNotes />
      ) : (
        <View style={styles.shell}>
          <FlashList
            ref={listRef}
            data={notes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={RowSeparator}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={handleContentSizeChange}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.15}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={feedQuery.isRefetching}
                onRefresh={handleRefresh}
                tintColor={theme.colors['text-tertiary']}
              />
            }
          />
        </View>
      )}
    </View>
  );
}


const COMPOSER_CLEARANCE = spacing[7] * 3;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },

  shell: {
    flex: 1,
    backgroundColor: theme.colors['bg-surface'],
    borderRadius: radiiNative.icon,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    overflow: 'hidden',
    ...shadowsNative.low,
  },

  listContent: {
    paddingBottom: COMPOSER_CLEARANCE,
  },

  row: {
    backgroundColor: 'transparent',
  },
  rowPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  rowInner: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  rowTitle: {
    flex: 1,
    fontSize: theme.textVariants.body.fontSize,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: theme.textVariants.body.lineHeight,
    color: theme.colors.foreground,
  },
  rowDate: {
    fontSize: theme.textVariants.caption1.fontSize,
    lineHeight: theme.textVariants.caption1.lineHeight,
    color: theme.colors['text-tertiary'],
    flexShrink: 0,
  },
  rowPreview: {
    fontSize: theme.textVariants.caption1.fontSize,
    lineHeight: 18,
    color: theme.colors['text-secondary'],
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  attachmentIcon: {
    width: spacing[3],
    height: spacing[3],
  },
  attachmentText: {
    fontSize: 11,
    color: theme.colors['text-tertiary'],
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors['border-subtle'],
    marginLeft: spacing[4],
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingBottom: COMPOSER_CLEARANCE,
    gap: spacing[2],
  },
  emptyIconRing: {
    width: spacing[7] + spacing[3],
    height: spacing[7] + spacing[3],
    borderRadius: radiiNative.full,
    backgroundColor: theme.colors['bg-elevated'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  emptyIcon: {
    width: spacing[4] + spacing[2],
    height: spacing[4] + spacing[2],
  },
  emptyTitle: {
    fontSize: theme.textVariants.title2.fontSize,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: theme.textVariants.footnote.fontSize,
    lineHeight: theme.textVariants.footnote.lineHeight,
    color: theme.colors['text-tertiary'],
    textAlign: 'center',
  },
});
