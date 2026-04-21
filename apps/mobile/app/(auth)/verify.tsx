import { maskEmail } from '@hakumi/auth/shared/mask-email';
import { AUTH_COPY, CHAT_AUTH_CONFIG } from '@hakumi/auth/shared/ux-contract';
import type { RelativePathString } from 'expo-router';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getAuthScreenBaseStyles } from '../../components/auth/auth-screen-styles';
import { AuthLayout } from '../../components/AuthLayout';
import { FeatureErrorBoundary } from '../../components/error-boundary/FeatureErrorBoundary';
import { Box, makeStyles, Text } from '../../components/theme';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../services/auth/auth-provider';
import { useEmailAuth } from '../../services/auth/hooks/use-email-auth';
import { normalizeOtp } from '../../services/auth/validation';
import { posthog } from '../../services/posthog';

export function VerifyScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { isSignedIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const { email: emailParam } = useLocalSearchParams<{ email: string }>();
  const resolvedEmail = emailParam ?? '';

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

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  if (!resolvedEmail) {
    return null;
  }

  const normalizedOtp = normalizeOtp(otp);

  return (
    <AuthLayout
      testID="auth-verify-screen"
      title={AUTH_COPY.otpVerification.title}
      helper={AUTH_COPY.otpVerification.helper(maskEmail(resolvedEmail))}
    >
      <Box style={styles.form}>
        <View style={styles.fieldStack}>
          <TextField
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
            onChangeText={(text) => {
              setOtp(text);
            }}
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
          onPress={() => {
            posthog.capture('auth_verify_pressed');
            void handleVerifyOtp(resolvedEmail, normalizedOtp);
          }}
          disabled={isSubmitting || normalizedOtp.length !== 6}
          isLoading={isSubmitting}
          testID="auth-verify-otp"
          title={AUTH_COPY.otpVerification.verifyButton}
          style={styles.primaryButton}
        />

        <View style={styles.actionRow}>
          <Button
            onPress={() => {
              posthog.capture('auth_resend_pressed');
              void handleResendOtp(resolvedEmail);
            }}
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
    </AuthLayout>
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
