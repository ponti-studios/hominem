import type { RelativePathString } from 'expo-router';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import { useAuth } from '~/services/auth/auth-provider';
import t from '~/translations';

const Onboarding = () => {
  const { isSignedIn, currentUser, updateProfile, signOut } = useAuth();
  const themeColors = useThemeColors();
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
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.hero}>
          <Text style={[styles.brandMark, { color: themeColors.foreground }]}>H</Text>
          <Text style={[styles.title, { color: themeColors.foreground }]}>
            {t.onboarding.title}
          </Text>
          <Text style={[styles.helperText, { color: themeColors['text-secondary'] }]}>
            {t.onboarding.subtitle}
          </Text>
        </View>

        <View style={styles.formSection}>
          <TextInput
            value={name}
            placeholder={t.onboarding.namePlaceholder}
            placeholderTextColor={themeColors['text-tertiary']}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isSubmitting}
            returnKeyType="done"
            cursorColor={themeColors.foreground}
            selectionColor={themeColors.foreground}
            style={[
              styles.input,
              {
                backgroundColor: themeColors['bg-surface'],
                borderColor: themeColors['border-default'],
                color: themeColors.foreground,
              },
            ]}
            onChangeText={(text) => {
              setName(text);
              setHasError(false);
            }}
            onSubmitEditing={() => void onButtonPress()}
          />

          {hasError ? (
            <Text style={[styles.errorText, { color: '#FF5A5F' }]}>{t.onboarding.nameError}</Text>
          ) : null}

          <Button
            label={t.onboarding.start}
            onPress={() => void onButtonPress()}
            disabled={isSubmitting}
            variant="primary"
          />

          <Button
            label={t.onboarding.continueWithoutName}
            onPress={() => void onSkipPress()}
            disabled={isSubmitting}
            variant="tertiary"
          />

          <Button
            testID="onboarding-sign-out"
            label={t.onboarding.signOut}
            onPress={() => void signOut()}
            disabled={isSubmitting}
            variant="tertiary"
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 24,
  },
  hero: {
    gap: 8,
  },
  brandMark: {
    fontSize: 17,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  helperText: {
    fontSize: 16,
    lineHeight: 22,
  },
  formSection: {
    gap: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

export default Onboarding;
