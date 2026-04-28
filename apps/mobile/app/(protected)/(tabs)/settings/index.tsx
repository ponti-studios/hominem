import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useEffect, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { MOBILE_PASSKEY_ENABLED } from '~/constants';
import { getAppLockEnabled, setAppLockEnabled } from '~/hooks/use-app-lock';
import { getPreventScreenshots, setPreventScreenshots } from '~/hooks/use-screen-capture';
import { useAuth } from '~/services/auth/auth-provider';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';

interface AccountState {
  name: string;
  preventScreenshots: boolean;
  appLock: boolean;
}

type AccountAction =
  | { type: 'set-name'; name: string }
  | { type: 'set-prevent-screenshots'; preventScreenshots: boolean }
  | { type: 'set-app-lock'; appLock: boolean };

function createInitialAccountState(name: string): AccountState {
  return {
    name,
    preventScreenshots: getPreventScreenshots(),
    appLock: getAppLockEnabled(),
  };
}

function accountReducer(state: AccountState, action: AccountAction): AccountState {
  switch (action.type) {
    case 'set-name':
      return { ...state, name: action.name };
    case 'set-prevent-screenshots':
      return { ...state, preventScreenshots: action.preventScreenshots };
    case 'set-app-lock':
      return { ...state, appLock: action.appLock };
  }
}

function Settings() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { isSignedIn, signOut, currentUser, updateProfile } = useAuth();
  const {
    addPasskey,
    passkeys,
    deletePasskey,
    isLoading: isPasskeyLoading,
  } = useMobilePasskeyAuth({ loadPasskeys: true });
  const initialName = currentUser?.name ?? '';
  const [state, dispatch] = useReducer(accountReducer, initialName, createInitialAccountState);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const normalizedName = state.name.trim();
  const initialNormalizedName = initialName.trim();
  const nameChanged = normalizedName !== initialNormalizedName;

  useEffect(() => {
    if (saveStatus !== 'saved') {
      return;
    }

    const timeout = setTimeout(() => {
      setSaveStatus('idle');
    }, 1500);

    return () => clearTimeout(timeout);
  }, [saveStatus]);

  const onSavePress = async () => {
    if (!nameChanged) {
      return;
    }

    if (!normalizedName) {
      setSaveError('Name cannot be empty.');
      setSaveStatus('idle');
      return;
    }

    setSaveError(null);
    setSaveStatus('saving');

    try {
      await updateProfile({ name: normalizedName });
      dispatch({ type: 'set-name', name: normalizedName });
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('idle');
      setSaveError(error instanceof Error ? error.message : 'Could not save name.');
    }
  };

  const onLogoutPress = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const onDeleteAccountPress = () => {
    Alert.alert('Delete account', 'Account deletion is not available in this release.', [
      { text: 'OK', style: 'default' },
    ]);
  };

  const onArchivedChatsPress = () => {
    router.push('/(protected)/(tabs)/settings/archived-chats' as RelativePathString);
  };

  const onAddPasskeyPress = async () => {
    const result = await addPasskey();
    if (!result.success) {
      Alert.alert('Could not add passkey', result.error ?? 'Please try again.');
    }
  };

  const onDeletePasskeyPress = (id: string, passkeyName: string) => {
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
  };

  if (!isSignedIn) return null;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: themeColors['text-secondary'] }]}>Account</Text>
        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <AppIcon
              name="person.crop.circle"
              size={18}
              tintColor={themeColors['icon-secondary']}
            />
            <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>Name</Text>
          </View>
          <View style={styles.nameControls}>
            <TextInput
              key={`name-${currentUser?.id ?? 'anonymous'}`}
              value={state.name}
              placeholder="Your name"
              placeholderTextColor={themeColors['text-tertiary']}
              returnKeyType="done"
              selectionColor={themeColors.foreground}
              cursorColor={themeColors.foreground}
              style={[
                styles.inlineInput,
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors['border-default'],
                  color: themeColors.foreground,
                },
              ]}
              onChangeText={(text) => {
                dispatch({ type: 'set-name', name: text });
                setSaveError(null);
                setSaveStatus('idle');
              }}
              onSubmitEditing={() => {
                if (nameChanged) {
                  void onSavePress();
                }
              }}
            />
            {nameChanged ? (
              <View style={styles.saveButtonWrap}>
                <Button
                  label={saveStatus === 'saving' ? 'Saving' : 'Save'}
                  onPress={() => void onSavePress()}
                  disabled={saveStatus === 'saving'}
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>
        </View>

        {saveStatus === 'saved' ? (
          <Text style={[styles.statusText, { color: themeColors['text-secondary'] }]}>Saved</Text>
        ) : null}

        {saveError ? <Text style={[styles.statusText, styles.errorText]}>{saveError}</Text> : null}

        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <AppIcon name="envelope" size={18} tintColor={themeColors['icon-secondary']} />
            <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>Email</Text>
          </View>
          <Text style={[styles.rowValue, { color: themeColors['text-secondary'] }]}>
            {currentUser?.email ?? '-'}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: themeColors['text-secondary'] }]}>Privacy</Text>
        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <AppIcon name="faceid" size={18} tintColor={themeColors['icon-secondary']} />
            <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
              Lock with Face ID
            </Text>
          </View>
          <Switch
            value={state.appLock}
            onValueChange={(value) => {
              dispatch({ type: 'set-app-lock', appLock: value });
              setAppLockEnabled(value);
            }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <AppIcon name="eye.slash" size={18} tintColor={themeColors['icon-secondary']} />
            <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
              Prevent screenshots
            </Text>
          </View>
          <Switch
            value={state.preventScreenshots}
            onValueChange={(value) => {
              dispatch({ type: 'set-prevent-screenshots', preventScreenshots: value });
              setPreventScreenshots(value);
            }}
          />
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: themeColors['text-secondary'] }]}>Chats</Text>
        <Pressable
          onPress={onArchivedChatsPress}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowLabelGroup}>
            <AppIcon name="archivebox" size={18} tintColor={themeColors['icon-secondary']} />
            <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>Archived chats</Text>
          </View>
          <AppIcon name="chevron.right" size={12} tintColor={themeColors['icon-tertiary']} />
        </Pressable>
      </View>

      {MOBILE_PASSKEY_ENABLED ? (
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: themeColors['bg-surface'],
              borderColor: themeColors['border-default'],
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: themeColors['text-secondary'] }]}>
            Passkeys
          </Text>
          <Button
            label={isPasskeyLoading ? 'Adding passkey' : 'Add passkey'}
            onPress={() => void onAddPasskeyPress()}
            disabled={isPasskeyLoading}
            variant="secondary"
          />
          {isPasskeyLoading ? <ActivityIndicator color={themeColors.foreground} /> : null}
          {passkeys.map((pk) => (
            <View key={pk.id} style={styles.row}>
              <View style={styles.rowLabelGroup}>
                <AppIcon name="key.fill" size={16} tintColor={themeColors['icon-secondary']} />
                <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>{pk.name}</Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => onDeletePasskeyPress(pk.id, pk.name)}
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: themeColors['bg-surface'],
            borderColor: themeColors['border-default'],
          },
        ]}
      >
        <View style={styles.actionStack}>
          <Button label="Sign out" onPress={onLogoutPress} variant="secondary" />
          <Pressable
            onPress={onDeleteAccountPress}
            style={({ pressed }) => [styles.deleteAction, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Text style={styles.deleteActionText}>Delete account</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

export default Settings;

const styles = StyleSheet.create({
  actionStack: {
    gap: 8,
  },
  deleteAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  deleteActionText: {
    color: '#FF5A5F',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#FF5A5F',
  },
  inlineInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 40,
    minWidth: 170,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nameControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  removeText: {
    color: '#FF5A5F',
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowLabelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  rowValue: {
    fontSize: 15,
    maxWidth: '50%',
    textAlign: 'right',
  },
  saveButtonWrap: {
    minWidth: 78,
  },
  scrollContent: {
    gap: 16,
    padding: 16,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
  },
  statusText: {
    fontSize: 13,
  },
});
