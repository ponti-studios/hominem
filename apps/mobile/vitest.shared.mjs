const rootUrl = import.meta.url;

export const mobileVitestResolve = {
  alias: {
    '@react-native-community/datetimepicker': new URL(
      './tests/__mocks__/datetimepicker.tsx',
      rootUrl,
    ).pathname,
    'expo-font': new URL('./tests/__mocks__/expo-font.ts', rootUrl).pathname,
    'expo-haptics': new URL('./tests/__mocks__/expo-haptics.ts', rootUrl).pathname,
    'expo-image': new URL('./tests/__mocks__/expo-image.tsx', rootUrl).pathname,
    'expo-image-picker': new URL('./tests/__mocks__/expo-image-picker.ts', rootUrl).pathname,
    'expo-media-library': new URL('./tests/__mocks__/expo-media-library.ts', rootUrl).pathname,
    'expo-router': new URL('./tests/__mocks__/expo-router.tsx', rootUrl).pathname,
    'react-native': new URL('./tests/__mocks__/react-native.ts', rootUrl).pathname,
    'react-native-safe-area-context': new URL(
      './tests/__mocks__/react-native-safe-area-context.tsx',
      rootUrl,
    ).pathname,
    'react-native-vision-camera': new URL(
      './tests/__mocks__/react-native-vision-camera.tsx',
      rootUrl,
    ).pathname,
    '~/components/focus/note-editing-sheet': new URL(
      './tests/__mocks__/note-editing-sheet.tsx',
      rootUrl,
    ).pathname,
    '~/components/ui/icon': new URL('./tests/__mocks__/icon.tsx', rootUrl).pathname,
    '~/lib/posthog': new URL('./tests/__mocks__/posthog.ts', rootUrl).pathname,
    '~/utils/services/notes/use-update-note': new URL(
      './tests/__mocks__/use-update-note.ts',
      rootUrl,
    ).pathname,
    '~': new URL('./', rootUrl).pathname,
  },
};

export const mobileVitestBase = {
  environment: 'node',
  globals: true,
  slowTestThreshold: 250,
};
