import * as React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { makeStyles } from '~/components/theme';
import { fontFamiliesNative, fontSizes, fontWeights, spacing } from '~/components/theme/tokens';

import type { FieldBaseProps } from './field.types';

interface NativeFieldChildProps {
  accessibilityHint?: string | undefined;
  accessibilityLabel?: string | undefined;
  accessibilityLabelledBy?: string | string[] | undefined;
  nativeID?: string | undefined;
}

interface FieldProps extends FieldBaseProps {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  messageStyle?: StyleProp<TextStyle>;
}

function normalizeNativeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

const useFieldStyles = makeStyles((theme) => ({
  label: {
    color: theme.colors['text-secondary'],
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: Math.round(fontSizes.xs * 1.4),
    marginBottom: spacing[2],
  },
  required: {
    color: theme.colors.destructive,
  },
  helpText: {
    color: theme.colors['text-tertiary'],
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: Math.round(fontSizes.xs * 1.4),
    marginTop: spacing[1],
  },
  errorText: {
    color: theme.colors.destructive,
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: Math.round(fontSizes.xs * 1.4),
    marginTop: spacing[1],
  },
}));

function Field({
  children,
  className: _className,
  containerStyle,
  error,
  helpText,
  id: externalId,
  label,
  labelStyle,
  messageStyle,
  required,
}: FieldProps) {
  const styles = useFieldStyles();
  const generatedId = React.useId();
  const id = normalizeNativeId(externalId ?? generatedId);
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const message = error ?? helpText;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text nativeID={labelId} style={[styles.label, labelStyle]}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      {React.isValidElement<NativeFieldChildProps>(children)
        ? React.cloneElement(children, {
            accessibilityHint: message,
            accessibilityLabel: label,
            accessibilityLabelledBy: label ? labelId : undefined,
            nativeID: id,
          })
        : children}
      {message ? (
        <Text
          nativeID={messageId}
          testID={messageId}
          style={[error ? styles.errorText : styles.helpText, messageStyle]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export { Field };
export type { FieldProps };
