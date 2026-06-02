import { eq } from 'drizzle-orm'
import { useEffect } from 'react'
import { Controller, useForm, type SubmitHandler } from 'react-hook-form'
import type { ActionFunctionArgs, MetaFunction } from 'react-router'
import { useFetcher, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { db } from '~/lib/db'
import type { NewPortfolio } from '~/lib/db/schema'
import { portfolios } from '~/lib/db/schema'
import { useToast } from '../hooks/useToast'
import type { FullPortfolio } from '../lib/portfolio.server'
import { createSuccessResponse, parseFormData, withAuthAction } from '../lib/route-utils'

export type BasicInfoFormValues = NewPortfolio

export const meta: MetaFunction = () => {
  return [{ title: 'Basic Info - Portfolio Editor | Craftd' }]
}

// Server action to save portfolio data
export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData()
    // Use Drizzle inferInsert type for type safety
    type PortfolioInsert = typeof portfolios.$inferInsert
    const portfolioDataResult = parseFormData<PortfolioInsert>(formData, 'portfolioData')
    if ('success' in portfolioDataResult && !portfolioDataResult.success) {
      return portfolioDataResult
    }
    const portfolioData = portfolioDataResult as PortfolioInsert
    // Check if portfolio exists
    const existingPortfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, user.id),
      columns: { id: true },
    })
    if (existingPortfolio) {
      await db
        .update(portfolios)
        .set({
          name: portfolioData.name,
          initials: portfolioData.initials,
          jobTitle: portfolioData.jobTitle,
          title: portfolioData.title,
          bio: portfolioData.bio,
          tagline: portfolioData.tagline,
          currentLocation: portfolioData.currentLocation,
          locationTagline: portfolioData.locationTagline,
          availabilityStatus: portfolioData.availabilityStatus,
          availabilityMessage: portfolioData.availabilityMessage,
          email: portfolioData.email,
          phone: portfolioData.phone,
          theme: portfolioData.theme,
          copyright: portfolioData.copyright,
          isPublic: portfolioData.isPublic,
          isActive: portfolioData.isActive,
          updatedAt: new Date(),
        })
        .where(eq(portfolios.id, existingPortfolio.id))
    } else {
      await db.insert(portfolios).values({
        userId: user.id,
        name: portfolioData.name,
        initials: portfolioData.initials,
        jobTitle: portfolioData.jobTitle,
        title: portfolioData.title,
        bio: portfolioData.bio,
        tagline: portfolioData.tagline,
        currentLocation: portfolioData.currentLocation,
        locationTagline: portfolioData.locationTagline,
        availabilityStatus: portfolioData.availabilityStatus,
        availabilityMessage: portfolioData.availabilityMessage,
        email: portfolioData.email,
        phone: portfolioData.phone,
        theme: portfolioData.theme,
        copyright: portfolioData.copyright,
        isPublic: portfolioData.isPublic ?? false,
        isActive: portfolioData.isActive ?? true,
        slug:
          portfolioData.slug ??
          portfolioData.name
            ?.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    return createSuccessResponse(null, 'Portfolio saved successfully')
  })
}

export default function EditorBasic() {
  // Consume portfolio provided by parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>()
  const fetcher = useFetcher()
  const { addToast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
    watch,
  } = useForm<BasicInfoFormValues>({
    defaultValues: {
      name: portfolio.name || '',
      initials: portfolio.initials || '',
      jobTitle: portfolio.jobTitle || '',
      bio: portfolio.bio || '',
      tagline: portfolio.tagline || '',
      currentLocation: portfolio.currentLocation || '',
      locationTagline: portfolio.locationTagline || '',
      email: portfolio.email || '',
      phone: portfolio.phone || '',
      availabilityStatus: portfolio.availabilityStatus || false,
      availabilityMessage: portfolio.availabilityMessage || '',
      // Add more fields as needed from the schema
    },
  })

  useEffect(() => {
    reset({
      name: portfolio.name || '',
      initials: portfolio.initials || '',
      jobTitle: portfolio.jobTitle || '',
      bio: portfolio.bio || '',
      tagline: portfolio.tagline || '',
      currentLocation: portfolio.currentLocation || '',
      locationTagline: portfolio.locationTagline || '',
      email: portfolio.email || '',
      phone: portfolio.phone || '',
      availabilityStatus: portfolio.availabilityStatus || false,
      availabilityMessage: portfolio.availabilityMessage || '',
    })
  }, [portfolio, reset])

  // Handle fetcher errors and success
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string; message?: string }
      if (result.success) {
        addToast(result.message || 'Basic info updated successfully!', 'success')
      } else {
        addToast(`Failed to update basic info: ${result.error || 'Unknown error'}`, 'error')
      }
    }
  }, [fetcher.state, fetcher.data, addToast])

  const onSubmit: SubmitHandler<BasicInfoFormValues> = (formData) => {
    if (!isDirty) {
      addToast('No changes made to submit.', 'info')
      return
    }

    // Clean up the data - only send essential fields
    const portfolioToSave = {
      id: portfolio.id,
      name: formData.name,
      initials: formData.initials,
      jobTitle: formData.jobTitle,
      bio: formData.bio,
      tagline: formData.tagline,
      currentLocation: formData.currentLocation,
      locationTagline: formData.locationTagline,
      email: formData.email,
      phone: formData.phone,
      availabilityStatus: formData.availabilityStatus,
      availabilityMessage: formData.availabilityMessage,
    }

    const formData2 = new FormData()
    formData2.append('portfolioData', JSON.stringify(portfolioToSave))

    fetcher.submit(formData2, {
      method: 'POST',
      action: '/editor/basic',
    })
  }

  const isSaving = fetcher.state === 'submitting'

  return (
    <section className="flex flex-col gap-8 mx-auto">
      <h2 className="text-2xl font-semibold text-gray-800">Basic Information</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information Card */}
        <div className="card space-y-6">
          <h3 className="text-lg font-medium text-gray-800">Personal Information</h3>
          <div>
            <label htmlFor="name" className="label">
              Full Name
            </label>
            <input
              id="name"
              {...register('name', { required: 'Name is required' })}
              className="input mt-1"
            />
            {errors.name && <p className="error-message">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="initials" className="label">
              Initials (Optional)
            </label>
            <input id="initials" {...register('initials')} maxLength={10} className="input mt-1" />
          </div>
          <div>
            <label htmlFor="jobTitle" className="label">
              Job Title / Professional Title
            </label>
            <input
              id="jobTitle"
              {...register('jobTitle', { required: 'Job title is required' })}
              className="input mt-1"
            />
            {errors.jobTitle && <p className="error-message">{errors.jobTitle.message}</p>}
          </div>
          <div>
            <label htmlFor="tagline" className="label">
              Tagline (Short, catchy phrase)
            </label>
            <input
              id="tagline"
              {...register('tagline', { required: 'Tagline is required' })}
              maxLength={500}
              className="input mt-1"
            />
            {errors.tagline && <p className="error-message">{errors.tagline.message}</p>}
          </div>
          <div>
            <label htmlFor="bio" className="label">
              Bio / Description
            </label>
            <textarea
              id="bio"
              {...register('bio', { required: 'Bio is required' })}
              rows={5}
              className="textarea mt-1"
            />
            {errors.bio && <p className="error-message">{errors.bio.message}</p>}
          </div>
        </div>

        {/* Contact Information Card */}
        <div className="card space-y-6">
          <h3 className="text-lg font-medium text-gray-800">Contact Information</h3>
          <div>
            <label htmlFor="email" className="label">
              Contact Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' },
              })}
              className="input mt-1"
            />
            {errors.email && <p className="error-message">{errors.email.message}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="label">
              Phone (Optional)
            </label>
            <input id="phone" {...register('phone')} maxLength={50} className="input mt-1" />
          </div>
        </div>

        {/* Location Information Card */}
        <div className="card space-y-6">
          <h3 className="text-lg font-medium text-gray-800">Location Information</h3>
          <div>
            <label htmlFor="currentLocation" className="label">
              Current Location (e.g., City, Country)
            </label>
            <input
              id="currentLocation"
              {...register('currentLocation', { required: 'Location is required' })}
              maxLength={255}
              className="input mt-1"
            />
            {errors.currentLocation && (
              <p className="error-message">{errors.currentLocation.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="locationTagline" className="label">
              Location Tagline (Optional)
            </label>
            <input
              id="locationTagline"
              {...register('locationTagline')}
              maxLength={255}
              className="input mt-1"
            />
          </div>
        </div>

        {/* Availability Information Card */}
        <div className="card space-y-6">
          <h3 className="text-lg font-medium text-gray-800">Availability</h3>
          <div>
            <label htmlFor="availabilityStatus" className="label mb-2">
              Available for new opportunities?
            </label>
            <div className="flex items-center">
              <Controller
                name="availabilityStatus"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="availabilityStatus"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <span className="ml-3 text-sm text-gray-600">
                {watch('availabilityStatus') ? 'Yes, I am available' : 'No, I am not available'}
              </span>
            </div>
          </div>
          {watch('availabilityStatus') && (
            <div>
              <label htmlFor="availabilityMessage" className="label">
                Availability Message (Optional)
              </label>
              <input
                id="availabilityMessage"
                {...register('availabilityMessage')}
                maxLength={500}
                className="input mt-1"
              />
            </div>
          )}
        </div>

        <div>
          <Button
            type="submit"
            disabled={isSaving || !isDirty}
            variant="primary"
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Basic Info'}
          </Button>
        </div>
      </form>
    </section>
  )
}
