import { redirect } from 'react-router';

import { AccountPage } from '~/components/account/AccountPage';
import { handleAccountAction } from '~/lib/account/account.actions.server';
import { loadAccountPageData } from '~/lib/account/account.loader.server';
import { portfolioContext, userContext } from '~/lib/middleware';

import { Route } from './+types/account';

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const currentPortfolio = context.get(portfolioContext);

  if (!currentPortfolio) {
    // loadPortfolioMiddleware should always ensure a portfolio for signed-in users.
    throw redirect('/work');
  }

  return loadAccountPageData({
    user,
    currentPortfolio,
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const formData = await request.formData();

  return handleAccountAction({ formData, user });
}

export function meta() {
  return [
    { title: 'Account' },
    { name: 'description', content: 'Manage your portfolio and account settings' },
  ];
}

export default function Account({ loaderData }: Route.ComponentProps) {
  return <AccountPage loaderData={loaderData} />;
}
