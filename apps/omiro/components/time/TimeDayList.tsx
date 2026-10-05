import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { memo, useCallback, useMemo } from 'react';
import { RefreshControl, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import type { CalendarPermissionStatus } from '~/modules/on-device-ai';

import type { TimeItem } from './time-types';
import { buildDayRows, type DayRow, itemHasEnded } from './time-utils';
import { TimeEventCard, TimeTaskCard } from './TimeCards';
import { TimeNowMarker } from './TimeNowMarker';

interface TimeDayListProps {
  contentPaddingBottom: number;
  isLoading: boolean;
  isToday: boolean;
  items: TimeItem[];
  now: Date;
  onConnectCalendar: () => void;
  onOpenItem: (item: TimeItem) => void;
  onRefresh: () => void;
  onToggleTask: (item: TimeItem) => void;
  permission: CalendarPermissionStatus | null;
}

const keyExtractor = (row: DayRow) =>
  row.kind === 'now'
    ? 'now'
    : `${row.item.kind}:${row.item.value.id}:${row.item.kind === 'event' ? row.item.value.startDate : ''}`;
const getItemType = (row: DayRow) => (row.kind === 'now' ? 'now' : row.item.kind);

export const TimeDayList = memo(function TimeDayList({
  contentPaddingBottom,
  isLoading,
  isToday,
  items,
  now,
  onConnectCalendar,
  onOpenItem,
  onRefresh,
  onToggleTask,
  permission,
}: TimeDayListProps) {
  const rows = useMemo(() => buildDayRows(items, isToday ? now : null), [isToday, items, now]);
  const hasItems = items.length > 0;

  const renderItem: ListRenderItem<DayRow> = useCallback(
    ({ item: row }) => {
      if (row.kind === 'now') {
        return <TimeNowMarker now={now} />;
      }
      return row.item.kind === 'event' ? (
        <TimeEventCard
          ended={isToday && itemHasEnded(row.item, now)}
          item={row.item}
          onOpen={onOpenItem}
          onToggleTask={onToggleTask}
        />
      ) : (
        <TimeTaskCard
          ended={false}
          item={row.item}
          onOpen={onOpenItem}
          onToggleTask={onToggleTask}
        />
      );
    },
    [isToday, now, onOpenItem, onToggleTask],
  );

  return (
    <FlashList
      ItemSeparatorComponent={Gap}
      ListEmptyComponent={isLoading ? <TimeLoading /> : <TimeEmpty isToday={isToday} />}
      ListHeaderComponent={
        permission && permission !== 'authorized' ? (
          <PermissionNotice denied={permission === 'denied'} onConnect={onConnectCalendar} />
        ) : null
      }
      contentContainerStyle={{
        paddingBottom: contentPaddingBottom,
        paddingHorizontal: 16,
        paddingTop: 16,
      }}
      data={hasItems ? rows : []}
      getItemType={getItemType}
      keyExtractor={keyExtractor}
      keyboardDismissMode="on-drag"
      refreshControl=<RefreshControl onRefresh={onRefresh} refreshing={false} />
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      testID="time-stream"
    />
  );
});

function Gap() {
  return <View style={{ height: 10 }} />;
}

function PermissionNotice({ denied, onConnect }: { denied: boolean; onConnect: () => void }) {
  const styles = useStyles((theme) => ({
    notice: {
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      gap: 8,
      marginBottom: 10,
      padding: 16,
    },
    title: { ...theme.textVariants.headline, color: theme.colors.foreground },
    body: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
  }));
  return (
    <View style={styles.notice} testID="time-calendar-permission-notice">
      <Text style={styles.title}>Bring your calendar in</Text>
      <Text style={styles.body}>
        Connect iOS Calendar to see events here. Tasks and planning work without it.
      </Text>
      <Button
        label={denied ? 'Open Settings' : 'Connect Calendar'}
        onPress={onConnect}
        size="sm"
        testID="time-calendar-connect"
        variant="primary"
      />
    </View>
  );
}

function TimeEmpty({ isToday }: { isToday: boolean }) {
  const { eventSun, eventForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    wrap: { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 56 },
    badge: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 44,
      height: 132,
      justifyContent: 'center',
      transform: [{ rotate: '-6deg' }],
      width: 132,
    },
    title: { ...theme.textVariants.title1, color: theme.colors.foreground },
    body: {
      ...theme.textVariants.callout,
      color: theme.colors.mutedForeground,
      textAlign: 'center',
    },
  }));
  return (
    <View style={styles.wrap} testID="time-empty-state">
      <View style={[styles.badge, { backgroundColor: eventSun }]}>
        <AppIcon name="sparkles" size={60} tintColor={eventForeground} />
      </View>
      <Text style={styles.title}>{isToday ? 'A clear day' : 'Nothing planned'}</Text>
      <Text style={styles.body}>Tell me what you want to do and I’ll find the time.</Text>
    </View>
  );
}

function TimeLoading() {
  const styles = useStyles((theme) => ({
    block: { backgroundColor: theme.colors.muted, borderRadius: 22, height: 72 },
    wrap: { gap: 10 },
  }));
  return (
    <View style={styles.wrap} testID="time-loading-state">
      <View style={styles.block} />
      <View style={styles.block} />
      <View style={styles.block} />
    </View>
  );
}
