import { Redirect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';

import { AuthMascot } from '~/components/auth/AuthMascot';
import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import { TextField } from '~/components/ui/text-field';
import { CHAT_AUTH_CONFIG } from '~/config/auth';
import { useAuth } from '~/services/auth/auth-provider';
import { isValidEmail, normalizeEmail } from '~/services/auth/validation';
import { posthog } from '~/services/posthog';
import t from '~/translations';

import { authSharedStyles } from './_shared-styles';

function AuthScreen() {
  const { isPending, isSignedIn, requestEmailOtp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const normalizedEmail = normalizeEmail(email);

  const { foreground: textPrimary, border: inputBorder } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    ...authSharedStyles(theme),
    restoringMessage: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
    inputContainer: { gap: 28 },
    errorText: { ...theme.textVariants.footnote, color: theme.colors.destructive },
    brand: { alignItems: 'flex-start' },
    brandName: { ...theme.textVariants.title2, color: theme.colors.foreground, fontWeight: '600' },
    mascot: { alignSelf: 'center', marginBottom: 4 },
  }));

  const handleSendCode = useCallback(async () => {
    posthog.capture('auth_send_code_pressed');
    if (!normalizedEmail) {
      setAuthError(t.auth.emailEntry.emailRequiredError);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      posthog.capture('auth_email_invalid');
      setAuthError(t.auth.emailEntry.emailInvalidError);
      return;
    }

    try {
      setIsSubmitting(true);
      await requestEmailOtp(normalizedEmail);
      router.replace(
        `/(auth)/verify?email=${encodeURIComponent(normalizedEmail)}&sentAt=${Date.now()}`,
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t.auth.emailEntry.sendFailedError);
    } finally {
      setIsSubmitting(false);
    }
  }, [normalizedEmail, requestEmailOtp, router]);

  const isProbing = isPending && !authError;
  const displayError = authError;

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination} />;
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <ScrollView
          testID="auth-screen"
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

              <View style={styles.mascot}>
                <AuthMascot />
              </View>

              {isProbing ? (
                <View style={styles.header}>
                  <Text style={styles.restoringMessage}>{t.auth.restoringSignIn}</Text>
                </View>
              ) : null}

              {!isProbing ? (
                <View style={styles.inputContainer}>
                  <TextField
                    testID="auth-email-input"
                    value={email}
                    placeholder={t.auth.emailEntry.emailPlaceholder}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!isSubmitting}
                    hasError={Boolean(displayError)}
                    cursorColor={textPrimary}
                    selectionColor={textPrimary}
                    focusBorder={false}
                    style={{
                      opacity: isSubmitting ? 0.6 : 1,
                      borderBottomWidth: 1,
                      borderBottomColor: inputBorder,
                      borderRadius: 0,
                      paddingHorizontal: 0,
                    }}
                    onChangeText={(text) => {
                      setEmail(text);
                      setAuthError(null);
                    }}
                    onBlur={() => {
                      if (email.trim()) {
                        posthog.capture('auth_email_entered', {
                          valid: isValidEmail(normalizeEmail(email)),
                        });
                      }
                    }}
                    accessibilityLabel={t.auth.emailEntry.emailLabel}
                  />

                  {displayError ? (
                    <Text
                      testID="auth-email-message"
                      accessibilityLiveRegion="polite"
                      style={styles.errorText}
                    >
                      {displayError}
                    </Text>
                  ) : null}

                  <Button
                    testID="auth-send-otp"
                    label={isSubmitting ? 'Sending…' : 'Send a code'}
                    onPress={() => handleSendCode()}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    variant="ink"
                    style={{ borderRadius: 4 }}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const AuthWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="Auth">
    <AuthScreen />
  </FeatureErrorBoundary>
);

export default AuthWithErrorBoundary;
