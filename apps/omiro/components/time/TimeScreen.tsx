import { MenuView, type MenuAction, type NativeActionEvent } from '@expo/ui/community/menu';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles } from '~/components/theme';
import { IconButton } from '~/components/ui';
import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { calendarKeys } from '~/services/calendar/calendar-queries';
import { getTimeBlockRoute, UNSCHEDULED_ROUTE } from '~/services/navigation/routes';

import AppIcon from '../ui/icon';
import { useTimePreview } from './time-preview-store';
import { TimeExtractionSheet, type TimeExtractionMode } from './TimeExtractionSheet';
import { TimeStream } from './TimeStream';

export function TimeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const [extractionMode, setExtractionMode] = useState<TimeExtractionMode | null>(null);
  const [extractionSessionKey, setExtractionSessionKey] = useState(0);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [toastExpanded, setToastExpanded] = useState(false);
  const showError = useCallback((message: string) => {
    setToastExpanded(false);
    setToastKey((key) => key + 1);
    setErrorToast(message);
  }, []);
  const openExtraction = useCallback((mode: TimeExtractionMode) => {
    setExtractionSessionKey((key) => key + 1);
    setExtractionMode(mode);
  }, []);
  const openItem = useCallback(
    async (item: { kind: 'event' | 'task'; value: { id: string } }) => {
      if (item.kind === 'task') {
        router.push(getTimeBlockRoute('task', item.value.id));
        return;
      }
      try {
        const result = await calendarEventGateway.presentEvent(item.value.id);
        if (result === 'saved' || result === 'deleted') {
          await queryClient.invalidateQueries({ queryKey: calendarKeys.events });
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unable to open this calendar event.');
      }
    },
    [queryClient, router, showError],
  );
  const openEvent = useCallback(
    async (event: { id: string }) => openItem({ kind: 'event', value: event }),
    [openItem],
  );
  const theme = useAppTheme();
  const styles = useStyles((theme) => ({
    container: { backgroundColor: theme.colors.background, flex: 1 },
    floatingActions: {
      position: 'absolute',
      right: 16,
      bottom: safeAreaBottom + 16,
      alignItems: 'center',
      gap: 10,
    },
    floatingButton: { width: 52, height: 52, boxShadow: theme.shadows.md },
    floatingMic: { backgroundColor: theme.colors.card },
    floatingAdd: { backgroundColor: theme.colors.primary },
    errorToast: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
      marginHorizontal: 16,
      marginBottom: 4,
      padding: 8,
      borderColor: theme.colors.destructive,
    },
    errorContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
    errorText: { ...theme.textVariants.footnote, color: theme.colors.destructive, flex: 1 },
    successToast: {
      marginHorizontal: 16,
      marginBottom: safeAreaBottom + 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.success,
      borderWidth: 1,
    },
    successText: { ...theme.textVariants.footnote, color: theme.colors.success },
  }));

  return (
    <View style={styles.container} testID="time-screen">
      <TimeStream
        contentPaddingBottom={safeAreaBottom + 104}
        onError={showError}
        onOpenItem={openItem}
      />
      {errorToast !== null ? (
        <View
          key={toastKey}
          style={[styles.errorToast, { borderCurve: 'continuous', boxShadow: theme.shadows.md }]}
        >
          <Pressable
            accessibilityLabel={`Error: ${errorToast}`}
            accessibilityRole="button"
            onPress={() => setToastExpanded((expanded) => !expanded)}
            style={styles.errorContent}
          >
            <Text style={styles.errorText} numberOfLines={toastExpanded ? undefined : 1}>
              {errorToast}
            </Text>
            <IconButton
              accessibilityLabel="Copy error"
              onPress={() => {
                void Clipboard.setStringAsync(errorToast);
              }}
            >
              <AppIcon name="doc.on.doc" size={20} />
            </IconButton>
          </Pressable>
          <IconButton
            accessibilityLabel="Dismiss error"
            onPress={() => {
              setErrorToast(null);
              setToastExpanded(false);
            }}
          >
            <AppIcon name="xmark" size={20} />
          </IconButton>
        </View>
      ) : null}
      {successToast !== null ? (
        <View style={styles.successToast} testID="time-task-created">
          <Text style={styles.successText}>{successToast}</Text>
        </View>
      ) : null}
      {extractionMode === null ? (
        <View style={styles.floatingActions} testID="time-extraction-actions">
          <IconButton
            accessibilityLabel="Start voice task extraction"
            onPress={() => openExtraction('voice')}
            style={[styles.floatingButton, styles.floatingMic]}
            testID="time-floating-mic"
          >
            <AppIcon name="mic.fill" size={22} />
          </IconButton>
          <IconButton
            accessibilityLabel="Open task extraction"
            onPress={() => openExtraction('text')}
            style={[styles.floatingButton, styles.floatingAdd]}
            testID="time-floating-add"
          >
            <AppIcon name="plus" size={24} tintColor={theme.colors.primaryForeground} />
          </IconButton>
        </View>
      ) : null}
      <TimeExtractionSheet
        initialMode={extractionMode ?? 'text'}
        onClose={() => setExtractionMode(null)}
        onOpenEvent={openEvent}
        onTaskCreated={() => {
          setSuccessToast('Task added to Time.');
          setTimeout(() => setSuccessToast(null), 2400);
        }}
        sessionKey={extractionSessionKey}
        visible={extractionMode !== null}
      />
    </View>
  );
}

export function TimeHeaderActions() {
  const router = useRouter();

  return (
    <>
      {__DEV__ ? <TimePreviewMenuButton /> : null}
      <Pressable
        accessibilityLabel="Open unscheduled tasks"
        accessibilityRole="button"
        onPress={() => router.push(UNSCHEDULED_ROUTE)}
        testID="time-unscheduled-button"
      >
        <AppIcon name="checkmark.circle.dotted" size={24} />
      </Pressable>
    </>
  );
}

// __DEV__ only: lets a dev preview the Time stream's design with fixture
// data (multiple events per day, overlapping times, empty state, etc.)
// without needing a real calendar/task backend. See time-preview-scenarios.ts.
function TimePreviewMenuButton() {
  const { scenario, scenarios, setScenarioId } = useTimePreview();

  const actions: MenuAction[] = [
    ...scenarios.map((candidate) => ({
      id: candidate.id,
      title: candidate.label,
      state: scenario?.id === candidate.id ? ('on' as const) : undefined,
    })),
    {
      id: 'real-data',
      title: 'Real data',
      state: scenario == null ? ('on' as const) : undefined,
    },
  ];

  const onPressAction = (event: NativeActionEvent) => {
    const id = event.nativeEvent.event;
    setScenarioId(id === 'real-data' ? null : id);
  };

  return (
    <MenuView actions={actions} onPressAction={onPressAction} testID="time-preview-menu-button">
      <IconButton
        accessibilityLabel="Preview Time with fixture data"
        testID="time-preview-menu-button"
        variant="plain"
      >
        <AppIcon name={scenario ? 'flask.fill' : 'flask'} size={22} />
      </IconButton>
    </MenuView>
  );
}
