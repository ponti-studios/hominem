import type { Theme } from '~/components/theme';

export function createChatMessageStyles(theme: Theme) {
  return {
    message: { width: '100%' as const },
    messageUser: { alignItems: 'flex-end' as const },
    messageAssistant: { alignItems: 'flex-start' as const },
    content: { gap: 8 },
    reasoningPanel: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadii.lg,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    reasoningText: { ...theme.textVariants.mono, color: theme.colors.foreground, opacity: 0.8 },
    retryRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      alignSelf: 'flex-end' as const,
    },
    interruptedRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
    retryText: { color: theme.colors.destructive, fontSize: 12 },
    interruptedText: { color: theme.colors.tertiary, fontSize: 12 },
    userBubble: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadii.xl,
      borderBottomRightRadius: 6,
      maxWidth: '82%' as const,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    assistantBubble: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadii.xl,
      borderBottomLeftRadius: 6,
      maxWidth: '94%' as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    continuous: { borderCurve: 'continuous' as const },
    userText: {
      color: theme.colors.primaryForeground,
      fontSize: 16,
      lineHeight: 24,
    },
    assistantText: {
      color: theme.colors.foreground,
      fontSize: 16,
      lineHeight: 25.6,
    },
  };
}

export type ChatMessageStyles = ReturnType<typeof createChatMessageStyles>;
