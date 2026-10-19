import { redirect } from 'react-router';

import { getServerSession } from '~/lib/auth.server';

import type { Route } from './+types/home';

export function meta() {
  return [
    { title: 'Hominem Finance — Muse MCP' },
    {
      name: 'description',
      content:
        'Connect your reconciled money ledger to your own Muse over MCP. Ask plain-English questions about balances, spending, categories and runway.',
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getServerSession(request);
  if (user) {
    throw redirect('/finance', { headers });
  }
  return null;
}

export default function Home() {
  return (
    <iframe
      title="Hominem Finance homepage"
      src="/Hominem%20Finance%20%E2%80%94%20Muse%20MCP.html"
      sandbox="allow-scripts allow-top-navigation-by-user-activation"
      allow="autoplay"
      className="fixed inset-0 h-dvh w-full border-0"
    />
  );
}
