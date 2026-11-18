import { Alert, StyleSheet, View } from 'react-native';

import { SettingsGroup, SettingsRow } from '~/components/settings/SettingsRow';
import t from '~/translations';

function showDeleteAccountAlert() {
  Alert.alert(t.settings.deleteAccount.alertTitle, t.settings.deleteAccount.alertMessage, [
    { text: t.settings.deleteAccount.ok, style: 'default' },
  ]);
}

export function DangerZoneSection({ onLogoutPress }: { onLogoutPress: () => void }) {
  return (
    <View style={styles.dangerSection}>
      <SettingsGroup>
        <SettingsRow
          icon="rectangle.portrait.and.arrow.right"
          label={t.settings.signOut.label}
          onPress={onLogoutPress}
        />
        <SettingsRow
          icon="trash"
          label={t.settings.deleteAccount.label}
          onPress={showDeleteAccountAlert}
          destructive
        />
      </SettingsGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  dangerSection: { gap: 8 },
});
