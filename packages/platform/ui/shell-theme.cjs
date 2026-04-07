'use strict';
// Pre-compiled shell theme constants.
// Source of truth: packages/platform/ui/src/theme.ts
// Keep in sync with src/tokens/colors.ts when color values change.
const shellTheme = {
  web: {
    themeColor: '#000000',
    backgroundColor: '#ffffff',
    browserconfigTileColor: '#ffffff',
    pinnedMaskColor: '#ffffff',
  },
  desktop: {
    backgroundColor: '#1A1814',
    foregroundColor: '#F5F2EC',
  },
  mobile: {
    splashBackgroundColor: '#000000',
    htmlBackgroundColor: '#000000',
    adaptiveIconBackgroundColor: '#000000',
    notificationColor: '#000000',
  },
};

module.exports = { shellTheme };
