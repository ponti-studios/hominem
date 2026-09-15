// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAsk = vi.fn();
const mockSetPrompt = vi.fn();
const mockHandleVoicePress = vi.fn();

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: () => <div />,
  Pressable: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
    <button onClick={onPress}>{children}</button>
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
  useReducedMotion: () => true,
}));
vi.mock('~/components/theme', () => ({
  useAppTheme: () => ({
    colors: {
      border: '',
      card: '',
      foreground: '',
      muted: '',
      mutedForeground: '',
      primary: '',
      primaryForeground: '',
    },
    textVariants: { body: {}, caption1: {}, footnote: {}, subhead: {} },
  }),
  useStyles: (factory: (theme: unknown) => unknown) =>
    factory({
      colors: {
        border: '',
        card: '',
        foreground: '',
        muted: '',
        mutedForeground: '',
        primary: '',
        primaryForeground: '',
      },
      textVariants: { body: {}, caption1: {}, footnote: {}, subhead: {} },
    }),
}));
vi.mock('~/components/ui', () => ({
  IconButton: ({
    children,
    disabled,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  TextField: ({
    autoFocus: _autoFocus,
    onChangeText,
    onSubmitEditing,
    testID,
    value,
  }: {
    autoFocus?: boolean;
    onChangeText?: (value: string) => void;
    onSubmitEditing?: () => void;
    testID: string;
    value: string;
  }) => (
    <input
      data-testid={testID}
      value={value}
      onChange={(event) => onChangeText?.(event.target.value)}
      onKeyDown={(event) => event.key === 'Enter' && onSubmitEditing?.()}
    />
  ),
}));
vi.mock('~/components/ui/icon', () => ({ default: () => null }));
vi.mock('~/components/ui/InlineErrorBanner', () => ({
  InlineErrorBanner: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock('~/components/composer/useVoiceComposerInput', () => ({
  useVoiceComposerInput: () => ({
    clearError: vi.fn(),
    error: null,
    handleVoicePress: mockHandleVoicePress,
    isBusy: false,
    isCleaningVoice: false,
    isRecording: false,
    isRecordingElsewhere: false,
    recordingStartedAt: null,
    voiceState: 'idle',
  }),
}));
vi.mock('~/components/voice/VoiceRecordingPanel', () => ({ VoiceRecordingPanel: () => <div /> }));
vi.mock('~/components/time/TimeProcessingView', () => ({ TimeProcessingView: () => <div /> }));
vi.mock('~/components/time/TimeResultSurface', () => ({ TimeResultSurface: () => <div /> }));
vi.mock('~/components/time/use-time-composer', () => ({
  useTimeComposer: () => ({
    ask: mockAsk,
    cancelProcessing: vi.fn(),
    cancelResult: vi.fn(),
    chooseEvent: vi.fn(),
    chooseOpening: vi.fn(),
    interaction: { kind: 'idle' },
    isSaving: false,
    processingStage: 'understanding',
    prompt: 'Plan tomorrow',
    reset: vi.fn(),
    retry: vi.fn(),
    setPrompt: mockSetPrompt,
    submitDraft: vi.fn(),
    updateDraft: vi.fn(),
  }),
}));

const { TimeComposer } = await import('~/components/time/TimeComposer');

describe('TimeComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  it('forwards text, submit, and voice actions from the sheet', () => {
    const { getByTestId } = render(
      <TimeComposer
        initialMode="text"
        onClose={vi.fn()}
        onOpenEvent={vi.fn()}
        onTaskCreated={vi.fn()}
        visible
      />,
    );

    fireEvent.change(getByTestId('time-composer-input'), { target: { value: 'Plan today' } });
    fireEvent.click(getByTestId('time-composer-submit'));
    fireEvent.click(getByTestId('time-composer-mic-button'));

    expect(mockSetPrompt).toHaveBeenCalledWith('Plan today');
    expect(mockAsk).toHaveBeenCalledOnce();
    expect(mockHandleVoicePress).toHaveBeenCalledOnce();
  });
});
