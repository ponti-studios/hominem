import { type LoaderFunctionArgs, redirect } from 'react-router';

export function loader({ params }: LoaderFunctionArgs) {
  return redirect(params.chatId ? `/inbox/chat/${params.chatId}` : '/inbox');
}

export default function RedirectChatDetail() {
  return null;
}
