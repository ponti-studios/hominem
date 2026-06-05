import { type LoaderFunctionArgs, redirect } from 'react-router';

export function loader({ params }: LoaderFunctionArgs) {
  return redirect(params.noteId ? `/inbox/note/${params.noteId}` : '/inbox');
}

export default function RedirectNoteChat() {
  return null;
}
