import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import OnDeviceAIModule, {
  type CalendarPermissionStatus,
  type OnDeviceAIAvailability,
} from '~/modules/on-device-ai';

// Experimental spike screen, gated in settings/index.tsx behind __DEV__ or
// ON_DEVICE_AI_SPIKE_ENABLED (EXPO_PUBLIC_ON_DEVICE_AI_SPIKE_ENABLED) — never
// part of unflagged production navigation. Exercises the on-device
// FoundationModels + EventKit CalendarLookupTool end to end. Requires a
// physical device with Apple Intelligence enabled; the simulator cannot run
// FoundationModels sessions.
export default function OnDeviceCalendarSpikeScreen() {
  const themeColors = useThemeColors();
  const [prompt, setPrompt] = useState('What do I have going on today?');
  const [response, setResponse] = useState('');
  const [availability, setAvailability] = useState<OnDeviceAIAvailability | null>(null);
  const [permission, setPermission] = useState<CalendarPermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      <Text style={[styles.heading, { color: themeColors.foreground }]}>
        On-device calendar spike
      </Text>

      <Button label="Check status" onPress={() => void checkStatus()} variant="secondary" />
      {availability ? (
        <Text style={{ color: themeColors['text-secondary'] }}>
          Model availability: {availability}
        </Text>
      ) : null}
      {permission ? (
        <Text style={{ color: themeColors['text-secondary'] }}>
          Calendar permission: {permission}
        </Text>
      ) : null}

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

      {error ? <Text style={{ color: themeColors.destructive }}>{error}</Text> : null}

      {response ? (
        <View
          style={[
            styles.responseBox,
            {
              borderColor: themeColors['border-default'],
              backgroundColor: themeColors['bg-surface'],
            },
          ]}
        >
          <Text
            testID="on-device-calendar-spike-response"
            style={{ color: themeColors.foreground }}
          >
            {response}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    padding: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
  },
  input: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
    padding: 12,
  },
  responseBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
});
