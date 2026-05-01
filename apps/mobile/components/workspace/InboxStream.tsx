import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamProps {
  items: InboxStreamItemModel[];
  listRef?: RefObject<FlashListRef<InboxStreamItemModel> | null>;
  onSelectStarter?: (prompt: string) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentPaddingBottom?: number;
}

const keyExtractor = (item: InboxStreamItemModel) => `${item.kind}:${item.id}`;

const InboxStreamDivider = memo(() => {
  const styles = useStreamStyles();
  return <View style={styles.divider} pointerEvents="none" />;
});

InboxStreamDivider.displayName = 'InboxStreamDivider';

const RenderInboxStreamItem = memo(({ item }: { item: InboxStreamItemModel }) => {
  return <InboxStreamItem item={item} />;
});

RenderInboxStreamItem.displayName = 'RenderInboxStreamItem';

const STARTERS = [
  {
    icon: 'note.text',
    title: t.workspace.empty.starters.captureNote.title,
    prompt: t.workspace.empty.starters.captureNote.prompt,
  },
  {
    icon: 'bubble.left',
    title: t.workspace.empty.starters.askAboutNotes.title,
    prompt: t.workspace.empty.starters.askAboutNotes.prompt,
  },
  {
    icon: 'paperclip',
    title: t.workspace.empty.starters.dropAFile.title,
    prompt: t.workspace.empty.starters.dropAFile.prompt,
  },
] as const;

const SAMPLE_ITEMS = [
  {
    icon: 'note.text',
    title: t.workspace.empty.samples.ideasFromToday.title,
    meta: t.workspace.empty.samples.ideasFromToday.meta,
  },
  {
    icon: 'bubble.left',
    title: t.workspace.empty.samples.lastWeekDecision.title,
    meta: t.workspace.empty.samples.lastWeekDecision.meta,
  },
  {
    icon: 'doc.text',
    title: t.workspace.empty.samples.projectBrief.title,
    meta: t.workspace.empty.samples.projectBrief.meta,
  },
] as const;

export const InboxStream = ({
  items,
  listRef,
  onSelectStarter,
  refreshControl,
  contentPaddingBottom,
}: InboxStreamProps) => {
  const styles = useStreamStyles();

  const renderItem = useCallback<ListRenderItem<InboxStreamItemModel>>(({ item }) => {
    return <RenderInboxStreamItem item={item} />;
  }, []);

  if (items.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.emptyWrap,
          contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <AppIcon name="sparkles" size={26} tintColor={styles.emptyIconSymbol.color} />
          </View>
          <Text variant="title2" color="foreground" style={styles.emptyTitle}>
            {t.workspace.empty.title}
          </Text>
          <Text variant="body" color="text-secondary" style={styles.emptyBody}>
            {t.workspace.empty.description}
          </Text>

          <View style={styles.samplePanel}>
            <Text variant="caption1" color="text-tertiary" style={styles.sampleLabel}>
              {t.workspace.empty.exampleWorkspace}
            </Text>
            <View style={styles.sampleList}>
              {SAMPLE_ITEMS.map((item) => (
                <View key={item.title} style={styles.sampleRow}>
                  <View style={styles.sampleIcon}>
                    <AppIcon name={item.icon} size={15} tintColor={styles.sampleIconSymbol.color} />
                  </View>
                  <View style={styles.sampleText}>
                    <Text variant="subhead" color="foreground" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text variant="caption1" color="text-tertiary" numberOfLines={1}>
                      {item.meta}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.starterStack}>
            {STARTERS.map((starter) => (
              <Pressable
                key={starter.title}
                accessibilityRole="button"
                accessibilityLabel={starter.title}
                onPress={() => onSelectStarter?.(starter.prompt)}
                style={({ pressed }) => [styles.starter, pressed ? styles.starterPressed : null]}
              >
                <View style={styles.starterIcon}>
                  <AppIcon
                    name={starter.icon}
                    size={16}
                    tintColor={styles.starterIconSymbol.color}
                  />
                </View>
                <View style={styles.starterText}>
                  <Text variant="subhead" color="foreground" numberOfLines={1}>
                    {starter.title}
                  </Text>
                  <Text variant="caption1" color="text-tertiary" numberOfLines={1}>
                    {starter.prompt}
                  </Text>
                </View>
                <AppIcon name="chevron.right" size={13} tintColor={styles.starterChevron.color} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionShell}>
        <FlashList
          ref={listRef}
          contentContainerStyle={[
            staticStyles.listContent,
            contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
          ]}
          data={items}
          ItemSeparatorComponent={InboxStreamDivider}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={<View style={staticStyles.sectionFooter} />}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const useStreamStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
  },
  divider: {
    height: theme.spacing.sm,
  },
  sectionShell: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
    overflow: 'hidden',
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    marginHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyIconSymbol: {
    color: theme.colors.foreground,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 360,
    textAlign: 'center',
  },
  samplePanel: {
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    rowGap: theme.spacing.sm,
    width: '100%',
  },
  sampleLabel: {
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
  },
  sampleList: {
    rowGap: theme.spacing.sm,
  },
  sampleRow: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    columnGap: theme.spacing.md,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
  },
  sampleIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-elevated'],
    borderRadius: 9,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sampleIconSymbol: {
    color: theme.colors['icon-primary'],
  },
  sampleText: {
    flex: 1,
    rowGap: 2,
  },
  starterStack: {
    marginTop: theme.spacing.md,
    rowGap: theme.spacing.sm,
    width: '100%',
  },
  starter: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    columnGap: theme.spacing.md,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: theme.spacing.md,
  },
  starterPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  starterIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  starterIconSymbol: {
    color: theme.colors['text-secondary'],
  },
  starterText: {
    flex: 1,
    rowGap: 2,
  },
  starterChevron: {
    color: theme.colors['text-tertiary'],
  },
}));

const staticStyles = StyleSheet.create({
  listContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionFooter: {
    height: 16,
  },
});
