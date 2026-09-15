import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { StyleSheet, View } from 'react-native';

import t from '~/translations';

import { SectionLabel, SettingsRow } from './SettingsRow';

function formatUpdateDate(date: Date | null) {
  if (!date) {
    return null;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * `expo-updates` is only enabled for production builds.
 * Development and E2E builds do not have OTA updates, so they fall back to
 * a "development build" label.
 *
 * @see app.config.js
 */

function getUpdateDescription() {
  if (!Updates.isEnabled) {
    return t.settings.about.developmentBuild;
  }
  if (Updates.isEmbeddedLaunch) {
    return t.settings.about.onLatestBuild;
  }
  return formatUpdateDate(Updates.createdAt) ?? t.settings.about.updated;
}

export function AboutSection() {
  const versionLabel = Application.nativeBuildVersion
    ? `${Application.nativeApplicationVersion} (${Application.nativeBuildVersion})`
    : (Application.nativeApplicationVersion ?? t.settings.about.unknown);

  return (
    <View style={styles.aboutSection}>
      <SectionLabel>{t.settings.sections.about}</SectionLabel>
      <SettingsRow
        icon="info.circle"
        label={t.settings.about.version}
        description={versionLabel}
        testID="settings-about-version"
      />
      <SettingsRow
        icon="arrow.triangle.2.circlepath"
        label={t.settings.about.update}
        description={getUpdateDescription()}
        testID="settings-about-update"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  aboutSection: { gap: 8 },
});
