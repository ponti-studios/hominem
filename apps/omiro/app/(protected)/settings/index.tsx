import { useRouter } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import React, { useEffect, useReducer, useState } from 'react';
import {
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
import { componentSizes, fontSizes, radii, spacing, useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { getAppLockEnabled, setAppLockEnabled } from '~/hooks/use-app-lock';
import { getPreventScreenshots, setPreventScreenshots } from '~/hooks/use-screen-capture';
import OnDeviceAIModule, { type CalendarPermissionStatus } from '~/modules/on-device-ai';
import { useAuth } from '~/services/auth/auth-provider';
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

/** A List row (Primitives §2): icon + label on the left, one accessory on the
 * right. No background, no border — rows are separated by space alone. */
function SettingsRow({
  icon,
  label,
  description,
  onPress,
  accessory,
  destructive,
  testID,
}: {
  icon: SFSymbol;
  label: string;
  description?: string;
  onPress?: () => void;
  accessory?: React.ReactNode;
  destructive?: boolean;
  testID?: string;
}) {
  const themeColors = useThemeColors();
  const labelColor = destructive ? themeColors.destructive : themeColors.foreground;
  const content = (
    <View style={styles.row}>
      <View style={styles.rowLabelGroup}>
        <AppIcon
          name={icon}
          size={18}
          tintColor={destructive ? themeColors.destructive : themeColors['icon-muted']}
        />
        <View style={styles.rowCopy}>
          <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
          {description ? (
            <Text style={[styles.rowDescription, { color: themeColors['text-secondary'] }]}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      {accessory}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.rowTouchable}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.rowTouchable, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  const themeColors = useThemeColors();
  return (
    <Text style={[styles.sectionLabel, { color: themeColors['text-secondary'] }]}>{children}</Text>
  );
}

function Settings() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { isPending, isSignedIn, signOut, currentUser, updateProfile } = useAuth();
  const { data: monthlyUsage } = useMonthlyUsage();
  const initialName = currentUser?.name ?? '';
  const [state, dispatch] = useReducer(accountReducer, {
    name: initialName,
    preventScreenshots: getPreventScreenshots(),
    appLock: getAppLockEnabled(),
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [calendarPermission, setCalendarPermission] = useState<CalendarPermissionStatus | null>(
    null,
  );

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

  useEffect(() => {
    void OnDeviceAIModule.getCalendarPermissions().then(setCalendarPermission);
  }, []);

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

  const onCalendarPress = async () => {
    const status = await OnDeviceAIModule.requestCalendarPermissions();
    setCalendarPermission(status);
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

      {/* Account */}
      <View style={styles.section}>
        <SectionLabel>Account</SectionLabel>
        <SettingsRow
          testID="settings-calendar-connect"
          icon="calendar"
          label="Calendar"
          description={
            calendarPermission === 'authorized'
              ? 'Connected'
              : calendarPermission === 'denied'
                ? 'Access denied'
                : 'Connect your calendar'
          }
          accessory={
            <Button
              testID="settings-calendar-action"
              label={calendarPermission === 'authorized' ? 'Query' : 'Connect'}
              onPress={() =>
                calendarPermission === 'authorized'
                  ? onOnDeviceCalendarSpikePress()
                  : void onCalendarPress()
              }
              variant={calendarPermission === 'authorized' ? 'outline' : 'primary'}
              size="sm"
            />
          }
        />
      </View>

      {/* Usage */}
      {monthlyUsage ? (
        <View testID="settings-usage-section" style={styles.section}>
          <SectionLabel>AI usage this month</SectionLabel>
          <View style={styles.usageAmountRow}>
            <Text style={[styles.usageAmount, { color: themeColors.foreground }]}>
              {formatUsd(monthlyUsage.totalCostUsd)}
            </Text>
            <Text style={[styles.usageCap, { color: themeColors['text-secondary'] }]}>
              of {formatUsd(monthlyUsage.limitUsd)} · {usagePercent.toFixed(0)}%
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
          <Text style={[styles.usageNote, { color: themeColors['text-tertiary'] }]}>
            {monthlyUsage.isOverLimit
              ? "You've reached this month's free AI usage limit. It resets at the start of next month."
              : 'Resets at the start of next month.'}
          </Text>
        </View>
      ) : null}

      {/* Privacy */}
      <View style={styles.section}>
        <SectionLabel>{t.settings.sections.privacy}</SectionLabel>
        <SettingsRow
          icon="faceid"
          label={t.settings.lockWithFaceId}
          accessory={
            <Switch
              value={state.appLock}
              onValueChange={(value) => {
                dispatch({ type: 'set-app-lock', appLock: value });
                setAppLockEnabled(value);
              }}
            />
          }
        />
        <SettingsRow
          icon="eye.slash"
          label={t.settings.preventScreenshots}
          accessory={
            <Switch
              value={state.preventScreenshots}
              onValueChange={(value) => {
                dispatch({ type: 'set-prevent-screenshots', preventScreenshots: value });
                setPreventScreenshots(value);
              }}
            />
          }
        />
      </View>

      {/* Chats */}
      <View style={styles.section}>
        <SectionLabel>{t.settings.sections.chats}</SectionLabel>
        <SettingsRow
          icon="archivebox"
          label={t.settings.archivedChats}
          onPress={onArchivedChatsPress}
          accessory={
            <AppIcon name="chevron.right" size={12} tintColor={themeColors['icon-muted']} />
          }
        />
      </View>

      {/* Danger zone */}
      <View style={styles.section}>
        <SettingsRow
          icon="rectangle.portrait.and.arrow.right"
          label={t.settings.signOut.label}
          onPress={onLogoutPress}
        />
        <SettingsRow
          icon="trash"
          label={t.settings.deleteAccount.label}
          onPress={onDeleteAccountPress}
          destructive
        />
      </View>
    </ScrollView>
  );
}

export default Settings;

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderRadius: radii.xl,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '700',
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
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: componentSizes.xl,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowDescription: {
    fontSize: 13,
  },
  rowLabel: {
    fontSize: fontSizes.md,
  },
  rowLabelGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowTouchable: {
    paddingHorizontal: 16,
  },
  saveRow: {
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: spacing[6],
    paddingBottom: 24,
    paddingTop: 12,
  },
  section: {
    gap: spacing[2],
  },
  sectionLabel: {
    fontSize: fontSizes.footnote,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  statusText: {
    fontSize: 13,
  },
  usageAmount: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  usageAmountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  usageCap: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  usageFill: {
    borderRadius: 4,
    height: 4,
  },
  usageNote: {
    fontSize: 12,
    paddingHorizontal: 16,
  },
  usageTrack: {
    borderRadius: 4,
    height: 4,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
});
