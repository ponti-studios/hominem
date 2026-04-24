import {
  Button as SwiftUIButton,
  Form as SwiftUIForm,
  Host as SwiftUIHost,
  ProgressView,
  Section as SwiftUISection,
  Text as SwiftUIText,
  TextField as SwiftUITextField,
  type TextFieldRef,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  listStyle,
  padding,
  submitLabel,
  textContentType,
  textFieldStyle,
  textInputAutocapitalization,
  autocorrectionDisabled,
} from '@expo/ui/swift-ui/modifiers';
import { maskEmail } from '@hominem/auth/shared/mask-email';
import { AUTH_COPY, CHAT_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';
import type { RelativePathString } from 'expo-router';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { FeatureErrorBoundary } from '../../components/error-boundary/FeatureErrorBoundary';
import { useAuth } from '../../services/auth/auth-provider';
import { useEmailAuth } from '../../services/auth/hooks/use-email-auth';
import { normalizeOtp } from '../../services/auth/validation';
import { posthog } from '../../services/posthog';

function VerifyScreen() {
  const router = useRouter();
  const otpInputRef = React.useRef<TextFieldRef>(null);
  const { isSignedIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const { email: emailParam, token: tokenParam } = useLocalSearchParams<{
    email: string;
    token?: string;
  }>();
  const resolvedEmail = emailParam ?? '';
  const autoSubmitKeyRef = React.useRef<string | null>(null);

  const {
    otp,
    setOtp,
    error: authError,
    isSubmitting,
    isResending,
    handleVerifyOtp,
    handleResendOtp,
  } = useEmailAuth({
    sendOtp: async () => {},
    verifyOtp: async (email, code) => {
      await verifyEmailOtp({ email, otp: normalizeOtp(code) });
    },
    resendOtp: async (email) => {
      await requestEmailOtp(email);
    },
  });

  React.useEffect(() => {
    posthog.capture('auth_verify_screen_viewed');
  }, []);

  React.useEffect(() => {
    const normalizedToken = normalizeOtp(tokenParam ?? '');
    const submitKey = `${resolvedEmail}:${normalizedToken}`;
    if (autoSubmitKeyRef.current === submitKey || !resolvedEmail || normalizedToken.length !== 6) {
      return;
    }

    autoSubmitKeyRef.current = submitKey;
    setOtp(normalizedToken);
    void otpInputRef.current?.setText(normalizedToken);
    posthog.capture('auth_verify_link_opened');
    void handleVerifyOtp(resolvedEmail, normalizedToken);
  }, [handleVerifyOtp, resolvedEmail, setOtp, tokenParam]);

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  if (!resolvedEmail) {
    return null;
  }

  const normalizedOtp = normalizeOtp(otp).slice(0, 6);
  const isBusy = isSubmitting || isResending;

  return (
    <SwiftUIHost style={styles.host} testID="auth-verify-screen" useViewportSizeMeasurement>
      <SwiftUIForm modifiers={[listStyle('insetGrouped')]}>
        <SwiftUISection>
          <VStack spacing={8} modifiers={[padding({ vertical: 8 })]}>
            <SwiftUIText modifiers={[font({ size: 28, weight: 'bold' })]}>
              {AUTH_COPY.otpVerification.title}
            </SwiftUIText>
            <SwiftUIText
              modifiers={[
                font({ size: 16 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {AUTH_COPY.otpVerification.helper(maskEmail(resolvedEmail))}
            </SwiftUIText>
          </VStack>
        </SwiftUISection>

        <SwiftUISection>
          <SwiftUITextField
            ref={otpInputRef}
            testID="auth-otp-input"
            defaultValue={normalizedOtp}
            placeholder={AUTH_COPY.otpVerification.codePlaceholder}
            onValueChange={(value) => {
              const nextOtp = normalizeOtp(value).slice(0, 6);
              setOtp(nextOtp);
              if (nextOtp !== value) {
                void otpInputRef.current?.setText(nextOtp);
              }
            }}
            modifiers={[
              textFieldStyle('roundedBorder'),
              keyboardType('numeric'),
              textContentType('oneTimeCode'),
              textInputAutocapitalization('never'),
              autocorrectionDisabled(true),
              submitLabel('done'),
              disabledModifier(isBusy),
            ]}
          />

          {authError ? (
            <SwiftUIText
              testID="auth-otp-message"
              modifiers={[font({ size: 13 }), foregroundStyle({ type: 'color', color: 'red' })]}
            >
              {authError}
            </SwiftUIText>
          ) : null}

          <SwiftUIButton
            testID="auth-verify-otp"
            label={AUTH_COPY.otpVerification.verifyButton}
            onPress={() => {
              posthog.capture('auth_verify_pressed');
              void handleVerifyOtp(resolvedEmail, normalizedOtp);
            }}
            modifiers={[
              buttonStyle('borderedProminent'),
              controlSize('large'),
              disabledModifier(isSubmitting || normalizedOtp.length !== 6),
              frame({ maxWidth: Number.POSITIVE_INFINITY }),
            ]}
          />
          {isSubmitting ? <ProgressView /> : null}

          <SwiftUIButton
            testID="auth-resend-otp"
            label={
              isResending
                ? AUTH_COPY.otpVerification.resendButton
                : AUTH_COPY.otpVerification.resendButton
            }
            onPress={() => {
              posthog.capture('auth_resend_pressed');
              void handleResendOtp(resolvedEmail);
            }}
            modifiers={[buttonStyle('plain'), controlSize('small'), disabledModifier(isBusy)]}
          />

          <SwiftUIButton
            label={AUTH_COPY.otpVerification.changeEmailLink}
            onPress={() => {
              posthog.capture('auth_change_email_pressed');
              router.replace('/(auth)' as RelativePathString);
            }}
            modifiers={[buttonStyle('plain'), controlSize('small'), disabledModifier(isBusy)]}
          />
        </SwiftUISection>
      </SwiftUIForm>
    </SwiftUIHost>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});

const VerifyWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="AuthVerify">
    <VerifyScreen />
  </FeatureErrorBoundary>
);

export default VerifyWithErrorBoundary;
