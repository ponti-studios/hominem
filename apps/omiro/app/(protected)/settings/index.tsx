import { useRouter } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
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

import { ProtectedRouteFallback } from '~/components/protected/protected-route-fallback';
import { useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { MOBILE_PASSKEY_ENABLED, ON_DEVICE_AI_SPIKE_ENABLED } from '~/constants';
import { getAppLockEnabled, setAppLockEnabled } from '~/hooks/use-app-lock';
import { getPreventScreenshots, setPreventScreenshots } from '~/hooks/use-screen-capture';
import { useAuth } from '~/services/auth/auth-provider';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';
import { resolveProtectedRouteState } from '~/services/auth/protected-route-state';
import { getArchivedChatsRoute, getOnDeviceCalendarSpikeRoute } from '~/services/navigation/routes';
import { useMonthlyUsage } from '~/services/usage/use-usage-query';
import t from '~/translations';

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function getInitials(name: string, fallback: string): string {
  const source = name.trim() || fallback;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type BadgeColor = 'blue' | 'gray' | 'green' | 'orange' | 'purple';

const BADGE_BACKGROUNDS: Record<BadgeColor, string> = {
  blue: '#2B5FFF',
  gray: '#5B5A62',
  green: '#2E9E5B',
  orange: '#D97A2C',
  purple: '#7C5CFF',
};

function RowIcon({ name, color }: { name: SFSymbol; color: BadgeColor }) {
  return (
    <View style={[styles.rowIcon, { backgroundColor: BADGE_BACKGROUNDS[color] }]}>
      <AppIcon name={name} size={14} tintColor="#FFFFFF" />
    </View>
  );
}

interface AccountState {
  name: string;
  preventScreenshots: boolean;
  appLock: boolean;
}

type AccountAction =
  | { type: 'set-name'; name: string }
  | { type: 'set-prevent-screenshots'; preventScreenshots: boolean }
  | { type: 'set-app-lock'; appLock: boolean };

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
  const { isPending, isSignedIn, signOut, currentUser, updateProfile } = useAuth();
  const {
    addPasskey,
    passkeys,
    deletePasskey,
    isLoading: isPasskeyLoading,
  } = useMobilePasskeyAuth({ loadPasskeys: true });
  const { data: monthlyUsage } = useMonthlyUsage();
  const initialName = currentUser?.name ?? '';
  const [state, dispatch] = useReducer(accountReducer, {
    name: initialName,
    preventScreenshots: getPreventScreenshots(),
    appLock: getAppLockEnabled(),
  });
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
      setSaveError(t.settings.name.errorEmpty);
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
      setSaveError(error instanceof Error ? error.message : t.settings.name.errorSave);
    }
  };

  const onLogoutPress = () => {
    Alert.alert(t.settings.signOut.alertTitle, t.settings.signOut.alertMessage, [
      { text: t.settings.signOut.cancel, style: 'cancel' },
      { text: t.settings.signOut.confirm, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const onDeleteAccountPress = () => {
    Alert.alert(t.settings.deleteAccount.alertTitle, t.settings.deleteAccount.alertMessage, [
      { text: t.settings.deleteAccount.ok, style: 'default' },
    ]);
  };

  const onArchivedChatsPress = () => {
    router.push(getArchivedChatsRoute());
  };

  const onOnDeviceCalendarSpikePress = () => {
    router.push(getOnDeviceCalendarSpikeRoute());
  };

  const onAddPasskeyPress = async () => {
    const result = await addPasskey();
    if (!result.success) {
      Alert.alert(
        t.settings.passkeys.addErrorTitle,
        result.error ?? t.settings.passkeys.addErrorTitle,
      );
    }
  };

  const onDeletePasskeyPress = (id: string, passkeyName: string) => {
    Alert.alert(
      t.settings.passkeys.removeDialog.title,
      t.settings.passkeys.removeDialog.message(passkeyName),
      [
        { text: t.settings.passkeys.removeDialog.cancel, style: 'cancel' },
        {
          text: t.settings.passkeys.removeDialog.confirm,
          style: 'destructive',
          onPress: async () => {
            const result = await deletePasskey(id);
            if (!result.success) {
              Alert.alert(
                t.settings.passkeys.removeDialog.errorTitle,
                result.error ?? t.settings.passkeys.removeDialog.errorMessage,
              );
            }
          },
        },
      ],
    );
  };

  const protectedRouteState = resolveProtectedRouteState({ isPending, isSignedIn });

  if (protectedRouteState.showFallback) {
    return <ProtectedRouteFallback />;
  }

  const usagePercent = monthlyUsage
    ? Math.min(100, (monthlyUsage.totalCostUsd / monthlyUsage.limitUsd) * 100)
    : 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity */}
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: themeColors['bg-elevated'] }]}>
          <Text style={[styles.avatarText, { color: themeColors.foreground }]}>
            {getInitials(state.name, currentUser?.email ?? '?')}
          </Text>
        </View>
        <View style={styles.identityCopy}>
          <TextInput
            key={`name-${currentUser?.id ?? 'anonymous'}`}
            value={state.name}
            placeholder={t.settings.name.placeholder}
            placeholderTextColor={themeColors['text-tertiary']}
            returnKeyType="done"
            selectionColor={themeColors.foreground}
            cursorColor={themeColors.foreground}
            style={[styles.identityNameInput, { color: themeColors.foreground }]}
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
          <Text style={[styles.identityEmail, { color: themeColors['text-secondary'] }]}>
            {currentUser?.email ?? t.settings.emailMissing}
          </Text>
        </View>
      </View>

      {nameChanged ? (
        <View style={styles.saveRow}>
          <Button
            label={saveStatus === 'saving' ? t.settings.name.saving : t.settings.name.save}
            onPress={() => void onSavePress()}
            disabled={saveStatus === 'saving'}
            variant="secondary"
            size="sm"
          />
        </View>
      ) : null}
      {saveStatus === 'saved' ? (
        <Text
          style={[
            styles.statusText,
            styles.identityStatus,
            { color: themeColors['text-secondary'] },
          ]}
        >
          {t.settings.name.saved}
        </Text>
      ) : null}
      {saveError ? (
        <Text
          style={[styles.statusText, styles.identityStatus, { color: themeColors.destructive }]}
        >
          {saveError}
        </Text>
      ) : null}

      {/* Usage hero */}
      {monthlyUsage ? (
        <View
          testID="settings-usage-section"
          style={[styles.usageHero, { backgroundColor: themeColors['bg-elevated'] }]}
        >
          <View style={styles.usageHeroTop}>
            <Text style={[styles.usageHeroLabel, { color: themeColors['text-secondary'] }]}>
              AI usage this month
            </Text>
            <View style={[styles.usageHeroPill, { backgroundColor: themeColors['bg-surface'] }]}>
              <Text style={[styles.usageHeroPillText, { color: themeColors.foreground }]}>
                {usagePercent.toFixed(0)}%
              </Text>
            </View>
          </View>
          <View style={styles.usageHeroAmountRow}>
            <Text style={[styles.usageHeroAmount, { color: themeColors.foreground }]}>
              {formatUsd(monthlyUsage.totalCostUsd)}
            </Text>
            <Text style={[styles.usageHeroCap, { color: themeColors['text-secondary'] }]}>
              of {formatUsd(monthlyUsage.limitUsd)}
            </Text>
          </View>
          <View style={[styles.usageTrack, { backgroundColor: themeColors['border-default'] }]}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${usagePercent}%`,
                  backgroundColor: monthlyUsage.isOverLimit
                    ? themeColors.destructive
                    : themeColors.foreground,
                },
              ]}
            />
          </View>
          <Text style={[styles.usageHeroNote, { color: themeColors['text-tertiary'] }]}>
            {monthlyUsage.isOverLimit
              ? "You've reached this month's free AI usage limit. It resets at the start of next month."
              : 'Resets at the start of next month.'}
          </Text>
        </View>
      ) : null}

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: themeColors['text-secondary'] }]}>
          {t.settings.sections.privacy}
        </Text>
        <View style={[styles.sectionList, { backgroundColor: themeColors['bg-elevated'] }]}>
          <View style={[styles.row, { borderBottomColor: themeColors['border-default'] }]}>
            <View style={styles.rowLabelGroup}>
              <RowIcon name="faceid" color="green" />
              <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
                {t.settings.lockWithFaceId}
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
          <View style={[styles.row, styles.rowNoBorder]}>
            <View style={styles.rowLabelGroup}>
              <RowIcon name="eye.slash" color="gray" />
              <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
                {t.settings.preventScreenshots}
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
      </View>

      {/* Chats */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: themeColors['text-secondary'] }]}>
          {t.settings.sections.chats}
        </Text>
        <View style={[styles.sectionList, { backgroundColor: themeColors['bg-elevated'] }]}>
          <Pressable
            onPress={onArchivedChatsPress}
            style={({ pressed }) => [
              styles.row,
              __DEV__ || ON_DEVICE_AI_SPIKE_ENABLED ? undefined : styles.rowNoBorder,
              { borderBottomColor: themeColors['border-default'], opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.rowLabelGroup}>
              <RowIcon name="archivebox" color="blue" />
              <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
                {t.settings.archivedChats}
              </Text>
            </View>
            <AppIcon name="chevron.right" size={12} tintColor={themeColors['icon-muted']} />
          </Pressable>
          {__DEV__ || ON_DEVICE_AI_SPIKE_ENABLED ? (
            <Pressable
              testID="settings-on-device-calendar-spike"
              onPress={onOnDeviceCalendarSpikePress}
              style={({ pressed }) => [
                styles.row,
                styles.rowNoBorder,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.rowLabelGroup}>
                <RowIcon name="calendar" color="orange" />
                <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
                  On-device calendar spike (experimental)
                </Text>
              </View>
              <AppIcon name="chevron.right" size={12} tintColor={themeColors['icon-muted']} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Passkeys */}
      {MOBILE_PASSKEY_ENABLED ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: themeColors['text-secondary'] }]}>
            {t.settings.sections.passkeys}
          </Text>
          <View style={[styles.sectionList, { backgroundColor: themeColors['bg-elevated'] }]}>
            <Pressable
              onPress={() => void onAddPasskeyPress()}
              disabled={isPasskeyLoading}
              style={({ pressed }) => [
                styles.row,
                passkeys.length === 0 ? styles.rowNoBorder : undefined,
                { borderBottomColor: themeColors['border-default'], opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.rowLabelGroup}>
                <RowIcon name="plus" color="purple" />
                <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
                  {isPasskeyLoading ? t.settings.passkeys.adding : t.settings.passkeys.add}
                </Text>
              </View>
              {isPasskeyLoading ? <ActivityIndicator color={themeColors.foreground} /> : null}
            </Pressable>
            {passkeys.map((pk, index) => (
              <View
                key={pk.id}
                style={[
                  styles.row,
                  index === passkeys.length - 1
                    ? styles.rowNoBorder
                    : { borderBottomColor: themeColors['border-default'] },
                ]}
              >
                <View style={styles.rowLabelGroup}>
                  <RowIcon name="key.fill" color="purple" />
                  <Text style={[styles.rowLabel, { color: themeColors.foreground }]}>
                    {pk.name}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => onDeletePasskeyPress(pk.id, pk.name)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                >
                  <Text style={[styles.removeText, { color: themeColors.destructive }]}>
                    {t.settings.passkeys.remove}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Danger zone */}
      <View style={[styles.dangerList, { backgroundColor: themeColors['bg-elevated'] }]}>
        <Pressable
          onPress={onLogoutPress}
          style={({ pressed }) => [
            styles.dangerRow,
            { borderBottomColor: themeColors['border-default'], opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.dangerRowText, { color: themeColors.foreground }]}>
            {t.settings.signOut.label}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDeleteAccountPress}
          style={({ pressed }) => [
            styles.dangerRow,
            styles.rowNoBorder,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.dangerRowText, { color: themeColors.destructive }]}>
            {t.settings.deleteAccount.label}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default Settings;

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '700',
  },
  dangerList: {
    borderRadius: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  dangerRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  dangerRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityEmail: {
    fontSize: 13,
  },
  identityNameInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    padding: 0,
  },
  identityStatus: {
    paddingHorizontal: 16,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 7,
    height: 26,
    justifyContent: 'center',
    width: 26,
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
  rowNoBorder: {
    borderBottomWidth: 0,
  },
  saveRow: {
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
  },
  sectionList: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  statusText: {
    fontSize: 13,
  },
  usageFill: {
    borderRadius: 4,
    height: 8,
  },
  usageHero: {
    borderRadius: 20,
    gap: 12,
    marginHorizontal: 16,
    padding: 18,
  },
  usageHeroAmount: {
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  usageHeroAmountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  usageHeroCap: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  usageHeroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  usageHeroNote: {
    fontSize: 12,
  },
  usageHeroPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  usageHeroPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  usageHeroTop: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  usageTrack: {
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
});
