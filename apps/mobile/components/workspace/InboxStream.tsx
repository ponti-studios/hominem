import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import { Pressable, StyleSheet, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import { spacing } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamProps {
  items: InboxStreamItemModel[];
  listRef?: RefObject<FlashListRef<InboxStreamItemModel> | null>;
  onSelectStarter?: (prompt: string) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
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
    title: 'Capture a thought',
    prompt: 'I want to remember...',
  },
  {
    icon: 'bubble.left',
    title: 'Ask about your notes',
    prompt: 'Help me make sense of...',
  },
  {
    icon: 'paperclip',
    title: 'Drop a file',
    prompt: 'Summarize this for me:',
  },
] as const;

const SAMPLE_ITEMS = [
  {
    icon: 'note.text',
    title: 'Ideas from today',
    meta: 'Notes stay searchable',
  },
  {
    icon: 'bubble.left',
    title: 'What did I decide last week?',
    meta: 'Ask across your context',
  },
  {
    icon: 'doc.text',
    title: 'Project brief.pdf',
    meta: 'Files live beside notes',
  },
] as const;

export const InboxStream = ({
  items,
  listRef,
  onSelectStarter,
  refreshControl,
}: InboxStreamProps) => {
  const styles = useStreamStyles();

  const renderItem = useCallback<ListRenderItem<InboxStreamItemModel>>(({ item }) => {
    return <RenderInboxStreamItem item={item} />;
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <AppIcon name="sparkles" size={24} color={styles.emptyIconSymbol.color} />
          </View>
          <Text variant="title2" color="foreground" style={styles.emptyTitle}>
            Your workspace starts here
          </Text>
          <Text variant="body" color="text-secondary" style={styles.emptyBody}>
            Capture a note, ask Hakumi to connect the dots, or attach a file. Everything you add
            comes back here when you need it.
          </Text>

          <View style={styles.samplePanel}>
            <View style={styles.sampleHeader}>
              <Text variant="caption1" color="text-tertiary" style={styles.sampleLabel}>
                Example workspace
              </Text>
              <Text variant="caption1" color="text-tertiary">
                Preview
              </Text>
            </View>
            <View style={styles.sampleList}>
              {SAMPLE_ITEMS.map((item) => (
                <View key={item.title} style={styles.sampleRow}>
                  <View style={styles.sampleIcon}>
                    <AppIcon name={item.icon} size={15} color={styles.sampleIconSymbol.color} />
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
                  <AppIcon name={starter.icon} size={16} color={styles.starterIconSymbol.color} />
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
          contentContainerStyle={staticStyles.listContent}
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
    marginBottom: spacing[8] + spacing[8] + spacing[5],
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
    paddingBottom: spacing[8] + spacing[8] + spacing[5] + spacing[3],
  },
  sectionFooter: {
    height: 2,
  },
});
