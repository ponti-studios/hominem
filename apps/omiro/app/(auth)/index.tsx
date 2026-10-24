import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type TextInputInstance } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthBrand } from '~/components/auth/AuthBrand';
import { BUBBLE_SLOT_HEIGHT, loginBrandTop } from '~/components/auth/brand-layout';
import { CodePebbles, type CodeStatus } from '~/components/auth/CodePebbles';
import { EmailComposer } from '~/components/auth/EmailComposer';
import { RiseIn } from '~/components/auth/RiseIn';
import { SpeechBubble } from '~/components/auth/SpeechBubble';
import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { useStyles } from '~/components/theme';
import { CHAT_AUTH_CONFIG } from '~/config/auth';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { errorHaptic, successHaptic, tapHaptic } from '~/services/auth/auth-haptics';
import { useAuth } from '~/services/auth/auth-provider';
import { useSignInHold } from '~/services/auth/sign-in-hold';
import { useLoginFlow } from '~/services/auth/use-login-flow';
import { useLaunchPhase } from '~/services/launch/launch-phase';
import { posthog } from '~/services/posthog';
import t from '~/translations';

// Tall enough for the code step (sent-to row, pebbles, message, resend). The email step is shorter, and
// both sit in this one box so switching steps never moves the screen.
const STEPS_HEIGHT = 184;
const GREETING_DELAY_MS = 900;
const FORM_REVEAL_DELAY_MS = 400;
const FOCUS_DELAY_MS = 900;

function AuthScreen() {
  const { isSignedIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const isHoldingSignIn = useSignInHold();
  const launchPhase = useLaunchPhase();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { email: linkEmail, token: linkToken } = useLocalSearchParams<{
    email?: string;
    token?: string;
  }>();
  const flow = useLoginFlow({
    requestEmailOtp,
    verifyEmailOtp,
    linkEmail,
    linkToken,
    onLinkOpened: useCallback(() => posthog.capture('auth_verify_link_opened'), []),
  });
  const emailInputRef = useRef<TextInputInstance>(null);
  const isCodeRef = useRef(flow.step === 'code');
  const [nod, setNod] = useState(0);
  const [greeted, setGreeted] = useState(false);
  const stepProgress = useSharedValue(flow.step === 'code' ? 1 : 0);

  // The overlay hands the brand over once it lands; until then the form waits behind it.
  const revealed = launchPhase !== 'splash';
  const isCode = flow.step === 'code';
  const styles = useStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.background },
    form: { width: '100%', maxWidth: 420 },
    steps: { height: STEPS_HEIGHT },
    stepLayer: { position: 'absolute', top: 0, right: 0, left: 0 },
    sentTo: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    sentToRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    chip: {
      flexShrink: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: theme.colors.lime,
    },
    chipText: {
      ...theme.textVariants.footnote,
      color: theme.colors.limeForeground,
      fontWeight: '500',
    },
    link: { ...theme.textVariants.footnote, color: theme.colors.primary, fontWeight: '500' },
    linkMuted: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    linkButton: { minHeight: 32, justifyContent: 'center' },
    message: {
      ...theme.textVariants.footnote,
      minHeight: 20,
      marginTop: 8,
      marginHorizontal: 4,
      color: theme.colors.destructive,
    },
  }));

  useEffect(() => {
    isCodeRef.current = isCode;
  }, [isCode]);

  useEffect(() => {
    posthog.capture('auth_screen_viewed');
  }, []);

  useEffect(() => {
    if (isCode) {
      posthog.capture('auth_verify_screen_viewed');
    }
  }, [isCode]);

  useEffect(() => {
    stepProgress.set(withTiming(isCode ? 1 : 0, { duration: reducedMotion ? 150 : 320 }));
  }, [isCode, reducedMotion, stepProgress]);

  useEffect(() => {
    if (!revealed) {
      return;
    }
    const greetingId = setTimeout(() => setGreeted(true), reducedMotion ? 0 : GREETING_DELAY_MS);
    const focusId = setTimeout(
      () => {
        // A link that opens on the code step focuses the code field itself.
        if (!isCodeRef.current) {
          emailInputRef.current?.focus();
        }
      },
      reducedMotion ? 200 : FOCUS_DELAY_MS,
    );
    return () => {
      clearTimeout(greetingId);
      clearTimeout(focusId);
    };
  }, [reducedMotion, revealed]);

  useEffect(() => {
    if (flow.codeError) {
      errorHaptic();
    }
  }, [flow.codeError]);

  useEffect(() => {
    if (flow.succeeded) {
      successHaptic();
    }
  }, [flow.succeeded]);

  const handleSendCode = useCallback(() => {
    posthog.capture('auth_send_code_pressed');
    tapHaptic();
    flow.sendCode().then((result) => {
      if (result === 'invalid') {
        posthog.capture('auth_email_invalid');
      }
      if (result !== 'sent') {
        errorHaptic();
      }
    });
  }, [flow]);

  const handleChangeEmail = useCallback(() => {
    posthog.capture('auth_change_email_pressed');
    flow.changeEmail();
    setTimeout(() => emailInputRef.current?.focus(), 450);
  }, [flow]);

  const handleCodeChange = useCallback(
    (value: string) => {
      setNod((count) => count + 1);
      if (value.replace(/\D/g, '').length === 6) {
        posthog.capture('auth_verify_pressed');
      }
      flow.setCode(value);
    },
    [flow],
  );

  const emailStyle = useAnimatedStyle(() => ({
    opacity: 1 - stepProgress.value,
    transform: [{ translateY: -12 * stepProgress.value }, { scale: 1 - 0.04 * stepProgress.value }],
  }));

  const codeStatus: CodeStatus = flow.succeeded
    ? 'success'
    : flow.isVerifying
      ? 'checking'
      : flow.codeError
        ? 'error'
        : 'idle';

  const bubbleText = !greeted
    ? null
    : flow.succeeded
      ? t.auth.mascot.welcome
      : codeStatus === 'error'
        ? t.auth.mascot.retry
        : flow.emailError
          ? t.auth.mascot.recheckEmail
          : isCode
            ? t.auth.mascot.checkEmail
            : t.auth.mascot.hello;

  if (isSignedIn && !flow.succeeded && !isHoldingSignIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination} />;
  }

  return (
    <KeyboardAwareScrollView
      testID="auth-screen"
      bottomOffset={24}
      contentContainerStyle={{
        alignItems: 'center',
        paddingBottom: 32,
        paddingHorizontal: 28,
        paddingTop: loginBrandTop(insets.top),
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.container}
    >
      <View style={{ opacity: launchPhase === 'done' ? 1 : 0 }}>
        <AuthBrand hop={flow.succeeded ? 1 : 0} leaningIn={isCode} nod={nod} testID="auth-brand" />
      </View>
      <View style={{ height: BUBBLE_SLOT_HEIGHT, justifyContent: 'flex-end', width: '100%' }}>
        <SpeechBubble text={bubbleText} />
      </View>

      <RiseIn active={revealed} delay={FORM_REVEAL_DELAY_MS} style={styles.form}>
        <View style={styles.steps}>
          <Animated.View
            accessibilityElementsHidden={isCode}
            importantForAccessibility={isCode ? 'no-hide-descendants' : 'auto'}
            pointerEvents={isCode ? 'none' : 'auto'}
            style={[styles.stepLayer, emailStyle]}
          >
            <EmailComposer
              ref={emailInputRef}
              hasError={Boolean(flow.emailError)}
              isReady={flow.isEmailReady}
              isSubmitting={flow.isSendingCode}
              onBlur={() => {
                if (flow.email.trim()) {
                  posthog.capture('auth_email_entered', { valid: flow.isEmailReady });
                }
              }}
              onChangeText={(value) => {
                setNod((count) => count + 1);
                flow.setEmail(value);
              }}
              onSubmit={handleSendCode}
              value={flow.email}
            />
            <Text
              testID="auth-email-message"
              accessibilityLiveRegion="polite"
              style={styles.message}
            >
              {flow.emailError ?? ''}
            </Text>
          </Animated.View>

          {isCode ? (
            <Animated.View
              entering={FadeIn.delay(120).duration(300)}
              exiting={FadeOut.duration(160)}
              style={styles.stepLayer}
            >
              <Text style={styles.sentTo}>{t.auth.verify.sentTo}</Text>
              <View style={styles.sentToRow}>
                <View style={styles.chip}>
                  <Text numberOfLines={1} style={styles.chipText}>
                    {flow.normalizedEmail}
                  </Text>
                </View>
                <Pressable
                  testID="auth-change-email"
                  accessibilityLabel={t.auth.verify.changeEmailA11y}
                  accessibilityRole="button"
                  disabled={flow.isVerifying || flow.succeeded}
                  onPress={handleChangeEmail}
                  style={styles.linkButton}
                >
                  <Text style={styles.link}>{t.auth.verify.changeEmail}</Text>
                </Pressable>
              </View>
              <CodePebbles
                accessibilityLabel={t.auth.verify.oneTimeVerificationCodeA11y}
                editable={!flow.isVerifying && !flow.isResending && !flow.succeeded}
                onChangeText={handleCodeChange}
                status={codeStatus}
                value={flow.code}
              />
              <Text
                testID="auth-otp-message"
                accessibilityLiveRegion="polite"
                style={styles.message}
              >
                {flow.codeError ?? ''}
              </Text>
              {flow.succeeded ? null : (
                <Pressable
                  testID="auth-resend-otp"
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: flow.isResending,
                    disabled: flow.isResending || flow.isVerifying || flow.resendSecondsLeft > 0,
                  }}
                  disabled={flow.isResending || flow.isVerifying || flow.resendSecondsLeft > 0}
                  onPress={() => {
                    posthog.capture('auth_resend_code_pressed');
                    void flow.resend();
                  }}
                  style={styles.linkButton}
                >
                  <Text style={flow.resendSecondsLeft > 0 ? styles.linkMuted : styles.link}>
                    {flow.resendSecondsLeft > 0
                      ? t.auth.verify.resendIn(flow.resendSecondsLeft)
                      : t.auth.verify.resendButton}
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          ) : null}
        </View>
      </RiseIn>
    </KeyboardAwareScrollView>
  );
}

const AuthWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="Auth">
    <AuthScreen />
  </FeatureErrorBoundary>
);

export default AuthWithErrorBoundary;
