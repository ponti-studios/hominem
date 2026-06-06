import { redirect } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';

export async function action({ request }: ActionFunctionArgs) {
  try {
    await request.json();
  } catch {
    return redirect('/auth?error=Passkey+sign-in+failed.+Please+try+again.');
  }

  return redirect('/inbox');
}

export default function PasskeyCallback() {
  return null;
}
