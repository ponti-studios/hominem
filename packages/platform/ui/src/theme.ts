import { colors } from './tokens/index';

export const shellTheme = {
  web: {
    themeColor: colors['text-primary'],
    backgroundColor: colors['bg-base'],
    browserconfigTileColor: colors['bg-base'],
    pinnedMaskColor: colors.white,
  },
  desktop: {
    backgroundColor: colors['bg-base'],
    foregroundColor: colors['text-primary'],
  },
  mobile: {
    splashBackgroundColor: colors.black,
    htmlBackgroundColor: colors.black,
    adaptiveIconBackgroundColor: colors.black,
    notificationColor: colors.black,
  },
} as const;
