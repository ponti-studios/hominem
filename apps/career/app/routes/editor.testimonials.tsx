import { and, eq } from 'drizzle-orm'
import { MessageSquare, PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SubmitHandler } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import type { ActionFunctionArgs, MetaFunction } from 'react-router'
import { useFetcher, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/lib/db'
import type { NewTestimonial, Testimonial } from '~/lib/db/schema'
import { testimonials } from '~/lib/db/schema'
import { useToast } from '../hooks/useToast'
import type { FullPortfolio } from '../lib/portfolio.server'
import {
  createErrorResponse,
  createSuccessResponse,
  parseFormData,
  tryAsync,
  withAuthAction,
} from '../lib/route-utils'

interface TestimonialFormValues {
  id?: string
  name: string
  title?: string
  content: string
  company?: string
  rating?: number
  avatarUrl?: string
  linkedinUrl?: string
  portfolioId: string
}

interface TestimonialsEditorSectionProps {
  testimonials?: Testimonial[] | null
  portfolioId: string
}

function TestimonialForm({
  testimonial,
  portfolioId,
  onDelete,
}: {
  testimonial?: Testimonial
  portfolioId: string
  onDelete?: () => void
}) {
  const fetcher = useFetcher()
  const { addToast } = useToast()
  const isNew = !testimonial?.id

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm<TestimonialFormValues>({
    defaultValues: {
      id: testimonial?.id,
      name: testimonial?.name || '',
      title: testimonial?.title || '',
      content: testimonial?.content || '',
      company: testimonial?.company || '',
      rating: testimonial?.rating || undefined,
      avatarUrl: testimonial?.avatarUrl || '',
      linkedinUrl: testimonial?.linkedinUrl || '',
      portfolioId,
    },
    mode: 'onChange',
  })

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as {
        success: boolean
        error?: string
        message?: string
        data?: Testimonial
      }
      if (result.success) {
        addToast(result.message || 'Testimonial saved successfully!', 'success')
        if (result.data && isNew) {
          // Reset form with the returned data (including new ID)
          reset({
            id: result.data.id,
            name: result.data.name || '',
            title: result.data.title || '',
            content: result.data.content || '',
            company: result.data.company || '',
            rating: result.data.rating || undefined,
            avatarUrl: result.data.avatarUrl || '',
            linkedinUrl: result.data.linkedinUrl || '',
            portfolioId: result.data.portfolioId,
          })
        }
      } else {
        addToast(`Failed to save testimonial: ${result.error || 'Unknown error'}`, 'error')
      }
    }
  }, [fetcher.state, fetcher.data, reset, addToast, isNew])

  const onSubmit: SubmitHandler<TestimonialFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      addToast('No changes to save.', 'info')
      return
    }

    if (!formData.name || !formData.content) {
      addToast('Please fill in all required fields.', 'error')
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('operation', isNew ? 'create' : 'update')
    formDataToSubmit.append('testimonialData', JSON.stringify(formData))

    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/editor/testimonials',
    })
  }

  const handleDelete = () => {
    if (!testimonial?.id) return

    if (confirm('Are you sure you want to delete this testimonial?')) {
      const formData = new FormData()
      formData.append('operation', 'delete')
      formData.append('id', testimonial.id)
      formData.append('portfolioId', portfolioId)

      fetcher.submit(formData, {
        method: 'POST',
        action: '/editor/testimonials',
      })

      onDelete?.()
    }
  }

  const isSaving = fetcher.state === 'submitting'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card bg-muted/50 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          {isNew ? 'New Testimonial' : 'Testimonial'}
        </h3>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isSaving || (!isDirty && !isNew) || !isValid}
            variant="primary"
            size="sm"
          >
            {isSaving ? 'Saving...' : isNew ? 'Add Testimonial' : 'Save Changes'}
          </Button>
          {!isNew && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              variant="destructive"
              size="sm"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor={`name-${testimonial?.id || 'new'}`} className="label">
            Name *
          </label>
          <input
            id={`name-${testimonial?.id || 'new'}`}
            type="text"
            {...register('name', { required: true })}
            className="input"
            placeholder="Client's full name"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`title-${testimonial?.id || 'new'}`} className="label">
            Job Title
          </label>
          <input
            id={`title-${testimonial?.id || 'new'}`}
            type="text"
            {...register('title')}
            className="input"
            placeholder="e.g., Senior Developer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor={`company-${testimonial?.id || 'new'}`} className="label">
            Company
          </label>
          <input
            id={`company-${testimonial?.id || 'new'}`}
            type="text"
            {...register('company')}
            className="input"
            placeholder="Company name"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`rating-${testimonial?.id || 'new'}`} className="label">
            Rating (1-5)
          </label>
          <select
            id={`rating-${testimonial?.id || 'new'}`}
            {...register('rating', { valueAsNumber: true })}
            className="select"
          >
            <option value="">Select rating</option>
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Fair</option>
            <option value="1">1 - Poor</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor={`content-${testimonial?.id || 'new'}`} className="label">
          Testimonial *
        </label>
        <textarea
          id={`content-${testimonial?.id || 'new'}`}
          {...register('content', { required: true })}
          className="textarea"
          rows={4}
          placeholder="What did the client say about your work?"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor={`avatarUrl-${testimonial?.id || 'new'}`} className="label">
            Avatar URL (optional)
          </label>
          <input
            id={`avatarUrl-${testimonial?.id || 'new'}`}
            type="url"
            {...register('avatarUrl')}
            className="input"
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`linkedinUrl-${testimonial?.id || 'new'}`} className="label">
            LinkedIn URL (optional)
          </label>
          <input
            id={`linkedinUrl-${testimonial?.id || 'new'}`}
            type="url"
            {...register('linkedinUrl')}
            className="input"
            placeholder="https://linkedin.com/in/username"
          />
        </div>
      </div>
    </form>
  )
}

function TestimonialsEditorSection({
  testimonials: initialTestimonials,
  portfolioId,
}: TestimonialsEditorSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [testimonials, setTestimonials] = useState(initialTestimonials || [])

  // Update testimonials when initialTestimonials changes
  useEffect(() => {
    setTestimonials(initialTestimonials || [])
  }, [initialTestimonials])

  const handleAddNew = () => {
    setShowNewForm(true)
  }

  const handleDelete = (testimonialId: string) => {
    setTestimonials((prev) => prev.filter((testimonial) => testimonial.id !== testimonialId))
  }

  return (
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Client Testimonials</h2>
        </div>

        {!showNewForm && (
          <Button
            type="button"
            onClick={handleAddNew}
            variant="outline"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Testimonial</span>
          </Button>
        )}
      </div>

      <p className="text-muted text-muted-foreground mb-lg">
        Add testimonials and reviews from your clients and colleagues.
      </p>

      <div className="flex flex-col gap-8">
        {/* Show new testimonial form if requested */}
        {showNewForm && (
          <TestimonialForm portfolioId={portfolioId} onDelete={() => setShowNewForm(false)} />
        )}

        {/* Existing testimonials */}
        {testimonials.map((testimonial) => (
          <TestimonialForm
            key={testimonial.id}
            testimonial={testimonial}
            portfolioId={portfolioId}
            onDelete={() => handleDelete(testimonial.id)}
          />
        ))}

        {testimonials.length === 0 && !showNewForm && (
          <div className="text-center py-2xl text-muted-foreground">
            No testimonials added yet. Click "Add New Testimonial" to get started.
          </div>
        )}
      </div>
    </section>
  )
}

export const meta: MetaFunction = () => [{ title: 'Testimonials - Portfolio Editor | Craftd' }]

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData()
    const operation = formData.get('operation') as string

    switch (operation) {
      case 'create':
      case 'update': {
        const testimonialDataResult = parseFormData<TestimonialFormValues>(
          formData,
          'testimonialData'
        )

        if ('success' in testimonialDataResult && !testimonialDataResult.success) {
          return testimonialDataResult
        }

        const testimonialData = testimonialDataResult as TestimonialFormValues

        if (!testimonialData.portfolioId) {
          return createErrorResponse('Missing portfolioId')
        }

        return tryAsync(async () => {
          if (operation === 'create') {
            // Insert new testimonial
            const { id, ...insertData } = testimonialData

            const [newTestimonial] = await db
              .insert(testimonials)
              .values(insertData as NewTestimonial)
              .returning()

            return createSuccessResponse(newTestimonial, 'Testimonial created successfully')
          }

          // Update existing testimonial
          const { id, ...updateData } = testimonialData
          if (!id) return createErrorResponse('Missing testimonial ID for update')

          await db
            .update(testimonials)
            .set(updateData)
            .where(
              and(
                eq(testimonials.id, id),
                eq(testimonials.portfolioId, testimonialData.portfolioId)
              )
            )

          return createSuccessResponse(null, 'Testimonial updated successfully')
        }, `Failed to ${operation} testimonial`)
      }

      case 'delete': {
        const id = formData.get('id') as string
        const portfolioId = formData.get('portfolioId') as string

        if (!id || !portfolioId) {
          return createErrorResponse('Missing required fields for deletion')
        }

        return tryAsync(async () => {
          await db
            .delete(testimonials)
            .where(and(eq(testimonials.id, id), eq(testimonials.portfolioId, portfolioId)))

          return createSuccessResponse(null, 'Testimonial deleted successfully')
        }, 'Failed to delete testimonial')
      }

      default:
        return createErrorResponse('Invalid operation')
    }
  })
}

export default function EditorTestimonials() {
  // Consume portfolio provided by parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>()

  return (
    <TestimonialsEditorSection testimonials={portfolio.testimonials} portfolioId={portfolio.id} />
  )
}
