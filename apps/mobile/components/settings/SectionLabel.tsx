import React from 'react';

import { Text, theme } from '~/components/theme';

import { styles } from '../styles';

interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
