import {
  HStack,
  ProgressView,
  Spacer,
  Button as SwiftUIButton,
  Form as SwiftUIForm,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
  Section as SwiftUISection,
  Text as SwiftUIText,
  TextField as SwiftUITextField,
  Toggle as SwiftUIToggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  listStyle,
  onSubmit,
  padding,
  submitLabel,
  textFieldStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useEffect, useReducer, useState } from 'react';
import { Alert } from 'react-native';

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
  const { isSignedIn, signOut, currentUser, updateProfile } = useAuth();
  const {
    addPasskey,
    passkeys,
    deletePasskey,
    isLoading: isPasskeyLoading,
  } = useMobilePasskeyAuth();
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
    <SwiftUIHost style={swiftUIStyles.host} useViewportSizeMeasurement>
      <SwiftUIForm modifiers={[listStyle('insetGrouped')]}>
        <SwiftUISection title="Account">
          <HStack spacing={10}>
            <SwiftUIImage systemName="person.crop.circle" size={18} color="#8E8E93" />
            <SwiftUIText>Name</SwiftUIText>
            <Spacer />
            <SwiftUITextField
              key={`name-${currentUser?.id ?? 'anonymous'}`}
              defaultValue={state.name}
              placeholder="Your name"
              onValueChange={(text) => {
                dispatch({ type: 'set-name', name: text });
                setSaveError(null);
                setSaveStatus('idle');
              }}
              modifiers={[
                textFieldStyle('plain'),
                submitLabel('done'),
                onSubmit(() => {
                  if (nameChanged) {
                    void onSavePress();
                  }
                }),
                frame({ maxWidth: 170, alignment: 'trailing' }),
              ]}
            />
            {nameChanged ? (
              <SwiftUIButton
                label={saveStatus === 'saving' ? 'Saving' : 'Save'}
                onPress={() => void onSavePress()}
                modifiers={[
                  buttonStyle('bordered'),
                  controlSize('small'),
                  disabledModifier(saveStatus === 'saving'),
                ]}
              />
            ) : null}
          </HStack>

          {saveStatus === 'saved' ? (
            <SwiftUIText
              modifiers={[
                font({ size: 13 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              Saved
            </SwiftUIText>
          ) : null}

          {saveError ? (
            <SwiftUIText
              modifiers={[font({ size: 13 }), foregroundStyle({ type: 'color', color: 'red' })]}
            >
              {saveError}
            </SwiftUIText>
          ) : null}

          <HStack spacing={10}>
            <SwiftUIImage systemName="envelope" size={18} color="#8E8E93" />
            <SwiftUIText>Email</SwiftUIText>
            <Spacer />
            <SwiftUIText
              modifiers={[
                font({ size: 15 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {currentUser?.email ?? '-'}
            </SwiftUIText>
          </HStack>
        </SwiftUISection>

        <SwiftUISection title="Privacy">
          <SwiftUIToggle
            label="Lock with Face ID"
            systemImage="faceid"
            isOn={state.appLock}
            onIsOnChange={(value) => {
              dispatch({ type: 'set-app-lock', appLock: value });
              setAppLockEnabled(value);
            }}
          />
          <SwiftUIToggle
            label="Prevent screenshots"
            systemImage="eye.slash"
            isOn={state.preventScreenshots}
            onIsOnChange={(value) => {
              dispatch({ type: 'set-prevent-screenshots', preventScreenshots: value });
              setPreventScreenshots(value);
            }}
          />
        </SwiftUISection>

        <SwiftUISection title="Chats">
          <SwiftUIButton
            label="Archived chats"
            systemImage="archivebox"
            onPress={onArchivedChatsPress}
            modifiers={[buttonStyle('plain')]}
          />
        </SwiftUISection>

        {MOBILE_PASSKEY_ENABLED ? (
          <SwiftUISection title="Passkeys">
            <SwiftUIButton
              label={isPasskeyLoading ? 'Adding passkey' : 'Add passkey'}
              systemImage="person.badge.key.fill"
              onPress={() => void onAddPasskeyPress()}
              modifiers={[buttonStyle('plain'), disabledModifier(isPasskeyLoading)]}
            />
            {isPasskeyLoading ? <ProgressView /> : null}
            {passkeys.map((pk) => (
              <HStack key={pk.id} spacing={10}>
                <SwiftUIImage systemName="key.fill" size={16} color="#8E8E93" />
                <SwiftUIText>{pk.name}</SwiftUIText>
                <Spacer />
                <SwiftUIButton
                  label="Remove"
                  role="destructive"
                  systemImage="trash"
                  onPress={() => onDeletePasskeyPress(pk.id, pk.name)}
                  modifiers={[buttonStyle('borderless'), controlSize('small')]}
                />
              </HStack>
            ))}
          </SwiftUISection>
        ) : null}

        <SwiftUISection>
          <VStack spacing={8} modifiers={[padding({ vertical: 4 })]}>
            <SwiftUIButton
              label="Sign out"
              role="destructive"
              systemImage="rectangle.portrait.and.arrow.right"
              onPress={onLogoutPress}
              modifiers={[buttonStyle('bordered')]}
            />
            <SwiftUIButton
              label="Delete account"
              role="destructive"
              systemImage="trash"
              onPress={onDeleteAccountPress}
              modifiers={[buttonStyle('borderless')]}
            />
          </VStack>
        </SwiftUISection>
      </SwiftUIForm>
    </SwiftUIHost>
  );
}

export default Settings;

const swiftUIStyles = {
  host: {
    flex: 1,
  },
} as const;
