import { useState } from 'react';
import { Switch, View } from 'react-native';

import { SectionLabel, SettingsGroup, SettingsRow } from '~/components/settings/SettingsRow';
import { Chip } from '~/components/ui';
import {
  getAppearance,
  setAppearance,
  type AppearancePreference,
} from '~/services/system/appearance';
import { ensureNotificationPermission } from '~/services/tasks/notifications/expo-reminder-scheduler';
import {
  getMorningBriefEnabled,
  setMorningBriefEnabled,
} from '~/services/tasks/notifications/morning-brief';
import t from '~/translations';

const APPEARANCES: AppearancePreference[] = ['system', 'light', 'dark'];

// Appearance (follow the system, or pin light or dark) and the morning brief:
// one notification at 8:00 on days that have tasks.
export function PreferencesSection() {
  const [appearance, setAppearanceState] = useState(getAppearance);
  const [morningBrief, setMorningBriefState] = useState(getMorningBriefEnabled);

  const onMorningBriefChange = async (value: boolean) => {
    // Turning it on is the moment to ask for notifications; a "no" leaves it off.
    const allowed = !value || (await ensureNotificationPermission().catch(() => false));
    setMorningBriefState(value && allowed);
    setMorningBriefEnabled(value && allowed);
  };

  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{t.settings.sections.preferences}</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          accessory={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {APPEARANCES.map((option) => (
                <Chip
                  key={option}
                  label={t.settings.appearance[option]}
                  onPress={() => {
                    setAppearanceState(option);
                    setAppearance(option);
                  }}
                  testID={`settings-appearance-${option}`}
                  tone={appearance === option ? 'ink' : 'tonal'}
                />
              ))}
            </View>
          }
          icon="circle.lefthalf.filled"
          label={t.settings.appearance.label}
        />
        <SettingsRow
          accessory=<Switch
            onValueChange={(value) => {
              void onMorningBriefChange(value);
            }}
            testID="settings-morning-brief"
            value={morningBrief}
          />
          description={t.settings.morningBrief.description}
          icon="sun.max"
          label={t.settings.morningBrief.label}
        />
      </SettingsGroup>
    </View>
  );
}
