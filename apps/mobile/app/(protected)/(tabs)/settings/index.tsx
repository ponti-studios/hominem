import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AccountSection,
  ChatsSection,
  DangerZone,
  PasskeysSection,
  PrivacySection,
} from '~/components/settings/index';
import { MOBILE_PASSKEY_ENABLED } from '~/constants';
import { getAppLockEnabled, setAppLockEnabled } from '~/hooks/use-app-lock';
import { getPreventScreenshots, setPreventScreenshots } from '~/hooks/use-screen-capture';
import { useAuth } from '~/services/auth/auth-provider';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';

import { styles } from './styles';

function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, signOut, currentUser, updateProfile } = useAuth();
  const {
    addPasskey,
    passkeys,
    deletePasskey,
    isLoading: isPasskeyLoading,
  } = useMobilePasskeyAuth();

  const [appLock, setAppLock] = useState(getAppLockEnabled());
  const [preventScreenshots, setPreventScreenshotsState] = useState(getPreventScreenshots());

  const handleSaveName = useCallback(
    async (name: string) => {
      await updateProfile({ name });
    },
    [updateProfile],
  );

  const handleAppLockChange = useCallback((value: boolean) => {
    setAppLock(value);
    setAppLockEnabled(value);
  }, []);

  const handlePreventScreenshotsChange = useCallback((value: boolean) => {
    setPreventScreenshotsState(value);
    setPreventScreenshots(value);
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert('Delete account', 'Account deletion is not available in this release.', [
      { text: 'OK', style: 'default' },
    ]);
  }, []);

  const handleArchivedChats = useCallback(() => {
    router.push('/(protected)/(tabs)/settings/archived-chats' as RelativePathString);
  }, [router]);

  const handleAddPasskey = useCallback(async () => {
    const result = await addPasskey();
    if (!result.success) {
      Alert.alert('Could not add passkey', result.error ?? 'Please try again.');
    }
  }, [addPasskey]);

  const handleDeletePasskey = useCallback(
    (id: string, passkeyName: string) => {
      Alert.alert('Remove passkey', `Remove "${passkeyName}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await deletePasskey(id);
            if (!result.success) {
              Alert.alert('Error', result.error ?? 'Could not remove passkey.');
            }
          },
        },
      ]);
    },
    [deletePasskey],
  );

  if (!isSignedIn) return null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <AccountSection
        userEmail={currentUser?.email ?? '—'}
        initialName={currentUser?.name ?? ''}
        onSaveName={handleSaveName}
      />

      <PrivacySection
        appLock={appLock}
        preventScreenshots={preventScreenshots}
        onAppLockChange={handleAppLockChange}
        onPreventScreenshotsChange={handlePreventScreenshotsChange}
      />

      <ChatsSection onPress={handleArchivedChats} />

      {MOBILE_PASSKEY_ENABLED && (
        <PasskeysSection
          passkeys={passkeys}
          isLoading={isPasskeyLoading}
          onAddPress={handleAddPasskey}
          onDeletePress={handleDeletePasskey}
        />
      )}

      <DangerZone onSignOut={handleSignOut} onDeleteAccount={handleDeleteAccount} />
    </ScrollView>
  );
}

export default Settings;
