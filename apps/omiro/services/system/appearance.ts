import { Appearance } from 'react-native';

import { storage } from '~/services/storage/mmkv';

export type AppearancePreference = 'system' | 'light' | 'dark';

const APPEARANCE_KEY = 'appearance_preference';

export function getAppearance(): AppearancePreference {
  const stored = storage.getString(APPEARANCE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

// Overrides the system appearance for the whole app, system glass included.
export function applyAppearance(preference: AppearancePreference = getAppearance()) {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

export function setAppearance(preference: AppearancePreference) {
  storage.set(APPEARANCE_KEY, preference);
  applyAppearance(preference);
}
