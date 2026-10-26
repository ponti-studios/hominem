import { useStyles } from '~/components/theme';

// The card chrome shared by tool calls and the reasoning card above a reply.
export function useToolCardStyles() {
  return useStyles((theme) => ({
    toolCalls: { gap: 10, marginBottom: 10, width: '94%' },
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    asking: { borderColor: theme.colors.primary, borderStyle: 'dashed', borderWidth: 2 },
    rejected: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.mutedForeground,
      borderStyle: 'dashed',
      borderWidth: 2,
      opacity: 0.8,
    },
    failed: { borderColor: theme.colors.coral, borderWidth: 2 },
    tile: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 11,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    body: { flex: 1, gap: 2, minWidth: 0 },
    draftChip: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    draftChipText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    title: { color: theme.colors.foreground, fontSize: 14, fontWeight: '800' },
    mutedTitle: { color: theme.colors.mutedForeground, fontSize: 14, fontWeight: '800' },
    detail: {
      color: theme.colors.mutedForeground,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 17,
    },
    struck: { textDecorationLine: 'line-through' },
  }));
}
