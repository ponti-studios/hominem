// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  FadeIn: { duration: () => ({}) },
  FadeInUp: { duration: () => ({}) },
  useReducedMotion: () => true,
}));
vi.mock('~/components/theme', () => ({
  useAppTheme: () => ({ colors: { foreground: '', muted: '', mutedForeground: '', primary: '' } }),
  useStyles: (factory: (theme: unknown) => unknown) =>
    factory({
      colors: { foreground: '', muted: '', mutedForeground: '', primary: '' },
      textVariants: { body: {}, caption1: {} },
    }),
}));
vi.mock('~/components/ui/button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
// Avoids pulling in @shopify/react-native-skia, whose Platform module reads
// a "Platform" export the mocked "react-native" above doesn't provide.
// Renders every stage label (as the real component does) so text
// assertions below still hold.
vi.mock('~/components/time/StageCrossfade', () => ({
  StageCrossfade: ({ stages }: { stages: { id: string; label: string }[] }) => (
    <>
      {stages.map((stage) => (
        <span key={stage.id}>{stage.label}</span>
      ))}
    </>
  ),
}));

const { TimeProcessingView } = await import('~/components/time/TimeProcessingView');

describe('TimeProcessingView', () => {
  it('shows the active native lifecycle stage and can cancel', () => {
    const onCancel = vi.fn();
    const { getByText } = render(
      <TimeProcessingView onCancel={onCancel} stage="checkingSchedule" />,
    );

    expect(getByText('Understanding your request')).toBeDefined();
    expect(getByText('Checking your schedule')).toBeDefined();
    expect(getByText('Preparing your suggestion')).toBeDefined();
    fireEvent.click(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
