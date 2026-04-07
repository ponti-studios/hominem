import { AUTH_COPY, CHAT_AUTH_CONFIG, maskEmail } from '@hominem/auth';
import type { RelativePathString } from 'expo-router';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '~/components/auth-shell';
import { Button } from '~/components/Button';
import { FeatureErrorBoundary } from '~/components/error-boundary';
import TextInput from '~/components/text-input';
import { posthog } from '~/lib/posthog';
import { Box, makeStyles, Text } from '~/theme';
import { useAuth } from '~/utils/auth-provider';
import { isValidOtp, normalizeOtp } from '~/utils/auth/validation';

import { getAuthScreenBaseStyles } from './auth-screen-styles';

export function VerifyScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { isSignedIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const resolvedEmail = email ?? '';
  const normalizedOtp = useMemo(() => normalizeOtp(otp), [otp]);

  React.useEffect(() => {
    posthog.capture('auth_verify_screen_viewed');
  }, []);

  const handleVerify = useCallback(async () => {
    posthog.capture('auth_verify_pressed');
    if (!resolvedEmail) {
      setAuthError(AUTH_COPY.emailEntry.emailRequiredError);
      return;
    }

    if (!normalizedOtp) {
      setAuthError(AUTH_COPY.otpVerification.codeRequiredError);
      return;
    }
    if (!isValidOtp(normalizedOtp)) {
      setAuthError(AUTH_COPY.otpVerification.codeLengthError);
      return;
    }

    try {
      setIsSubmitting(true);
      await verifyEmailOtp({
        email: resolvedEmail,
        otp: normalizedOtp,
      });
      setAuthError(null);
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error ? error.message : AUTH_COPY.otpVerification.verifyFailedError,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [normalizedOtp, resolvedEmail, verifyEmailOtp]);

  const handleOtpChange = useCallback((text: string) => {
    const next = normalizeOtp(text);
    setOtp(next);
    setAuthError(null);
  }, []);

  const handleResend = useCallback(async () => {
    posthog.capture('auth_resend_pressed');
    if (!resolvedEmail) {
      setAuthError(AUTH_COPY.emailEntry.emailRequiredError);
      return;
    }

    try {
      setIsResending(true);
      setAuthError(null);
      await requestEmailOtp(resolvedEmail);
      setOtp('');
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error ? error.message : AUTH_COPY.otpVerification.resendFailedError,
      );
    } finally {
      setIsResending(false);
    }
  }, [requestEmailOtp, resolvedEmail]);

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  if (!resolvedEmail) {
    return null;
  }

  return (
    <AuthShell
      testID="auth-verify-screen"
      title={AUTH_COPY.otpVerification.title}
      helper={AUTH_COPY.otpVerification.helper(maskEmail(resolvedEmail))}
    >
      <Box style={styles.form}>
        <View style={styles.fieldStack}>
          <TextInput
            testID="auth-otp-input"
            id="auth-otp"
            label={AUTH_COPY.otpVerification.codeLabel}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoCapitalize="none"
            autoCorrect={false}
            value={normalizedOtp}
            editable={!isSubmitting && !isResending}
            maxLength={6}
            onChangeText={handleOtpChange}
            placeholder={AUTH_COPY.otpVerification.codePlaceholder}
            style={styles.otpInput}
          />
          {authError ? (
            <Text testID="auth-otp-message" style={styles.errorText}>
              {authError}
            </Text>
          ) : null}
        </View>

        <Button
          onPress={handleVerify}
          disabled={isSubmitting || normalizedOtp.length !== 6}
          isLoading={isSubmitting}
          testID="auth-verify-otp"
          title={AUTH_COPY.otpVerification.verifyButton}
          style={styles.primaryButton}
        />

        <View style={styles.actionRow}>
          <Button
            onPress={handleResend}
            disabled={isSubmitting || isResending}
            isLoading={isResending}
            variant="link"
            size="xs"
            testID="auth-resend-otp"
            title={AUTH_COPY.otpVerification.resendButton}
            style={styles.linkButton}
            textStyle={styles.linkText}
          />

          <Button
            onPress={() => {
              posthog.capture('auth_change_email_pressed');
              router.replace('/(auth)' as RelativePathString);
            }}
            disabled={isSubmitting || isResending}
            variant="link"
            size="xs"
            title={AUTH_COPY.otpVerification.changeEmailLink}
            style={styles.linkButton}
            textStyle={styles.linkText}
          />
        </View>
      </Box>
    </AuthShell>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    ...getAuthScreenBaseStyles(t),
    otpInput: {
      letterSpacing: 3,
      textAlign: 'center',
    },
    primaryButton: {
      width: '100%',
    },
    actionRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: t.spacing.sm_12,
    },
    linkButton: {
      flexShrink: 1,
    },
    linkText: {
      color: t.colors['text-tertiary'],
      fontSize: 12,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  }),
);

const VerifyWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="AuthVerify">
    <VerifyScreen />
  </FeatureErrorBoundary>
);

export default VerifyWithErrorBoundary;
