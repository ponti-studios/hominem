import type { SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
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
import OnDeviceAIModule, { type OnDeviceAILogEvent } from '~/modules/on-device-ai';

interface LogLine {
  key: string;
  type: string;
  message: string;
  timestamp: number;
  durationMs?: number;
}

const promptSuggestions = [
  'What’s next?',
  'Tomorrow morning',
  'Find me free time',
  'What’s on this week?',
];

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

function stepLabel(type: string): string {
  switch (type) {
    case 'session_start':
      return 'Session';
    case 'prompt_sent':
      return 'Prompt';
    case 'tool_call':
      return 'Calendar query';
    case 'tool_result':
      return 'Calendar result';
    case 'response_received':
      return 'Response';
    case 'tool_error':
    case 'generation_error':
      return 'Error';
    default:
      return 'Step';
  }
}

function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) return '—';
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
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
      <Animated.View style={styles.copy}>
        <Text color="text-secondary" style={styles.meta}>
          {new Date(line.timestamp).toLocaleTimeString()} · {stepLabel(line.type)} ·{' '}
          {formatDuration(line.durationMs)}
        </Text>
        <Text color="text-secondary" style={styles.message}>
          {line.message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// Experimental spike screen, gated in settings/index.tsx behind __DEV__ or
// ON_DEVICE_AI_SPIKE_ENABLED (EXPO_PUBLIC_ON_DEVICE_AI_SPIKE_ENABLED) — never
// part of unflagged production navigation. Exercises the on-device
// FoundationModels + EventKit CalendarLookupTool end to end. Requires a
// device or simulator with Apple Intelligence enabled on supported host
// hardware. The iOS Simulator uses the host Mac's Apple Intelligence model.
export default function OnDeviceCalendarSpikeScreen() {
  const themeColors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const styles = useStyles();
  const [prompt, setPrompt] = useState('What do I have going on today?');
  const [response, setResponse] = useState('');
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
            durationMs: event.durationMs,
          },
        ]);
      },
    );
    return () => subscription.remove();
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
      <View style={[styles.heroCard, { backgroundColor: themeColors['bg-elevated'] }]}>
        <View style={[styles.heroOrb, { backgroundColor: themeColors.accent }]}>
          <AppIcon name="calendar" size={24} tintColor={themeColors['primary-foreground']} />
        </View>
        <Text color="text-tertiary" style={styles.eyebrow}>
          PRIVATE CALENDAR LENS
        </Text>
        <Text style={styles.heroTitle}>Make sense of your time.</Text>
        <Text color="text-secondary" style={styles.heroCopy}>
          Ask in plain English. Your calendar stays on this device.
        </Text>
      </View>

      <View style={styles.suggestionSection}>
        <Text color="text-secondary" style={styles.sectionLabel}>
          TRY ASKING
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestions}
        >
          {promptSuggestions.map((suggestion) => (
            <Button
              key={suggestion}
              label={suggestion}
              onPress={() => setPrompt(suggestion)}
              variant="secondary"
              size="sm"
            />
          ))}
        </ScrollView>
      </View>

      <View style={[styles.askCard, { backgroundColor: themeColors['bg-surface'] }]}>
        <Text style={styles.askLabel}>Ask anything</Text>
        <TextInput
          testID="on-device-calendar-spike-input"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          placeholder="What do I have going on today?"
          placeholderTextColor={themeColors['text-tertiary']}
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
          label={isLoading ? 'Thinking…' : 'Ask calendar'}
          onPress={() => void ask()}
          disabled={isLoading}
        />
      </View>

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
            Live trace
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
          <View style={styles.responseHeader}>
            <AppIcon name="sparkles" size={16} tintColor={themeColors.accent} />
            <Text color="text-secondary" style={styles.responseLabel}>
              Your calendar says
            </Text>
          </View>
          <Text testID="on-device-calendar-spike-response">{response}</Text>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  askCard: {
    borderRadius: radii.lg,
    gap: spacing[3],
    padding: spacing[4],
  },
  askLabel: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  content: {
    gap: spacing[4],
    padding: spacing[4],
  },
  eyebrow: {
    fontSize: fontSizes.caption1,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroCard: {
    borderRadius: radii.xl,
    gap: spacing[2],
    padding: spacing[5],
  },
  heroCopy: {
    fontSize: fontSizes.md,
  },
  heroOrb: {
    alignItems: 'center',
    borderRadius: radii.icon,
    height: 48,
    justifyContent: 'center',
    marginBottom: spacing[2],
    width: 48,
  },
  heroTitle: {
    fontSize: fontSizes.title1,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: fontSizes.md,
    minHeight: 72,
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
  responseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  responseLabel: {
    fontSize: fontSizes.caption1,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  responseBox: {
    gap: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  sectionLabel: {
    fontSize: fontSizes.caption1,
    fontWeight: '700',
    letterSpacing: 1,
  },
  suggestionSection: {
    gap: spacing[2],
  },
  suggestions: {
    gap: spacing[2],
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
  meta: {
    fontSize: fontSizes.caption1,
    fontWeight: '600',
  },
  copy: {
    flex: 1,
    gap: spacing[1],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
}));
