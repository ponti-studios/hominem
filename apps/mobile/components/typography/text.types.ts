export type AppleTextVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption1'
  | 'caption2'
  | 'mono';

export type LegacyTextVariant = 'body-1' | 'body-2' | 'body-3' | 'body-4';

export type TextVariant = AppleTextVariant | LegacyTextVariant;
