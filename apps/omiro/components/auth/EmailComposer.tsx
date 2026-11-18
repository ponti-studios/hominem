import { forwardRef, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fontFamilies, useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { Glass } from '~/components/ui/glass';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useShakeAnimation } from '~/services/motion/use-shake-animation';
import t from '~/translations';

const BAR_HEIGHT = 68;
const SEND_SIZE = 52;

interface EmailComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onBlur?: () => void;
  // True once the address looks valid: the send circle turns violet.
  isReady: boolean;
  isSubmitting: boolean;
  hasError: boolean;
}

// The email field is the capture bar's glass pill with its violet send circle, so the first thing you
// touch on the login screen already looks like the app.
export const EmailComposer = forwardRef<TextInputInstance, EmailComposerProps>(
  function EmailComposer(
    { value, onChangeText, onSubmit, onBlur, isReady, isSubmitting, hasError },
    ref,
  ) {
    const { colors } = useAppTheme();
    const reducedMotion = useReducedMotion();
    const [focused, setFocused] = useState(false);
    const shakeStyle = useShakeAnimation(hasError);
    const pulse = useSharedValue(1);
    const styles = useStyles((theme) => ({
      bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: BAR_HEIGHT,
        paddingStart: 24,
        paddingEnd: 8,
      },
      input: {
        flex: 1,
        padding: 0,
        fontFamily: fontFamilies.sans,
        fontSize: 18,
        color: theme.colors.barForeground,
        textAlign: 'left',
      },
      send: {
        width: SEND_SIZE,
        height: SEND_SIZE,
        borderRadius: SEND_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
      },
    }));

    useEffect(() => {
      if (isReady && !reducedMotion) {
        pulse.set(withSequence(withTiming(1.16, { duration: 140 }), withSpring(1, { damping: 8 })));
      }
    }, [isReady, pulse, reducedMotion]);

    const ring = hasError ? colors.destructive : colors.primary;
    const ringStyle =
      focused || hasError ? { borderRadius: BAR_HEIGHT / 2, boxShadow: `0 0 0 2px ${ring}` } : null;
    const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

    return (
      <Animated.View style={[ringStyle, shakeStyle]}>
        <Glass style={styles.bar}>
          <TextInput
            ref={ref}
            testID="auth-email-input"
            accessibilityLabel={t.auth.emailEntry.emailLabel}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            cursorColor={colors.primary}
            editable={!isSubmitting}
            keyboardType="email-address"
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onSubmitEditing={onSubmit}
            placeholder={t.auth.emailEntry.emailPlaceholder}
            placeholderTextColor={withAlpha(colors.barForeground, 0.5)}
            returnKeyType="send"
            selectionColor={withAlpha(colors.primary, 0.3)}
            style={styles.input}
            textContentType="emailAddress"
            value={value}
          />
          <Animated.View style={pulseStyle}>
            <Pressable
              testID="auth-send-otp"
              accessibilityLabel={t.auth.emailEntry.sendCodeA11y}
              accessibilityRole="button"
              accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={onSubmit}
              style={[
                styles.send,
                { backgroundColor: isReady ? colors.barAccent : colors.barControl },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.barAccentForeground} />
              ) : (
                <View>
                  <AppIcon name="arrow.up" size={22} tintColor={colors.barAccentForeground} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </Glass>
      </Animated.View>
    );
  },
);
