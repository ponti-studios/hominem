export const radiiNative = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
  icon: 20,
} as const;

export type RadiusToken = keyof typeof radiiNative;
