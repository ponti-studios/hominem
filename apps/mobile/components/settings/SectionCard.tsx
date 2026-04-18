import React from 'react';
import { View } from 'react-native';

import { sharedCardStyles } from '../../app/(protected)/(tabs)/settings/styles';

interface SectionCardProps {
  children: React.ReactNode;
}

export function SectionCard({ children }: SectionCardProps) {
  return <View style={sharedCardStyles.base}>{children}</View>;
}
