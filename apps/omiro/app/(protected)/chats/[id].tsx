import { Redirect, Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { ChatScreen } from '~/components/inbox/ChatScreen';
import { CHAT_ROUTE } from '~/services/navigation/routes';

export default function ChatDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const canGoBack = navigation.canGoBack();

  if (!id) {
    return <Redirect href={CHAT_ROUTE} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      {canGoBack ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="BackButton"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      ) : (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="BackButton"
            icon="xmark"
            onPress={() => router.dismissTo(CHAT_ROUTE)}
          />
        </Stack.Toolbar>
      )}
      <ChatScreen id={id} />
    </>
  );
}
