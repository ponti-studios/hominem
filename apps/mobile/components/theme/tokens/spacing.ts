export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export const contentWidths = {
  bubble: '36rem',
  transcript: '44rem',
  notePreview: '32ch',
} as const;

export type SpacingToken = keyof typeof spacing;
export type ContentWidthToken = keyof typeof contentWidths;
