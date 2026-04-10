import type { Theme } from '~/components/theme';

export function getAuthScreenBaseStyles(t: Theme) {
  return {
    form: {
      width: '100%',
      rowGap: t.spacing.m_16,
    },
    fieldStack: {
      rowGap: t.spacing.xs_4,
    },
    errorText: {
      color: t.colors.destructive,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    primaryButton: {
      width: '100%',
    },
  } as const;
}
