import {
  Button as SwiftUIButton,
  Form as SwiftUIForm,
  Host as SwiftUIHost,
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
  onSubmit,
  padding,
  submitLabel,
  textFieldStyle,
  textInputAutocapitalization,
  autocorrectionDisabled,
} from '@expo/ui/swift-ui/modifiers';
import type { RelativePathString } from 'expo-router';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useAuth } from '~/services/auth/auth-provider';

const Onboarding = () => {
  const { isSignedIn, currentUser, updateProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saveName = async (nextName: string) => {
    if (!currentUser) return;
    await updateProfile({ name: nextName.trim() });
  };

  const onButtonPress = async () => {
    if (!currentUser || isSubmitting) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setHasError(true);
      return;
    }

    try {
      setIsSubmitting(true);
      setHasError(false);
      await saveName(trimmedName);
    } catch {
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSkipPress = async () => {
    if (!currentUser || isSubmitting) return;
    const fallbackName = currentUser.email?.split('@')[0] || 'Hakumi user';
    try {
      setIsSubmitting(true);
      setHasError(false);
      await saveName(fallbackName);
    } catch {
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSignedIn) {
    return <Redirect href={'/(auth)' as RelativePathString} />;
  }

  if (currentUser?.name) {
    return <Redirect href={'/(protected)/(tabs)/' as RelativePathString} />;
  }

  return (
    <SwiftUIHost style={styles.host} useViewportSizeMeasurement>
      <SwiftUIForm modifiers={[listStyle('insetGrouped')]}>
        <SwiftUISection>
          <VStack spacing={8} modifiers={[padding({ vertical: 8 })]}>
            <SwiftUIText modifiers={[font({ size: 17, weight: 'semibold' })]}>H</SwiftUIText>
            <SwiftUIText modifiers={[font({ size: 28, weight: 'bold' })]}>
              What should Hakumi call you?
            </SwiftUIText>
            <SwiftUIText
              modifiers={[
                font({ size: 16 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              This is only used to personalize your workspace. You can change it later.
            </SwiftUIText>
          </VStack>
        </SwiftUISection>

        <SwiftUISection>
          <SwiftUITextField
            placeholder="Wyatt"
            onValueChange={(text) => {
              setName(text);
              setHasError(false);
            }}
            modifiers={[
              textFieldStyle('roundedBorder'),
              keyboardType('default'),
              textInputAutocapitalization('words'),
              autocorrectionDisabled(true),
              submitLabel('done'),
              onSubmit(() => void onButtonPress()),
              disabledModifier(isSubmitting),
            ]}
          />

          {hasError ? (
            <SwiftUIText
              modifiers={[font({ size: 13 }), foregroundStyle({ type: 'color', color: 'red' })]}
            >
              Add a name or continue without one.
            </SwiftUIText>
          ) : null}

          <SwiftUIButton
            label="Start using Hakumi"
            onPress={() => void onButtonPress()}
            modifiers={[
              buttonStyle('borderedProminent'),
              controlSize('large'),
              disabledModifier(isSubmitting),
              frame({ maxWidth: Number.POSITIVE_INFINITY }),
            ]}
          />

          <SwiftUIButton
            label="Continue without name"
            onPress={() => void onSkipPress()}
            modifiers={[buttonStyle('plain'), controlSize('small'), disabledModifier(isSubmitting)]}
          />

          <SwiftUIButton
            testID="onboarding-sign-out"
            label="Sign out"
            onPress={() => void signOut()}
            modifiers={[buttonStyle('plain'), controlSize('small')]}
          />
        </SwiftUISection>
      </SwiftUIForm>
    </SwiftUIHost>
  );
};

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});

export default Onboarding;
