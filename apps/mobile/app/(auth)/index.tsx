import {
  Button as SwiftUIButton,
  Form as SwiftUIForm,
  Host as SwiftUIHost,
  ProgressView,
  Section as SwiftUISection,
  Text as SwiftUIText,
  TextField as SwiftUITextField,
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
import { AUTH_COPY, CHAT_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';
import type { RelativePathString } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { E2E_TESTING, MOBILE_PASSKEY_ENABLED } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';
import { resolveAuthScreenState } from '~/services/auth/auth-screen-state';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';
import { isValidEmail, normalizeEmail } from '~/services/auth/validation';
import { posthog } from '~/services/posthog';

function AuthScreen() {
  const { authStatus, isSignedIn, completePasskeySignIn, requestEmailOtp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    signIn: signInWithPasskey,
    isLoading: isPasskeyLoading,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = useMobilePasskeyAuth({ loadPasskeys: false });

  useEffect(() => {
    posthog.capture('auth_screen_viewed');
  }, []);

  const handleSendCode = useCallback(async () => {
    posthog.capture('auth_send_code_pressed');
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setAuthError(AUTH_COPY.emailEntry.emailRequiredError);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      posthog.capture('auth_email_invalid');
      setAuthError(AUTH_COPY.emailEntry.emailInvalidError);
      return;
    }

    try {
      setIsSubmitting(true);
      await requestEmailOtp(normalizedEmail);
      router.replace(
        `/(auth)/verify?email=${encodeURIComponent(normalizedEmail)}` as RelativePathString,
      );
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : AUTH_COPY.emailEntry.sendFailedError);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, requestEmailOtp, router]);

  const handlePasskeySignIn = useCallback(async () => {
    posthog.capture('auth_passkey_pressed');
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const result = await signInWithPasskey();
      if (result) {
        await completePasskeySignIn(result);
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : AUTH_COPY.passkey.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }, [completePasskeySignIn, signInWithPasskey]);

  const handleE2EPasskey = useCallback(
    async (mode: 'e2e-success' | 'e2e-cancel') => {
      try {
        setIsSubmitting(true);
        setAuthError(null);
        const result = await signInWithPasskey(mode);
        if (result) {
          await completePasskeySignIn(result);
        }
      } catch (error: unknown) {
        setAuthError(error instanceof Error ? error.message : AUTH_COPY.passkey.genericError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [completePasskeySignIn, signInWithPasskey],
  );

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  const { isProbing, displayError } = resolveAuthScreenState({
    authStatus,
    authError,
    passkeyError,
  });
  const canUsePasskeys = MOBILE_PASSKEY_ENABLED && isPasskeySupported;

  return (
    <>
      <SwiftUIHost style={styles.host} testID="auth-screen" useViewportSizeMeasurement>
        <SwiftUIForm modifiers={[listStyle('insetGrouped')]}>
          <SwiftUISection>
            <VStack spacing={8} modifiers={[padding({ vertical: 8 })]}>
              <SwiftUIText modifiers={[font({ size: 28, weight: 'bold' })]}>
                {AUTH_COPY.emailEntry.title}
              </SwiftUIText>
              <SwiftUIText
                modifiers={[
                  font({ size: 16 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {isProbing ? 'Resuming session...' : AUTH_COPY.emailEntry.helper}
              </SwiftUIText>
            </VStack>
          </SwiftUISection>

          {!isProbing ? (
            <SwiftUISection>
              <SwiftUITextField
                testID="auth-email-input"
                placeholder={AUTH_COPY.emailEntry.emailPlaceholder}
                onValueChange={(text) => {
                  setEmail(text);
                  setAuthError(null);
                }}
                onFocusChange={(focused) => {
                  if (!focused && email.trim()) {
                    posthog.capture('auth_email_entered', {
                      valid: isValidEmail(normalizeEmail(email)),
                    });
                  }
                }}
                modifiers={[
                  textFieldStyle('roundedBorder'),
                  keyboardType('email-address'),
                  textContentType('emailAddress'),
                  textInputAutocapitalization('never'),
                  autocorrectionDisabled(true),
                  submitLabel('continue'),
                  disabledModifier(isSubmitting),
                ]}
              />

              {displayError ? (
                <SwiftUIText
                  testID="auth-email-message"
                  modifiers={[font({ size: 13 }), foregroundStyle({ type: 'color', color: 'red' })]}
                >
                  {displayError}
                </SwiftUIText>
              ) : null}

              <SwiftUIButton
                testID="auth-send-otp"
                label={
                  isSubmitting
                    ? AUTH_COPY.emailEntry.submitButton
                    : AUTH_COPY.emailEntry.submitButton
                }
                onPress={() => void handleSendCode()}
                modifiers={[
                  buttonStyle('borderedProminent'),
                  controlSize('large'),
                  disabledModifier(isSubmitting),
                  frame({ maxWidth: Number.POSITIVE_INFINITY }),
                ]}
              />
              {isSubmitting ? <ProgressView /> : null}

              {canUsePasskeys ? (
                <SwiftUIButton
                  testID="auth-passkey-button"
                  label={
                    isPasskeyLoading
                      ? AUTH_COPY.emailEntry.passkeyLoadingButton
                      : AUTH_COPY.emailEntry.passkeyButton
                  }
                  onPress={() => void handlePasskeySignIn()}
                  modifiers={[
                    buttonStyle('plain'),
                    controlSize('small'),
                    disabledModifier(isSubmitting || isPasskeyLoading),
                  ]}
                />
              ) : null}
            </SwiftUISection>
          ) : null}
        </SwiftUIForm>
      </SwiftUIHost>

      {E2E_TESTING && MOBILE_PASSKEY_ENABLED ? (
        <Pressable
          onPress={() => void handleE2EPasskey('e2e-success')}
          style={styles.e2ePasskeyAction}
          testID="auth-e2e-passkey-success"
        />
      ) : null}

      {E2E_TESTING && MOBILE_PASSKEY_ENABLED ? (
        <Pressable
          onPress={() => void handleE2EPasskey('e2e-cancel')}
          style={styles.e2ePasskeyActionAlt}
          testID="auth-e2e-passkey-cancel"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  e2ePasskeyAction: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    opacity: 0.02,
  },
  e2ePasskeyActionAlt: {
    position: 'absolute',
    top: 24,
    right: 4,
    width: 16,
    height: 16,
    opacity: 0.02,
  },
});

const AuthWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="Auth">
    <AuthScreen />
  </FeatureErrorBoundary>
);

export default AuthWithErrorBoundary;
