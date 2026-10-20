import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';

import { AuthMascot } from '~/components/auth/AuthMascot';
import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import { TextField } from '~/components/ui/text-field';
import { CHAT_AUTH_CONFIG } from '~/config/auth';
import { useAuth } from '~/services/auth/auth-provider';
import { useEmailAuth } from '~/services/auth/use-email-auth';
import { normalizeOtp } from '~/services/auth/validation';
import { posthog } from '~/services/posthog';
import t from '~/translations';

import { authSharedStyles } from './_shared-styles';

function resolveAutoSubmitInput({
  resolvedEmail,
  token,
}: {
  resolvedEmail: string;
  token?: string;
}) {
  const normalizedToken = normalizeOtp(token ?? '');
  if (!resolvedEmail || normalizedToken.length !== 6) {
    return null;
  }
  return { normalizedToken, submitKey: `${resolvedEmail}:${normalizedToken}` };
}

function VerifyScreen() {
  const router = useRouter();
  const { isSignedIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const { email: emailParam, token: tokenParam } = useLocalSearchParams<{
    email: string;
    token?: string;
  }>();
  const resolvedEmail = emailParam ?? '';
  const autoSubmitKeyRef = React.useRef<string | null>(null);
  const [verifySucceeded, setVerifySucceeded] = React.useState(false);
  const { otp, setOtp, error, isSubmitting, isResending, handleVerifyOtp, handleResendOtp } =
    useEmailAuth({
      verifyOtp: async (email, code) => {
        await verifyEmailOtp({ email, otp: normalizeOtp(code) });
        setVerifySucceeded(true);
      },
      resendOtp: async (email) => requestEmailOtp(email),
    });
  const normalizedOtp = normalizeOtp(otp);
  const { foreground, destructive, border: inputBorder } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    ...authSharedStyles(theme),
    brand: { alignItems: 'flex-start' },
    brandName: { ...theme.textVariants.title2, color: theme.colors.foreground, fontWeight: '600' },
    mascot: { alignSelf: 'center', marginBottom: 4 },
    back: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    backText: { ...theme.textVariants.title2, color: theme.colors.foreground },
    error: { ...theme.textVariants.footnote, color: theme.colors.destructive, textAlign: 'center' },
    link: {
      ...theme.textVariants.footnote,
      color: theme.colors.mutedForeground,
      textAlign: 'center',
      padding: 8,
    },
    codeInput: {
      borderBottomWidth: 1,
      borderBottomColor: inputBorder,
      borderRadius: 0,
      paddingHorizontal: 0,
      textAlign: 'left',
    },
    successContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
  }));

  React.useEffect(() => {
    const autoSubmitInput = resolveAutoSubmitInput({ resolvedEmail, token: tokenParam });
    if (!autoSubmitInput || autoSubmitKeyRef.current === autoSubmitInput.submitKey) {
      return;
    }
    autoSubmitKeyRef.current = autoSubmitInput.submitKey;
    posthog.capture('auth_verify_link_opened');
    setOtp(autoSubmitInput.normalizedToken);
    void handleVerifyOtp(resolvedEmail, autoSubmitInput.normalizedToken);
  }, [handleVerifyOtp, resolvedEmail, setOtp, tokenParam]);

  React.useEffect(() => {
    if (!verifySucceeded) {
      return;
    }
    const id = setTimeout(() => router.replace(CHAT_AUTH_CONFIG.defaultPostAuthDestination), 900);
    return () => clearTimeout(id);
  }, [router, verifySucceeded]);

  if (isSignedIn && !verifySucceeded) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination} />;
  }
  if (!resolvedEmail) {
    return <Redirect href="/(auth)" />;
  }

  if (verifySucceeded) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.title}>{t.auth.verify.signedIn}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView
        testID="auth-verify-screen"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.form}>
            <View style={styles.brand}>
              <Text testID="auth-brand" style={styles.brandName}>
                omiro
              </Text>
            </View>
            <Pressable
              testID="auth-change-email"
              accessibilityRole="button"
              accessibilityLabel="Change email"
              onPress={() => {
                posthog.capture('auth_change_email_pressed');
                router.replace('/(auth)');
              }}
              disabled={isSubmitting}
              style={styles.back}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <View style={styles.mascot}>
              <AuthMascot />
            </View>
            <TextField
              testID="auth-otp-input-container"
              value={otp}
              placeholder={t.auth.verify.codePlaceholder}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={6}
              editable={!isSubmitting && !isResending}
              hasError={Boolean(error)}
              cursorColor={foreground}
              selectionColor={foreground}
              focusBorder={false}
              style={styles.codeInput}
              accessibilityLabel={t.auth.verify.oneTimeVerificationCodeA11y}
              onChangeText={(value) => setOtp(normalizeOtp(value))}
              onSubmitEditing={() => {
                if (normalizedOtp.length === 6) {
                  posthog.capture('auth_verify_pressed');
                  void handleVerifyOtp(resolvedEmail, normalizedOtp);
                }
              }}
            />
            {error ? (
              <Text
                testID="auth-otp-message"
                accessibilityLiveRegion="polite"
                style={[styles.error, { color: destructive }]}
              >
                {error}
              </Text>
            ) : null}
            <Button
              testID="auth-verify-otp"
              label={isSubmitting ? 'Checking…' : 'Sign in'}
              onPress={() => {
                posthog.capture('auth_verify_pressed');
                void handleVerifyOtp(resolvedEmail, normalizedOtp);
              }}
              disabled={isSubmitting || isResending || normalizedOtp.length !== 6}
              loading={isSubmitting}
              variant="ink"
              style={{ borderRadius: 4 }}
            />
            <Pressable
              testID="auth-resend-otp"
              accessibilityRole="button"
              accessibilityState={{ disabled: isResending || isSubmitting, busy: isResending }}
              onPress={() => {
                posthog.capture('auth_resend_code_pressed');
                void handleResendOtp(resolvedEmail);
              }}
              disabled={isResending || isSubmitting}
            >
              <Text style={styles.link}>{isResending ? 'Sending…' : 'Resend'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const VerifyWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="AuthVerify">
    <VerifyScreen />
  </FeatureErrorBoundary>
);

export default VerifyWithErrorBoundary;
