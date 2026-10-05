import { Redirect } from 'expo-router';

import { CHAT_ROUTE } from '~/services/navigation/routes';

export default function HomeRoute() {
  return <Redirect href={CHAT_ROUTE} />;
}
