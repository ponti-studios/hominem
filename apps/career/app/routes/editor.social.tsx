import { and, eq, inArray } from 'drizzle-orm'
import { Github, Globe, Link2, Linkedin, Twitter } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import type { ActionFunctionArgs, MetaFunction } from 'react-router'
import { useFetcher, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/lib/db'
import type { NewSocialLinks, SocialLinks } from '~/lib/db/schema'
import { socialLinks } from '~/lib/db/schema'
import { cn } from '~/lib/utils'
import { useToast } from '../hooks/useToast'
import type { FullPortfolio } from '../lib/portfolio.server'
import { createSuccessResponse, parseFormData, withAuthAction } from '../lib/route-utils'

// Use schema types
interface SocialLinksFormValues extends Partial<NewSocialLinks> {}

interface SocialLinksEditorSectionProps {
  socialLinks?: SocialLinks | null
  portfolioId: string
}

function SocialLinksEditorSection({
  socialLinks: initialSocialLinks,
  portfolioId,
}: SocialLinksEditorSectionProps) {
  const fetcher = useFetcher()
  const { addToast } = useToast()
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm<SocialLinksFormValues>({
    defaultValues: initialSocialLinks || {},
    mode: 'onChange',
  })

  const watchedValues = watch()

  useEffect(() => {
    reset(initialSocialLinks || {})
  }, [initialSocialLinks, reset])

  // Handle fetcher errors and success
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string; message?: string }
      if (result.success) {
        addToast(result.message || 'Social links saved successfully!', 'success')
      } else {
        addToast(`Failed to save social links: ${result.error || 'Unknown error'}`, 'error')
      }
    }
  }, [fetcher.state, fetcher.data, addToast])

  const onSubmit: SubmitHandler<SocialLinksFormValues> = (formData) => {
    if (!isDirty) {
      addToast('No changes to save in social links.', 'info')
      return
    }

    // Clean up the data - only send essential fields
    const socialLinksToSave = {
      id: formData.id,
      github: formData.github,
      linkedin: formData.linkedin,
      twitter: formData.twitter,
      website: formData.website,
      portfolioId,
    }

    const formData2 = new FormData()
    formData2.append('socialLinksData', JSON.stringify([socialLinksToSave]))

    fetcher.submit(formData2, {
      method: 'POST',
      action: '/editor/social',
    })
  }

  const isSaving = fetcher.state === 'submitting'

  return (
    <section className="container flex flex-col gap-4 mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">Social</h2>
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
          <div className="form-group">
            <label htmlFor="github" className="label flex items-center gap-2">
              <Github className="w-4 h-4 text-gray-600" />
              GitHub Username
            </label>
            <div className="flex">
              <div className="inline-flex items-center px-3 text-sm text-gray-500 border border-r-0 border-gray-300 rounded-l-md">
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
          <div className="form-group">
            <label htmlFor="linkedin" className="label flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-gray-600" />
              LinkedIn Username
            </label>
            <div className="flex">
              <div className="inline-flex items-center px-3 text-sm text-gray-500 border border-r-0 border-gray-300 rounded-l-md">
                linkedin.com/in/
              </div>
              <input
                id="linkedin"
                type="text"
                placeholder="johnsmith"
                className={cn(
                  'input rounded-l-none border-l-0',
                  errors.linkedin ? 'input-error' : ''
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
          <div className="form-group">
            <label htmlFor="twitter" className="label flex items-center gap-2">
              <Twitter className="w-4 h-4 text-gray-600" />
              Twitter Username
            </label>
            <div className="flex">
              <div className="inline-flex items-center px-3 text-sm text-gray-500 border border-r-0 border-gray-300 rounded-l-md">
                twitter.com/
              </div>
              <input
                id="twitter"
                type="text"
                placeholder="username"
                className={`input rounded-l-none border-l-0 ${errors.twitter ? 'input-error' : ''}`}
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
          <div className="form-group">
            <label htmlFor="website" className="label flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-600" />
              Website URL
            </label>
            <input
              id="website"
              type="url"
              placeholder="https://yourwebsite.com"
              className={`input ${errors.website ? 'input-error' : ''}`}
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
          <div className="mt-8 p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Preview</h3>
            <div className="flex flex-wrap gap-3">
              {watchedValues.github && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                  <Github className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{watchedValues.github}</span>
                </div>
              )}
              {watchedValues.linkedin && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                  <Linkedin className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{watchedValues.linkedin}</span>
                </div>
              )}
              {watchedValues.twitter && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                  <Twitter className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{watchedValues.twitter}</span>
                </div>
              )}
              {watchedValues.website && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                  <Globe className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{watchedValues.website}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </section>
  )
}

export const meta: MetaFunction = () => [{ title: 'Social - Portfolio Editor | Craftd' }]

type SocialLinkInsert = typeof socialLinks.$inferInsert

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData()

    const socialLinksDataResult = parseFormData<SocialLinkInsert[]>(formData, 'socialLinksData')
    if ('success' in socialLinksDataResult && !socialLinksDataResult.success) {
      return socialLinksDataResult
    }
    const socialLinksData = socialLinksDataResult as SocialLinkInsert[]
    // Get all current social link IDs for this portfolio
    const current = await db
      .select({ id: socialLinks.id })
      .from(socialLinks)
      .where(eq(socialLinks.portfolioId, socialLinksData[0]?.portfolioId))
    const currentIds = current.map((l) => l.id)
    const submittedIds = socialLinksData.filter((l) => l.id).map((l) => l.id)
    // Delete removed links
    if (currentIds.length > 0) {
      const toDelete = currentIds.filter((id) => !submittedIds.includes(id))
      if (toDelete.length > 0) {
        await db
          .delete(socialLinks)
          .where(
            and(
              eq(socialLinks.portfolioId, socialLinksData[0]?.portfolioId),
              inArray(socialLinks.id, toDelete)
            )
          )
      }
    }
    // Upsert (insert or update)
    for (const link of socialLinksData) {
      if (link.id) {
        await db.update(socialLinks).set(link).where(eq(socialLinks.id, link.id))
      } else {
        await db.insert(socialLinks).values(link)
      }
    }
    return createSuccessResponse(null, 'Social links saved successfully')
  })
}

export default function EditorSocial() {
  const portfolio = useOutletContext<FullPortfolio>()

  return <SocialLinksEditorSection socialLinks={portfolio.socialLinks} portfolioId={portfolio.id} />
}
