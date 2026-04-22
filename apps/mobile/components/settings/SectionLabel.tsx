import React from 'react';

import { Text } from '~/components/theme';

import { useSharedStyles } from '../theme/styles';

interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  const styles = useSharedStyles();
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
