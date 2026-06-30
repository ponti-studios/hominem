import type { CareerSocialLinksRecord } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';
import { Button } from '@hominem/ui';
import { Card, CardContent, Input } from '@hominem/ui';
import { Github, Globe, Linkedin, SaveIcon, Twitter } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useFetcher } from 'react-router';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/social';

export const meta: Route.MetaFunction = () => [{ title: 'Social | Craftd' }];

interface SocialLinksFormValues {
  id?: string;
  github?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  website?: string | null;
}

interface SocialLinksEditorSectionProps {
  social_links?: CareerSocialLinksRecord | null;
  portfolio_id: string;
}

function SocialLinksEditorSection({
  social_links: initialSocialLinks,
  portfolio_id,
}: SocialLinksEditorSectionProps) {
  const fetcher = useFetcher();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
  } = useForm<SocialLinksFormValues>({
    defaultValues: initialSocialLinks || {},
    mode: 'onChange',
  });

  useEffect(() => {
    reset(initialSocialLinks || {});
  }, [initialSocialLinks, reset]);

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher,
    errorMessage: "We couldn't save your social links. Try again.",
  });

  const onSubmit: SubmitHandler<SocialLinksFormValues> = (formData) => {
    if (!isDirty) return;

    const formData2 = new FormData();
    formData2.append(
      'socialLinksData',
      JSON.stringify([
        {
          id: formData.id,
          github: formData.github,
          linkedin: formData.linkedin,
          twitter: formData.twitter,
          website: formData.website,
          portfolio_id,
        },
      ]),
    );

    clearSubmissionError();
    fetcher.submit(formData2, { method: 'POST', action: '/social' });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <section className="flex flex-col gap-6">
      <h2 className="heading-2 text-foreground">Social</h2>

      <Card>
        <CardContent className="p-6">
          <form id="social-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <FormErrorAlert title="Social links weren't saved" message={submissionError} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* GitHub */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="github"
                  className="subheading-4 text-text-primary flex items-center gap-2"
                >
                  <Github className="size-4 text-muted-foreground" />
                  GitHub
                </label>
                <div className="flex">
                  <span className="inline-flex items-center shrink-0 px-3 body-3 text-muted-foreground border border-r-0 border-input rounded-l-md bg-base">
                    github.com/
                  </span>
                  <Input
                    id="github"
                    type="text"
                    placeholder="username"
                    className="rounded-l-none"
                    aria-invalid={errors.github ? true : undefined}
                    {...register('github', {
                      pattern: {
                        value: /^[a-zA-Z0-9]([a-zA-Z0-9-])*[a-zA-Z0-9]$/,
                        message: 'Enter a valid GitHub username',
                      },
                    })}
                  />
                </div>
                {errors.github && (
                  <p className="body-4 text-destructive">{errors.github.message}</p>
                )}
              </div>

              {/* LinkedIn */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="linkedin"
                  className="subheading-4 text-text-primary flex items-center gap-2"
                >
                  <Linkedin className="size-4 text-muted-foreground" />
                  LinkedIn
                </label>
                <div className="flex">
                  <span className="inline-flex items-center shrink-0 px-3 body-3 text-muted-foreground border border-r-0 border-input rounded-l-md bg-base">
                    linkedin.com/in/
                  </span>
                  <Input
                    id="linkedin"
                    type="text"
                    placeholder="username"
                    className="rounded-l-none"
                    aria-invalid={errors.linkedin ? true : undefined}
                    {...register('linkedin', {
                      pattern: {
                        value: /^[a-zA-Z0-9-]+$/,
                        message: 'Enter a valid LinkedIn username',
                      },
                    })}
                  />
                </div>
                {errors.linkedin && (
                  <p className="body-4 text-destructive">{errors.linkedin.message}</p>
                )}
              </div>

              {/* Twitter */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="twitter"
                  className="subheading-4 text-text-primary flex items-center gap-2"
                >
                  <Twitter className="size-4 text-muted-foreground" />
                  Twitter / X
                </label>
                <div className="flex">
                  <span className="inline-flex items-center shrink-0 px-3 body-3 text-muted-foreground border border-r-0 border-input rounded-l-md bg-base">
                    x.com/
                  </span>
                  <Input
                    id="twitter"
                    type="text"
                    placeholder="username"
                    className="rounded-l-none"
                    aria-invalid={errors.twitter ? true : undefined}
                    {...register('twitter', {
                      pattern: {
                        value: /^[a-zA-Z0-9_]+$/,
                        message: 'Enter a valid Twitter username',
                      },
                    })}
                  />
                </div>
                {errors.twitter && (
                  <p className="body-4 text-destructive">{errors.twitter.message}</p>
                )}
              </div>

              {/* Website */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="website"
                  className="subheading-4 text-text-primary flex items-center gap-2"
                >
                  <Globe className="size-4 text-muted-foreground" />
                  Website
                </label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yoursite.com"
                  aria-invalid={errors.website ? true : undefined}
                  {...register('website', {
                    pattern: {
                      value: /^https?:\/\/.+\..+/,
                      message: 'Enter a valid URL starting with https://',
                    },
                  })}
                />
                {errors.website && (
                  <p className="body-4 text-destructive">{errors.website.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving || !isDirty}
                isLoading={isSaving}
                aria-label="Save social links"
              >
                <SaveIcon className="size-4" />
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext)!;
  const social_links = await db
    .selectFrom('app.social_links')
    .selectAll()
    .where('portfolio_id', '=', portfolio.id)
    .executeTakeFirst();
  return { social_links: social_links ?? null, portfolio_id: portfolio.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response('User not found', { status: 401 });
  }
  const formData = await request.formData();

  const socialLinksDataResult = parseFormData<
    Array<SocialLinksFormValues & { portfolio_id: string }>
  >(formData, 'socialLinksData');
  if ('success' in socialLinksDataResult && !socialLinksDataResult.success) {
    return { success: false, error: "Your social links couldn't be read. Refresh and try again." };
  }

  const socialLinksData = socialLinksDataResult as Array<
    SocialLinksFormValues & { portfolio_id: string }
  >;
  const socialLinksPayload = socialLinksData[0];

  if (!socialLinksPayload?.portfolio_id) {
    return { success: false, error: 'Choose a portfolio before saving social links.' };
  }

  try {
    await CareerRepository.saveSocialLinks(db, user.id, socialLinksPayload.portfolio_id, {
      id: socialLinksPayload.id,
      github: socialLinksPayload.github,
      linkedin: socialLinksPayload.linkedin,
      twitter: socialLinksPayload.twitter,
      website: socialLinksPayload.website,
    });

    return { success: true, message: 'Social links saved successfully' };
  } catch (error) {
    console.error('Failed to save social links:', error);
    return { success: false, error: "We couldn't save your social links. Try again." };
  }
}

export default function Social({ loaderData }: Route.ComponentProps) {
  return (
    <SocialLinksEditorSection
      social_links={loaderData.social_links}
      portfolio_id={loaderData.portfolio_id}
    />
  );
}
