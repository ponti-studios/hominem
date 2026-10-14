import { maskEmail } from '@ponti-studios/auth/shared/mask-email';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';

import { AuthArtwork } from '~/components/auth/AuthArtwork';
import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
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
  const { otp, setOtp, error, isSubmitting, handleVerifyOtp } = useEmailAuth({
    verifyOtp: async (email, code) => {
      await verifyEmailOtp({ email, otp: normalizeOtp(code) });
      setVerifySucceeded(true);
    },
    resendOtp: async (email) => requestEmailOtp(email),
  });
  const normalizedOtp = normalizeOtp(otp);
  const { foreground, mutedForeground, destructive, primaryForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    ...authSharedStyles(theme),
    brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    brandMark: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadii.lg,
      backgroundColor: theme.colors.primary,
    },
    brandName: { ...theme.textVariants.title2, color: theme.colors.foreground, fontWeight: '700' },
    subtitle: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    emailText: { ...theme.textVariants.subhead, color: theme.colors.foreground, fontWeight: '600' },
    error: { ...theme.textVariants.footnote, color: theme.colors.destructive, textAlign: 'center' },
    link: {
      ...theme.textVariants.footnote,
      color: theme.colors.primary,
      textAlign: 'center',
      padding: 8,
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
              <View style={styles.brandMark}>
                <AppIcon
                  name="bubble.left.and.bubble.right.fill"
                  size={18}
                  tintColor={primaryForeground}
                />
              </View>
              <Text style={styles.brandName}>Omiro</Text>
            </View>
            <AuthArtwork compact />
            <View style={styles.header}>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>A code is on its way to</Text>
              <Pressable
                testID="auth-change-email"
                onPress={() => {
                  posthog.capture('auth_change_email_pressed');
                  router.replace('/(auth)');
                }}
              >
                <Text style={styles.emailText}>{maskEmail(resolvedEmail)}</Text>
              </Pressable>
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
              editable={!isSubmitting}
              hasError={Boolean(error)}
              cursorColor={foreground}
              selectionColor={foreground}
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
              disabled={isSubmitting || normalizedOtp.length !== 6}
              loading={isSubmitting}
              variant="primary"
            />
            <Pressable
              testID="auth-use-different-email"
              onPress={() => {
                posthog.capture('auth_change_email_pressed');
                router.replace('/(auth)');
              }}
              disabled={isSubmitting}
            >
              <Text style={[styles.link, { color: mutedForeground }]}>Use a different email</Text>
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
