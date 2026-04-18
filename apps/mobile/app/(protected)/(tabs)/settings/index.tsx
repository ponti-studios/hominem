import { Image } from 'expo-image';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useEffect, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, theme } from '~/components/theme';
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

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

interface RowProps {
  sf?: string;
  sfColor?: string;
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function SettingsRow({
  sf,
  sfColor,
  label,
  sublabel,
  trailing,
  onPress,
  destructive = false,
  disabled = false,
}: RowProps) {
  const labelColor = destructive ? theme.colors.destructive : theme.colors.foreground;

  const inner = (
    <View style={styles.row}>
      {sf && (
        <View
          style={[styles.rowIconWrap, { backgroundColor: sfColor ?? theme.colors['bg-elevated'] }]}
        >
          <Image
            source={`sf:${sf}`}
            style={styles.rowIcon}
            tintColor={destructive ? theme.colors.destructive : theme.colors['icon-primary']}
            contentFit="contain"
          />
        </View>
      )}
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {trailing !== undefined ? (
        <View style={styles.rowTrailing}>{trailing}</View>
      ) : onPress ? (
        <Image
          source="sf:chevron.right"
          style={styles.chevron}
          tintColor={theme.colors['text-tertiary']}
          contentFit="contain"
        />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.rowPressable}>{inner}</View>;
}

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <SectionLabel>Account</SectionLabel>
      <SectionCard>
        <SettingsRow
          sf="person.crop.circle"
          label="Name"
          trailing={
            <View style={styles.inlineEditRow}>
              <TextInput
                value={state.name}
                onChangeText={(text) => {
                  dispatch({ type: 'set-name', name: text });
                  setSaveError(null);
                  setSaveStatus('idle');
                }}
                style={styles.inlineInput}
                placeholderTextColor={theme.colors['text-tertiary']}
                placeholder="Your name"
                returnKeyType="done"
                onSubmitEditing={nameChanged ? onSavePress : undefined}
                accessibilityLabel="Name"
              />
              {nameChanged && (
                <Pressable
                  onPress={onSavePress}
                  disabled={saveStatus === 'saving'}
                  style={styles.inlineSaveButton}
                  accessibilityLabel="Save name"
                  accessibilityRole="button"
                >
                  {saveStatus === 'saving' ? (
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  ) : (
                    <Text style={styles.inlineSaveLabel}>Save</Text>
                  )}
                </Pressable>
              )}
            </View>
          }
        />
        {saveError ? (
          <View style={styles.inlineFeedbackRow}>
            <Text style={styles.inlineStatusError}>{saveError}</Text>
          </View>
        ) : saveStatus === 'saved' ? (
          <View style={styles.inlineFeedbackRow}>
            <Text style={styles.inlineStatusSuccess}>Saved</Text>
          </View>
        ) : null}
        <RowSeparator />
        <SettingsRow
          sf="envelope"
          label="Email"
          trailing={
            <Text style={styles.trailingValue} numberOfLines={1}>
              {currentUser?.email ?? '—'}
            </Text>
          }
        />
      </SectionCard>

      <SectionLabel>Privacy</SectionLabel>
      <SectionCard>
        <SettingsRow
          sf={Platform.OS === 'ios' ? 'faceid' : 'lock.fill'}
          label="Lock with Face ID"
          trailing={
            <Switch
              value={state.appLock}
              onValueChange={(value) => {
                dispatch({ type: 'set-app-lock', appLock: value });
                setAppLockEnabled(value);
              }}
              accessibilityLabel="Lock with Face ID"
            />
          }
        />
        <RowSeparator />
        <SettingsRow
          sf="eye.slash"
          label="Prevent screenshots"
          trailing={
            <Switch
              value={state.preventScreenshots}
              onValueChange={(value) => {
                dispatch({ type: 'set-prevent-screenshots', preventScreenshots: value });
                setPreventScreenshots(value);
              }}
              accessibilityLabel="Prevent screenshots"
            />
          }
        />
      </SectionCard>

      <SectionLabel>Chats</SectionLabel>
      <SectionCard>
        <SettingsRow sf="archivebox" label="Archived chats" onPress={onArchivedChatsPress} />
      </SectionCard>

      {MOBILE_PASSKEY_ENABLED && (
        <>
          <SectionLabel>Passkeys</SectionLabel>
          <SectionCard>
            <SettingsRow
              sf="person.badge.key.fill"
              label="Add passkey"
              onPress={() => void onAddPasskeyPress()}
              trailing={
                isPasskeyLoading ? (
                  <ActivityIndicator size="small" color={theme.colors['text-tertiary']} />
                ) : undefined
              }
              disabled={isPasskeyLoading}
            />
            {passkeys.map((pk, index) => (
              <React.Fragment key={pk.id}>
                <RowSeparator />
                <SettingsRow
                  sf="key.fill"
                  label={pk.name}
                  trailing={
                    <Pressable
                      onPress={() => onDeletePasskeyPress(pk.id, pk.name)}
                      hitSlop={8}
                      accessibilityLabel={`Remove passkey ${pk.name}`}
                      accessibilityRole="button"
                    >
                      <Image
                        source="sf:trash"
                        style={styles.trashIcon}
                        tintColor={theme.colors.destructive}
                        contentFit="contain"
                      />
                    </Pressable>
                  }
                />
              </React.Fragment>
            ))}
          </SectionCard>
        </>
      )}

      <View style={styles.dangerZone}>
        <Pressable
          onPress={onLogoutPress}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
          testID="settings-sign-out"
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Image
            source="sf:rectangle.portrait.and.arrow.right"
            style={styles.dangerIcon}
            tintColor={theme.colors.destructive}
            contentFit="contain"
          />
          <Text style={styles.dangerLabel}>Sign out</Text>
        </Pressable>

        <Pressable
          onPress={onDeleteAccountPress}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          <Image
            source="sf:trash"
            style={styles.dangerIcon}
            tintColor={theme.colors['text-tertiary']}
            contentFit="contain"
          />
          <Text style={[styles.dangerLabel, styles.dangerLabelMuted]}>Delete account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default Settings;

const ROW_HEIGHT = 50;
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 4,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors['text-tertiary'],
    letterSpacing: 0.1,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 6,
  },

  sectionCard: {
    backgroundColor: theme.colors['bg-base'],
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors['border-subtle'],
    overflow: 'hidden',
  },

  rowPressable: {
    minHeight: ROW_HEIGHT,
  },
  rowPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: ROW_HEIGHT,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: theme.colors['border-subtle'],
    marginLeft: 14 + 32 + 12, // align with label start
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowIcon: {
    width: 16,
    height: 16,
  },
  rowContent: {
    flex: 1,
    gap: 2,
    paddingVertical: 13,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: theme.colors.foreground,
  },
  rowSublabel: {
    fontSize: 12,
    color: theme.colors['text-tertiary'],
  },
  rowTrailing: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  chevron: {
    width: 14,
    height: 14,
    opacity: 0.4,
  },
  trailingValue: {
    fontSize: 15,
    color: theme.colors['text-tertiary'],
    maxWidth: 160,
  },

  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineInput: {
    fontSize: 15,
    color: theme.colors['text-secondary'],
    textAlign: 'right',
    minWidth: 80,
    maxWidth: 160,
    padding: 0,
  },
  inlineSaveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
  },
  inlineSaveLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors['accent-foreground'],
  },
  inlineFeedbackRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  inlineStatusError: {
    fontSize: 12,
    color: theme.colors.destructive,
  },
  inlineStatusSuccess: {
    fontSize: 12,
    color: theme.colors['text-tertiary'],
  },

  trashIcon: {
    width: 16,
    height: 16,
  },

  dangerZone: {
    marginTop: 32,
    gap: 1,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors['border-subtle'],
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.colors['bg-base'],
  },
  dangerButtonPressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  dangerIcon: {
    width: 18,
    height: 18,
  },
  dangerLabel: {
    fontSize: 16,
    color: theme.colors.destructive,
    fontWeight: '400',
  },
  dangerLabelMuted: {
    color: theme.colors['text-tertiary'],
  },
});
