import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { ArrowRight, CheckCircle2, Edit3, Eye, Gift, Share2, Sparkles } from 'lucide-react';
import type { MetaFunction } from 'react-router';
import { useNavigate } from 'react-router';

export const meta: MetaFunction = () => {
  return [
    { title: 'Welcome to Craftd! - Your Portfolio is Ready' },
    {
      name: 'description',
      content: 'Congratulations! Your professional portfolio is now live and ready to share.',
    },
  ];
};

export default function OnboardingComplete() {
  const navigate = useNavigate();

  const goToPortfolio = () => navigate('/account');
  const shareTips = () =>
    document.getElementById('sharing-tips')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <section className="space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-success/30 bg-success/10">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <div className="space-y-3">
          <Badge variant="outline" className="border-success/30 bg-success/10 text-foreground">
            Portfolio created
          </Badge>
          <h1 className="heading-1 text-foreground">Your portfolio is ready</h1>
          <p className="body-1 mx-auto max-w-2xl text-muted-foreground">
            Your professional portfolio is live and ready to refine, share, and use in your next
            career conversation.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={goToPortfolio} variant="primary" size="lg">
            <Eye className="size-5" />
            View Your Portfolio
            <ArrowRight className="size-4" />
          </Button>
          <Button type="button" onClick={shareTips} variant="outline" size="lg">
            <Share2 className="size-5" />
            Learn How to Share
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [
            'Portfolio Created',
            'Your portfolio is now live with your experience and skills organized.',
          ],
          [
            'Search Ready',
            'Your content is structured so recruiters and hiring teams can scan it quickly.',
          ],
          [
            'Ready to Share',
            'Use your portfolio link in applications, networking, and interviews.',
          ],
        ].map(([title, description]) => (
          <Card key={title} className="border-border bg-card">
            <CardContent className="space-y-3 p-5">
              <Sparkles className="size-5 text-accent" />
              <h2 className="heading-4 text-foreground">{title}</h2>
              <p className="body-3 text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border bg-card">
        <CardContent className="space-y-5 p-6">
          <h2 className="heading-2 text-foreground">Next steps</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              type="button"
              onClick={() => navigate('/editor')}
              variant="ghost"
              className="h-auto justify-start gap-4 border border-border p-5 text-left"
            >
              <Edit3 className="size-5 text-accent" />
              <span>
                <span className="block font-medium text-foreground">Customize your portfolio</span>
                <span className="body-4 text-muted-foreground">
                  Fine-tune sections, projects, stats, and social links.
                </span>
              </span>
            </Button>
            <Button
              type="button"
              onClick={shareTips}
              variant="ghost"
              className="h-auto justify-start gap-4 border border-border p-5 text-left"
            >
              <Share2 className="size-5 text-accent" />
              <span>
                <span className="block font-medium text-foreground">Share intentionally</span>
                <span className="body-4 text-muted-foreground">
                  Add the link to profiles, email signatures, and applications.
                </span>
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="sharing-tips" className="border-border bg-card">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2 text-center">
            <Gift className="mx-auto size-8 text-accent" />
            <h2 className="heading-2 text-foreground">Sharing tips</h2>
            <p className="body-3 text-muted-foreground">
              Put the portfolio where hiring teams already look.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['LinkedIn', 'Add it to your profile, About section, and a short launch post.'],
              [
                'Applications',
                'Include it in your resume header, cover letters, and follow-up emails.',
              ],
            ].map(([title, description]) => (
              <div key={title} className="rounded-md border border-border bg-muted/40 p-4">
                <h3 className="heading-4 text-foreground">{title}</h3>
                <p className="body-3 mt-2 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-accent/30 bg-accent/10 p-4 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
              https://craftd.dev/your-name
            </code>
            <Button type="button" variant="primary" size="sm">
              Copy Link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
