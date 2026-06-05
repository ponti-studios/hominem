import { redirect } from 'react-router';

export function loader() {
  return redirect('/inbox');
}

export default function RedirectToInbox() {
  return null;
}
