import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import { Pressable, StyleSheet, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles, spacing } from '~/components/theme';
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
  return <View style={styles.divider} />;
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
      <View
        style={[
          styles.emptyWrap,
          contentPaddingBottom != null ? { marginBottom: contentPaddingBottom } : null,
        ]}
      >
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <AppIcon name="sparkles" size={24} tintColor={styles.emptyIconSymbol.color} />
          </View>
          <Text variant="title2" color="foreground" style={styles.emptyTitle}>
            {t.workspace.empty.title}
          </Text>
          <Text variant="body" color="text-secondary" style={styles.emptyBody}>
            {t.workspace.empty.description}
          </Text>

          <View style={styles.samplePanel}>
            <View style={styles.sampleHeader}>
              <Text variant="caption1" color="text-tertiary" style={styles.sampleLabel}>
                {t.workspace.empty.exampleWorkspace}
              </Text>
              <Text variant="caption1" color="text-tertiary">
                {t.workspace.empty.preview}
              </Text>
            </View>
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
              </Pressable>
            ))}
          </View>
        </View>
      </View>
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
    paddingTop: spacing[3],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[3],
    marginRight: spacing[3],
    backgroundColor: theme.colors['border-subtle'],
  },
  sectionShell: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
    overflow: 'hidden',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: spacing[8],
    marginHorizontal: spacing[4],
  },
  empty: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-base'],
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[5],
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
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing[3],
    padding: spacing[3],
    rowGap: spacing[2],
    width: '100%',
  },
  sampleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  sampleLabel: {
    fontWeight: '600',
  },
  sampleList: {
    rowGap: spacing[1],
  },
  sampleRow: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    columnGap: spacing[3],
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: spacing[3],
  },
  sampleIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.muted,
    borderRadius: 9,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sampleIconSymbol: {
    color: theme.colors['text-secondary'],
  },
  sampleText: {
    flex: 1,
    rowGap: 2,
  },
  starterStack: {
    marginTop: spacing[3],
    rowGap: spacing[2],
    width: '100%',
  },
  starter: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    columnGap: spacing[3],
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: spacing[3],
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
}));

const staticStyles = StyleSheet.create({
  listContent: {
    paddingTop: 0,
    paddingBottom: spacing[8],
  },
  sectionFooter: {
    height: 2,
  },
});
