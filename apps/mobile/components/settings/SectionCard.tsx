import React from 'react';
import { View } from 'react-native';

import { useSharedCardStyles } from '../theme/styles';

interface SectionCardProps {
  children: React.ReactNode;
}

export function SectionCard({ children }: SectionCardProps) {
  const cardStyles = useSharedCardStyles();
  return <View style={cardStyles.base}>{children}</View>;
}
