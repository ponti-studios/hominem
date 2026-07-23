import type { SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  fontSizes,
  makeStyles,
  spacing,
  Text,
  useThemeColors,
  type ColorToken,
} from '~/components/theme';
import { createEnter, createLayoutTransition } from '~/components/theme/animations';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { Input } from '~/components/ui/input';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import OnDeviceAIModule, { type OnDeviceAILogEvent } from '~/modules/on-device-ai';

interface LogLine {
  key: string;
  type: string;
  message: string;
}

// Icon + tint per log event type: the row's only status signal.
function stepPresentation(type: string): { icon: SFSymbol; tint: ColorToken } {
  switch (type) {
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
      <AppIcon name={icon} size={12} tintColor={themeColors[tint]} />
      <Text color="text-secondary" style={styles.message}>
        {line.message}
      </Text>
    </Animated.View>
  );
}

// Uses the on-device FoundationModels + EventKit CalendarLookupTool end to end.
// Requires a device or simulator with Apple Intelligence enabled on supported
// host hardware. The iOS Simulator uses the host Mac's Apple Intelligence model.
export default function OnDeviceCalendarSpikeScreen() {
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
          { key: `${logCounter.current}`, type: event.type, message: event.message },
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

  // The trace is only useful while waiting on an answer — once the answer
  // lands, it folds away so the answer is the last thing on screen.
  const showLog = logs.length > 0 && !response;

  return (
    <ScrollView contentContainerStyle={styles.content} testID="calendar-screen">
      <Input
        testID="calendar-input"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        placeholder="What do I have going on today?"
        style={styles.input}
      />
      <Button
        testID="calendar-ask-button"
        label="Ask calendar"
        onPress={() => void ask()}
        loading={isLoading}
      />

      {error ? <Text color="destructive">{error}</Text> : null}

      {showLog ? (
        <Animated.View
          testID="calendar-log"
          layout={createLayoutTransition(reducedMotion)}
          style={styles.log}
        >
          {logs.map((line) => (
            <LogStepRow key={line.key} line={line} reducedMotion={reducedMotion} />
          ))}
        </Animated.View>
      ) : null}

      {response ? (
        <Animated.View entering={createEnter(reducedMotion)}>
          <Text testID="calendar-response">{response}</Text>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  content: {
    gap: spacing[4],
    padding: spacing[4],
  },
  input: {
    minHeight: 72,
  },
  log: {
    gap: spacing[1],
  },
}));

const useLogStepStyles = makeStyles(() => ({
  message: {
    flex: 1,
    fontFamily: 'Menlo',
    fontSize: fontSizes.caption1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
}));
