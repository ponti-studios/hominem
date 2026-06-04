import type { CareerSocialLinksRecord } from '@hominem/db';
import { CareerRepository, getDb } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Github, Globe, Link2, Linkedin, Twitter } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { useFetcher, useOutletContext } from 'react-router';

import { cn } from '~/lib/utils';

import { useToast } from '../hooks/useToast';
import type { FullPortfolio } from '../lib/portfolio.server';
import { createSuccessResponse, parseFormData, withAuthAction } from '../lib/route-utils';

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
  const { addToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm<SocialLinksFormValues>({
    defaultValues: initialSocialLinks || {},
    mode: 'onChange',
  });

  const watchedValues = watch();

  useEffect(() => {
    reset(initialSocialLinks || {});
  }, [initialSocialLinks, reset]);

  // Handle fetcher errors and success
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string; message?: string };
      if (result.success) {
        addToast(result.message || 'Social links saved successfully!', 'success');
      } else {
        addToast(`Failed to save social links: ${result.error || 'Unknown error'}`, 'error');
      }
    }
  }, [fetcher.state, fetcher.data, addToast]);

  const onSubmit: SubmitHandler<SocialLinksFormValues> = (formData) => {
    if (!isDirty) {
      addToast('No changes to save in social links.', 'info');
      return;
    }

    // Clean up the data - only send essential fields
    const socialLinksToSave = {
      id: formData.id,
      github: formData.github,
      linkedin: formData.linkedin,
      twitter: formData.twitter,
      website: formData.website,
      portfolio_id,
    };

    const formData2 = new FormData();
    formData2.append('socialLinksData', JSON.stringify([socialLinksToSave]));

    fetcher.submit(formData2, {
      method: 'POST',
      action: '/editor/social',
    });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <section className="container flex flex-col gap-4 mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Social</h2>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            type="submit"
            form="social-form"
            disabled={isSaving || !isDirty}
            variant="primary"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <form
        id="social-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-2 md:space-y-6 card"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GitHub */}
          <div className="flex flex-col gap-2">
            <label htmlFor="github" className="label flex items-center gap-2">
              <Github className="w-4 h-4 text-muted-foreground" />
              GitHub Username
            </label>
            <div className="flex">
              <div className="inline-flex items-center px-3 text-sm text-muted-foreground border border-r-0 border-border rounded-l-md">
                github.com/
              </div>
              <input
                id="github"
                type="text"
                placeholder="octocat"
                className={cn('input rounded-l-none border-l-0', {
                  'input-error': errors.github,
                })}
                {...register('github', {
                  pattern: {
                    value: /^[a-zA-Z0-9]([a-zA-Z0-9-])*[a-zA-Z0-9]$/,
                    message: 'Please enter a valid GitHub username',
                  },
                })}
              />
            </div>
            {errors.github && <p className="error-message">{errors.github.message}</p>}
          </div>

          {/* LinkedIn */}
          <div className="flex flex-col gap-2">
            <label htmlFor="linkedin" className="label flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
              LinkedIn Username
            </label>
            <div className="flex">
              <div className="inline-flex items-center px-3 text-sm text-muted-foreground border border-r-0 border-border rounded-l-md">
                linkedin.com/in/
              </div>
              <input
                id="linkedin"
                type="text"
                placeholder="johnsmith"
                className={cn(
                  'input rounded-l-none border-l-0',
                  errors.linkedin ? 'input-error' : '',
                )}
                {...register('linkedin', {
                  pattern: {
                    value: /^[a-zA-Z0-9-]+$/,
                    message: 'Please enter a valid LinkedIn username',
                  },
                })}
              />
            </div>
            {errors.linkedin && <p className="error-message">{errors.linkedin.message}</p>}
          </div>

          {/* Twitter */}
          <div className="flex flex-col gap-2">
            <label htmlFor="twitter" className="label flex items-center gap-2">
              <Twitter className="w-4 h-4 text-muted-foreground" />
              Twitter Username
            </label>
            <div className="flex">
              <div className="inline-flex items-center px-3 text-sm text-muted-foreground border border-r-0 border-border rounded-l-md">
                twitter.com/
              </div>
              <input
                id="twitter"
                type="text"
                placeholder="username"
                className={cn(
                  'input rounded-l-none border-l-0',
                  errors.twitter ? 'input-error' : '',
                )}
                {...register('twitter', {
                  pattern: {
                    value: /^[a-zA-Z0-9_]+$/,
                    message: 'Please enter a valid Twitter username',
                  },
                })}
              />
            </div>
            {errors.twitter && <p className="error-message">{errors.twitter.message}</p>}
          </div>

          {/* Website */}
          <div className="flex flex-col gap-2">
            <label htmlFor="website" className="label flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              Website URL
            </label>
            <input
              id="website"
              type="url"
              placeholder="https://yourwebsite.com"
              className={cn('input', errors.website ? 'input-error' : '')}
              {...register('website', {
                pattern: {
                  value: /^https?:\/\/.+\..+/,
                  message: 'Please enter a valid URL (including http:// or https://)',
                },
              })}
            />
            {errors.website && <p className="error-message">{errors.website.message}</p>}
          </div>
        </div>

        {/* Preview Section */}
        {(watchedValues.github ||
          watchedValues.linkedin ||
          watchedValues.twitter ||
          watchedValues.website) && (
          <div className="mt-8 p-6 rounded-lg border border-border">
            <h3 className="text-lg font-medium text-foreground mb-4">Preview</h3>
            <div className="flex flex-wrap gap-3">
              {watchedValues.github && (
                <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
                  <Github className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{watchedValues.github}</span>
                </div>
              )}
              {watchedValues.linkedin && (
                <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
                  <Linkedin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{watchedValues.linkedin}</span>
                </div>
              )}
              {watchedValues.twitter && (
                <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
                  <Twitter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{watchedValues.twitter}</span>
                </div>
              )}
              {watchedValues.website && (
                <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{watchedValues.website}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

export const meta: MetaFunction = () => [{ title: 'Social - Portfolio Editor | Craftd' }];

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData();

    const socialLinksDataResult = parseFormData<
      Array<SocialLinksFormValues & { portfolio_id: string }>
    >(formData, 'socialLinksData');
    if ('success' in socialLinksDataResult && !socialLinksDataResult.success) {
      return socialLinksDataResult;
    }

    const socialLinksData = socialLinksDataResult as Array<
      SocialLinksFormValues & { portfolio_id: string }
    >;
    const socialLinksPayload = socialLinksData[0];

    if (!socialLinksPayload?.portfolio_id) {
      throw new Error('Missing portfolio_id');
    }

    await CareerRepository.saveSocialLinks(getDb(), user.id, socialLinksPayload.portfolio_id, {
      id: socialLinksPayload.id,
      github: socialLinksPayload.github,
      linkedin: socialLinksPayload.linkedin,
      twitter: socialLinksPayload.twitter,
      website: socialLinksPayload.website,
    });

    return createSuccessResponse(null, 'Social links saved successfully');
  });
}

export default function EditorSocial() {
  const portfolio = useOutletContext<FullPortfolio>();

  return (
    <SocialLinksEditorSection social_links={portfolio.social_links} portfolio_id={portfolio.id} />
  );
}
