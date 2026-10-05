import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { fontFamilies, useAppTheme } from '~/components/theme';

// The app's one navigation shell: a native tab bar. The system lays out the
// bar against the home indicator and keyboard; each tab owns a native stack
// (and so a native header) in its own folder.
export default function TabsLayout() {
  const { card, mutedForeground, primary } = useAppTheme().colors;
  return (
    <NativeTabs
      backgroundColor={card}
      iconColor={{ default: mutedForeground, selected: primary }}
      labelStyle={{
        default: { color: mutedForeground, fontFamily: fontFamilies.sans },
        selected: { color: primary, fontFamily: fontFamilies.sans },
      }}
      tintColor={primary}
    >
      <NativeTabs.Trigger name="stream">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} />
        <NativeTabs.Trigger.Label>Stream</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="time">
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} />
        <NativeTabs.Trigger.Label>Time</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'checkmark.circle', selected: 'checkmark.circle.fill' }}
        />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
