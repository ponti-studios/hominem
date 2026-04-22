import { makeStyles } from '~/components/theme';

const CARD_RADIUS = 14;
const ROW_HEIGHT = 50;

export const useSharedStyles = makeStyles((theme) => ({
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors['text-tertiary'],
    letterSpacing: 0.1,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 6,
  },
  rowPressable: {
    minHeight: ROW_HEIGHT,
  },
  rowPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: ROW_HEIGHT,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: theme.colors['border-subtle'],
    marginLeft: 14 + 32 + 12,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowIcon: {
    width: 16,
    height: 16,
  },
  rowContent: {
    flex: 1,
    gap: 2,
    paddingVertical: 13,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: theme.colors.foreground,
  },
  rowSublabel: {
    fontSize: 12,
    color: theme.colors['text-tertiary'],
  },
  rowTrailing: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  chevron: {
    width: 14,
    height: 14,
    opacity: 0.4,
  },
  trailingValue: {
    fontSize: 15,
    color: theme.colors['text-tertiary'],
    maxWidth: 160,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineInput: {
    fontSize: 15,
    color: theme.colors['text-secondary'],
    textAlign: 'right',
    minWidth: 80,
    maxWidth: 160,
    padding: 0,
  },
  inlineSaveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
  },
  inlineSaveLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors['accent-foreground'],
  },
  inlineErrorBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.destructive,
    backgroundColor: theme.colors['destructive-muted'],
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineStatusError: {
    fontSize: 12,
    color: theme.colors.destructive,
  },
  trashIcon: {
    width: 16,
    height: 16,
  },
  dangerZone: {
    marginTop: 32,
    gap: 1,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors['border-subtle'],
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.colors['bg-base'],
  },
  dangerButtonPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  dangerIcon: {
    width: 18,
    height: 18,
  },
  dangerLabel: {
    fontSize: 16,
    color: theme.colors.destructive,
    fontWeight: '400',
  },
  dangerLabelMuted: {
    color: theme.colors['text-tertiary'],
  },
}));

export const useSharedCardStyles = makeStyles((theme) => ({
  base: {
    backgroundColor: theme.colors['bg-base'],
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors['border-subtle'],
    overflow: 'hidden',
  },
}));
