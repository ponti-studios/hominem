import { colors, darkColors } from './tokens/index';

export const shellTheme = {
  web: {
    themeColor: colors['text-primary'],
    backgroundColor: colors['bg-base'],
    browserconfigTileColor: colors['bg-base'],
    pinnedMaskColor: colors.white,
  },
  desktop: {
    backgroundColor: darkColors['bg-base'],
    foregroundColor: darkColors['text-primary'],
  },
  mobile: {
    splashBackgroundColor: colors.black,
    htmlBackgroundColor: colors.black,
    adaptiveIconBackgroundColor: colors.black,
    notificationColor: colors.black,
  },
} as const;
