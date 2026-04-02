import type { RelativePathString } from 'expo-router';
import { Redirect } from 'expo-router';
import React from 'react';

export default function StartScreen() {
  return <Redirect href={'/(protected)/(tabs)/notes' as RelativePathString} />;
}
