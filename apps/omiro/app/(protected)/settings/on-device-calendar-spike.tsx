import type { SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { ChatThinkingIndicator } from '~/components/chat/chat-thinking-indicator';
import {
  fontSizes,
  makeStyles,
  radii,
  spacing,
  Text,
  useThemeColors,
  type ColorToken,
} from '~/components/theme';
import { createEnter, createLayoutTransition } from '~/components/theme/animations';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import OnDeviceAIModule, {
  type CalendarPermissionStatus,
  type OnDeviceAILogEvent,
  type OnDeviceAIAvailability,
} from '~/modules/on-device-ai';

interface LogLine {
  key: string;
  type: string;
  message: string;
  timestamp: number;
}

// Icon + tint per log event type, so the processing steps read like tool-call
// chips (a completed step, a result, a failure) instead of an undifferentiated
// stream of text.
function stepPresentation(type: string): { icon: SFSymbol; tint: ColorToken } {
  switch (type) {
    case 'session_start':
      return { icon: 'gearshape.fill', tint: 'text-tertiary' };
    case 'prompt_sent':
      return { icon: 'paperplane.fill', tint: 'text-tertiary' };
    case 'tool_call':
      return { icon: 'wrench.and.screwdriver.fill', tint: 'text-secondary' };
    case 'tool_result':
      return { icon: 'checkmark.circle.fill', tint: 'success' };
    case 'tool_error':
    case 'generation_error':
      return { icon: 'exclamationmark.triangle.fill', tint: 'destructive' };
    case 'response_received':
      return { icon: 'text.bubble.fill', tint: 'success' };
    default:
      return { icon: 'circle.fill', tint: 'text-tertiary' };
  }
}

function LogStepRow({ line, reducedMotion }: { line: LogLine; reducedMotion: boolean }) {
  const styles = useLogStepStyles();
  const themeColors = useThemeColors();
  const { icon, tint } = stepPresentation(line.type);

  return (
    <Animated.View
      entering={createEnter(reducedMotion)}
      layout={createLayoutTransition(reducedMotion)}
      style={styles.row}
    >
      <AppIcon name={icon} size={14} tintColor={themeColors[tint]} style={styles.icon} />
      <Text color="text-secondary" style={styles.message}>
        {new Date(line.timestamp).toLocaleTimeString()} — {line.message}
      </Text>
    </Animated.View>
  );
}

// Experimental spike screen, gated in settings/index.tsx behind __DEV__ or
// ON_DEVICE_AI_SPIKE_ENABLED (EXPO_PUBLIC_ON_DEVICE_AI_SPIKE_ENABLED) — never
// part of unflagged production navigation. Exercises the on-device
// FoundationModels + EventKit CalendarLookupTool end to end. Requires a
// physical device with Apple Intelligence enabled; the simulator cannot run
// FoundationModels sessions.
export default function OnDeviceCalendarSpikeScreen() {
  const themeColors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const styles = useStyles();
  const [prompt, setPrompt] = useState('What do I have going on today?');
  const [response, setResponse] = useState('');
  const [availability, setAvailability] = useState<OnDeviceAIAvailability | null>(null);
  const [permission, setPermission] = useState<CalendarPermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logCounter = useRef(0);

  useEffect(() => {
    const subscription = OnDeviceAIModule.addListener(
      'onDeviceAILog',
      (event: OnDeviceAILogEvent) => {
        logCounter.current += 1;
        setLogs((prev) => [
          ...prev,
          {
            key: `${logCounter.current}`,
            type: event.type,
            message: event.message,
            timestamp: event.timestamp,
          },
        ]);
      },
    );
    return () => subscription.remove();
  }, []);

  const checkStatus = useCallback(async () => {
    const [nextAvailability, nextPermission] = await Promise.all([
      OnDeviceAIModule.getAvailability(),
      OnDeviceAIModule.getCalendarPermissions(),
    ]);
    setAvailability(nextAvailability);
    setPermission(nextPermission);
  }, []);

  const requestPermission = useCallback(async () => {
    const status = await OnDeviceAIModule.requestCalendarPermissions();
    setPermission(status);
  }, []);

  const ask = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setResponse('');
    setLogs([]);
    try {
      const result = await OnDeviceAIModule.askCalendar(prompt);
      setResponse(result.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="on-device-calendar-spike-screen">
      <Text style={styles.heading}>On-device calendar spike</Text>

      <Button label="Check status" onPress={() => void checkStatus()} variant="secondary" />
      {availability ? <Text color="text-secondary">Model availability: {availability}</Text> : null}
      {permission ? <Text color="text-secondary">Calendar permission: {permission}</Text> : null}

      {permission !== 'authorized' ? (
        <Button
          label="Request calendar access"
          onPress={() => void requestPermission()}
          variant="secondary"
        />
      ) : null}

      <TextInput
        testID="on-device-calendar-spike-input"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        style={[
          styles.input,
          {
            backgroundColor: themeColors.background,
            borderColor: themeColors['border-default'],
            color: themeColors.foreground,
          },
        ]}
      />

      <Button
        testID="on-device-calendar-spike-ask-button"
        label={isLoading ? 'Asking…' : 'Ask'}
        onPress={() => void ask()}
        disabled={isLoading}
      />

      {error ? (
        <Animated.View entering={createEnter(reducedMotion)}>
          <Text color="destructive">{error}</Text>
        </Animated.View>
      ) : null}

      {logs.length > 0 || isLoading ? (
        <Animated.View
          testID="on-device-calendar-spike-log"
          layout={createLayoutTransition(reducedMotion)}
          style={[
            styles.logBox,
            {
              borderColor: themeColors['border-default'],
              backgroundColor: themeColors['bg-surface'],
            },
          ]}
        >
          <Text color="text-secondary" style={styles.logHeading}>
            Processing steps
          </Text>
          {logs.map((line) => (
            <LogStepRow key={line.key} line={line} reducedMotion={reducedMotion} />
          ))}
          {isLoading ? <ChatThinkingIndicator /> : null}
        </Animated.View>
      ) : null}

      {response ? (
        <Animated.View
          entering={createEnter(reducedMotion)}
          style={[
            styles.responseBox,
            {
              borderColor: themeColors['border-default'],
              backgroundColor: themeColors['bg-surface'],
            },
          ]}
        >
          <Text testID="on-device-calendar-spike-response">{response}</Text>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  content: {
    gap: spacing[3],
    padding: spacing[4],
  },
  heading: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 60,
    padding: spacing[3],
  },
  logBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1],
    padding: spacing[3],
  },
  logHeading: {
    fontSize: fontSizes.caption1,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  responseBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing[3],
  },
}));

const useLogStepStyles = makeStyles(() => ({
  icon: {
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontFamily: 'Menlo',
    fontSize: fontSizes.caption1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
}));
