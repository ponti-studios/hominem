import React from 'react';

import { Text } from '~/components/theme';

import { styles } from '../theme/styles';

interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
