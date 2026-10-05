import { Stack } from 'expo-router';

import { NewChatScreen } from '~/components/home/NewChatScreen';

export default function NewChatRoute() {
  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <NewChatScreen />
    </>
  );
}
