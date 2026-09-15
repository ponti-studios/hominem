import { Stack } from 'expo-router';

import { NewChatScreen } from '~/components/home/NewChatScreen';
import { NavigationMenu } from '~/components/navigation/NavigationMenu';

export default function NewChatRoute() {
  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <NavigationMenu />, title: '' }} />
      <NewChatScreen />
    </>
  );
}
