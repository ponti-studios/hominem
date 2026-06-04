import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { ArrowRight, CheckCircle2, Copy, Eye } from 'lucide-react';
import { useState } from 'react';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';

import { getFullUserPortfolio } from '../lib/portfolio.server';
import { withAuthLoader } from '../lib/route-utils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Welcome to Craftd! - Your Portfolio is Ready' },
    {
      name: 'description',
      content: 'Congratulations! Your professional portfolio is now live and ready to share.',
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    const portfolio = await getFullUserPortfolio(user.id);

    return {
      portfolio: portfolio
        ? {
            slug: portfolio.slug,
            title: portfolio.title,
          }
        : null,
    };
  });
}

export default function OnboardingComplete() {
  const { portfolio } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [copyLabel, setCopyLabel] = useState('Copy Link');
  const portfolioPath = portfolio ? `/p/${portfolio.slug}` : null;

  const goToPortfolio = () => navigate(portfolioPath ?? '/account');
  const copyPortfolioLink = async () => {
    if (!portfolioPath) return;
    await navigator.clipboard.writeText(new URL(portfolioPath, window.location.origin).toString());
    setCopyLabel('Copied');
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-success/30 bg-success/10">
        <CheckCircle2 className="size-5 text-success" />
      </div>

      <div className="space-y-2">
        <Badge variant="outline" className="border-success/30 bg-success/10 text-foreground">
          Portfolio created
        </Badge>
        <h1 className="text-xl font-semibold text-foreground">Your portfolio is ready</h1>
        <p className="text-sm text-muted-foreground">
          Live and ready to share. Add the link to your resume, LinkedIn, and job applications.
        </p>
      </div>

      {portfolioPath ? (
        <div className="flex items-center gap-2 rounded-md border bg-secondary px-3 text-left">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
            {portfolioPath}
          </code>
          <Button type="button" onClick={copyPortfolioLink} variant="ghost" size="xs">
            <Copy className="size-3" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <Button type="button" onClick={goToPortfolio} variant="primary">
          <Eye className="size-4" />
          View Portfolio
          <ArrowRight className="size-4" />
        </Button>
        <Button type="button" onClick={() => navigate('/editor')} variant="outline">
          Customize
        </Button>
      </div>
    </div>
  );
}
