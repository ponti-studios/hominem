import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { ArrowRight, CheckCircle2, Copy, Edit3, Eye, Gift, Share2, Sparkles } from 'lucide-react';
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
  const shareTips = () =>
    document.getElementById('sharing-tips')?.scrollIntoView({ behavior: 'smooth' });
  const copyPortfolioLink = async () => {
    if (!portfolioPath) return;

    await navigator.clipboard.writeText(new URL(portfolioPath, window.location.origin).toString());
    setCopyLabel('Copied');
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="space-y-4 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-success/30 bg-success/10">
          <CheckCircle2 className="size-5 text-success" />
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="border-success/30 bg-success/10 text-foreground">
            Portfolio created
          </Badge>
          <h1 className="text-xl font-semibold text-foreground">Your portfolio is ready</h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Your professional portfolio is live and ready to refine, share, and use in your next
            career conversation.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={goToPortfolio} variant="primary">
            <Eye className="size-4" />
            View Portfolio
            <ArrowRight className="size-4" />
          </Button>
          <Button type="button" onClick={shareTips} variant="outline">
            <Share2 className="size-4" />
            Sharing tips
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ['Portfolio Created', 'Your portfolio is live with your experience and skills organized.'],
          ['Search Ready', 'Content is structured so recruiters can scan it quickly.'],
          ['Ready to Share', 'Use your portfolio link in applications, networking, and interviews.'],
        ].map(([title, description]) => (
          <Card key={title}>
            <CardContent className="space-y-2">
              <Sparkles className="size-4 text-accent" />
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next steps</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Button
              type="button"
              onClick={() => navigate('/editor')}
              variant="ghost"
              className="h-auto justify-start gap-3 border border-border p-3 text-left"
            >
              <Edit3 className="size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-medium text-foreground">Customize portfolio</span>
                <span className="text-xs text-muted-foreground">
                  Fine-tune sections, projects, stats, and social links.
                </span>
              </span>
            </Button>
            <Button
              type="button"
              onClick={shareTips}
              variant="ghost"
              className="h-auto justify-start gap-3 border border-border p-3 text-left"
            >
              <Share2 className="size-4 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-medium text-foreground">Share intentionally</span>
                <span className="text-xs text-muted-foreground">
                  Add the link to profiles, email signatures, and applications.
                </span>
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="sharing-tips">
        <CardContent className="space-y-4">
          <div className="space-y-1 text-center">
            <Gift className="mx-auto size-5 text-accent" />
            <p className="text-sm font-semibold text-foreground">Sharing tips</p>
            <p className="text-xs text-muted-foreground">Put the portfolio where hiring teams already look.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['LinkedIn', 'Add it to your profile, About section, and a short launch post.'],
              ['Applications', 'Include it in your resume header, cover letters, and follow-up emails.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          {portfolioPath ? (
            <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {portfolioPath}
              </code>
              <Button type="button" onClick={copyPortfolioLink} variant="primary" size="sm">
                <Copy className="size-4" />
                {copyLabel}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
