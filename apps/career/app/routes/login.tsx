import { redirect } from 'react-router';

import { Route } from './+types/login';

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  throw redirect(`/auth${url.search}`);
}

export default function LoginRedirect() {
  return null;
}
