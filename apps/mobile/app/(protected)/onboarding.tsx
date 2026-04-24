import type { RelativePathString } from 'expo-router';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Alert } from '~/components/Alert';
import { Text, theme } from '~/components/theme';
import { Button } from '~/components/ui/Button';
import { TextField } from '~/components/ui/TextField';
import { useAuth } from '~/services/auth/auth-provider';

const Onboarding = () => {
  const { isSignedIn, currentUser, updateProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [hasError, setHasError] = useState(false);

  const saveName = async (nextName: string) => {
    if (!currentUser) return;
    await updateProfile({ name: nextName.trim() });
  };

  const onButtonPress = async () => {
    if (!currentUser) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setHasError(true);
      return;
    }

    try {
      setHasError(false);
      await saveName(trimmedName);
    } catch {
      setHasError(true);
    }
  };

  const onSkipPress = async () => {
    if (!currentUser) return;
    const fallbackName = currentUser.email?.split('@')[0] || 'Hakumi user';
    try {
      setHasError(false);
      await saveName(fallbackName);
    } catch {
      setHasError(true);
    }
  };

  if (!isSignedIn) {
    return <Redirect href={'/(auth)' as RelativePathString} />;
  }

  if (currentUser?.name) {
    return <Redirect href={'/(protected)/(tabs)/' as RelativePathString} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.mark}>
            <Text variant="headline" color="foreground">
              H
            </Text>
          </View>
          <Text variant="title1" color="foreground" style={styles.title}>
            What should Hakumi call you?
          </Text>
          <Text variant="body" color="text-tertiary" style={styles.helper}>
            This is only used to personalize your workspace. You can change it later.
          </Text>
        </View>

        <TextField
          label="Name"
          placeholder="Wyatt"
          value={name}
          style={styles.inputFlex}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onButtonPress}
          onChangeText={(text) => setName(text)}
        />
        <Button title="Start using Hakumi" onPress={onButtonPress} />
        <Button
          title="Continue without name"
          variant="link"
          size="xs"
          onPress={onSkipPress}
          textStyle={styles.skipText}
        />
        <Pressable testID="onboarding-sign-out" onPress={signOut} style={styles.signOutAction}>
          <Text variant="caption1" color="text-tertiary">
            Sign out
          </Text>
        </Pressable>
        {hasError ? (
          <Alert error>
            <Text variant="body" color="destructive">
              Add a name or continue without one.
            </Text>
          </Alert>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: theme.spacing.ml_24,
    rowGap: theme.spacing.m_16,
  },
  hero: {
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: theme.spacing.sm_12,
    marginBottom: theme.spacing.m_16,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors['border-faint'],
    borderCurve: 'continuous',
    borderRadius: theme.borderRadii.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: {
    textAlign: 'center',
  },
  helper: {
    textAlign: 'center',
  },
  inputFlex: {
    width: '100%',
  },
  skipText: {
    color: theme.colors['text-tertiary'],
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  signOutAction: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm_8,
  },
});

export default Onboarding;
