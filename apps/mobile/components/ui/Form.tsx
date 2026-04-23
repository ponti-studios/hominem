import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { makeStyles, Text } from '~/components/theme';

export function Form({ style, ...props }: ViewProps) {
  const styles = useStyles();
  return <View style={[styles.form, style]} {...props} />;
}

export function FieldStack({ style, ...props }: ViewProps) {
  const styles = useStyles();
  return <View style={[styles.fieldStack, style]} {...props} />;
}

export function FieldError({ children, ...props }: React.ComponentProps<typeof Text>) {
  const styles = useStyles();
  return (
    <Text style={styles.errorText} {...props}>
      {children}
    </Text>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    form: {
      width: '100%',
      rowGap: t.spacing.m_16,
    },
    fieldStack: {
      rowGap: t.spacing.xs_4,
    },
    errorText: {
      color: t.colors.destructive,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
  }),
);
