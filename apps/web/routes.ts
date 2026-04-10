import type { RelativePathString } from 'expo-router';

export const routes = {
  feed: '/(protected)/(tabs)/' as RelativePathString,
  notes: '/(protected)/(tabs)/notes' as RelativePathString,
  settings: '/(protected)/(tabs)/settings' as RelativePathString,
} as const;
