import React from 'react';
import { Platform, Switch } from 'react-native';


import { RowSeparator } from './RowSeparator';
import { SectionCard } from './SectionCard';
import { SectionLabel } from './SectionLabel';
import { SettingsRow } from './SettingsRow';

interface PrivacySectionProps {
  appLock: boolean;
  preventScreenshots: boolean;
  onAppLockChange: (value: boolean) => void;
  onPreventScreenshotsChange: (value: boolean) => void;
}

export function PrivacySection({
  appLock,
  preventScreenshots,
  onAppLockChange,
  onPreventScreenshotsChange,
}: PrivacySectionProps) {
  return (
    <>
      <SectionLabel>Privacy</SectionLabel>
      <SectionCard>
        <SettingsRow
          sf={Platform.OS === 'ios' ? 'faceid' : 'lock.fill'}
          label="Lock with Face ID"
          trailing={
            <Switch
              value={appLock}
              onValueChange={onAppLockChange}
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
              value={preventScreenshots}
              onValueChange={onPreventScreenshotsChange}
              accessibilityLabel="Prevent screenshots"
            />
          }
        />
      </SectionCard>
    </>
  );
}
