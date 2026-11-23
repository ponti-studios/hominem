import { NativeTabs } from 'expo-router/native-tabs';

import { SideDrawer } from '~/components/navigation/side-drawer';
import { fontFamilies, useAppTheme } from '~/components/theme';

// The app's one navigation shell: the system tab bar, on the system's own
// glass (so no background colour here). The system lays out the bar against
// the home indicator and keyboard; each tab owns a native stack (and so a
// native header) in its own folder.
export default function TabsLayout() {
  const { mutedForeground, primary } = useAppTheme().colors;
  return (
    <SideDrawer>
      <NativeTabs
        iconColor={{ default: mutedForeground, selected: primary }}
        labelStyle={{
          default: { color: mutedForeground, fontFamily: fontFamilies.sans },
          selected: { color: primary, fontFamily: fontFamilies.sans },
        }}
        tintColor={primary}
      >
        <NativeTabs.Trigger name="chat">
          <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="notes">
          <NativeTabs.Trigger.Icon sf={{ default: 'note.text', selected: 'note.text' }} />
          <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tasks">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'checkmark.circle', selected: 'checkmark.circle.fill' }}
          />
          <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </SideDrawer>
  );
}
