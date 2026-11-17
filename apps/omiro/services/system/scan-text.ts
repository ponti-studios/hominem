import * as ImagePicker from 'expo-image-picker';

import OmiroSystem from '~/modules/omiro-system';

// Puts recognized text after whatever is already typed, on its own paragraph.
export function appendScannedText(current: string, scanned: string): string {
  const text = scanned.trim();
  if (!text) {
    return current;
  }
  const existing = current.trimEnd();
  return existing ? `${existing}\n\n${text}` : text;
}

// Lets the person pick a photo and reads the text in it, on-device. Null when
// they cancel; an empty string when the photo has no readable text.
export async function scanTextFromLibrary(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? OmiroSystem.recognizeText(asset.uri) : null;
}
