import { and, eq, inArray } from 'drizzle-orm'
import { BarChart3, PlusIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import type { ActionFunctionArgs, MetaFunction } from 'react-router'
import { useFetcher, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { db } from '~/lib/db'
import type { NewPortfolioStats } from '~/lib/db/schema'
import { portfolioStats } from '~/lib/db/schema'
import { useToast } from '../hooks/useToast'
import type { FullPortfolio } from '../lib/portfolio.server'
import {
  createErrorResponse,
  createSuccessResponse,
  parseFormData,
  withAuthAction,
} from '../lib/route-utils'

// Use schema types
type PortfolioStat = NewPortfolioStats

interface PortfolioStatsFormValues {
  stats: Partial<PortfolioStat>[]
}

interface PortfolioStatsEditorSectionProps {
  stats?: PortfolioStat[] | null
  portfolioId: string
}

function PortfolioStatsEditorSection({
  stats: initialStats,
  portfolioId,
}: PortfolioStatsEditorSectionProps) {
  const fetcher = useFetcher()
  const { addToast } = useToast()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<PortfolioStatsFormValues>({
    defaultValues: {
      stats: initialStats || [],
    },
    mode: 'onChange',
  })

  useEffect(() => {
    reset({ stats: initialStats || [] })
  }, [initialStats, reset])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'stats',
  })

  // Handle fetcher errors and success
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string; message?: string }
      if (result.success) {
        addToast(result.message || 'Portfolio stats saved successfully!', 'success')
      } else {
        addToast(`Failed to save portfolio stats: ${result.error || 'Unknown error'}`, 'error')
      }
    }
  }, [fetcher.state, fetcher.data, addToast])

  const handleAddNewStat = () => {
    append({ label: '', value: '' })
  }

  const handleRemoveStat = (index: number, statId?: string) => {
    if (statId) {
      if (confirm('Are you sure you want to delete this stat? This action is permanent.')) {
        remove(index)
      }
    } else {
      remove(index)
    }
  }

  const onSubmit = (formData: PortfolioStatsFormValues) => {
    if (!isDirty) {
      addToast('No changes to save in portfolio stats.', 'info')
      return
    }

    // Clean up the data - only send essential fields
    const statsToSave = formData.stats.map((s) => ({
      id: s.id,
      label: s.label,
      value: s.value,
      portfolioId,
    }))

    const formData2 = new FormData()
    formData2.append('statsData', JSON.stringify(statsToSave))

    fetcher.submit(formData2, {
      method: 'POST',
      action: '/editor/stats',
    })
  }

  const isSaving = fetcher.state === 'submitting'

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Portfolio Stats</h2>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleAddNewStat}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Stat</span>
          </Button>
          <Button
            type="submit"
            form="stats-form"
            disabled={isSaving || !isDirty}
            variant="primary"
            size="sm"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
      <form id="stats-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div key={field.id} className="card">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor={`stats.${index}.label`} className="label">
                    Label
                  </label>
                  <Input
                    id={`stats.${index}.label`}
                    type="text"
                    placeholder="Enter label"
                    {...register(`stats.${index}.label` as const)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`stats.${index}.value`} className="label">
                    Value
                  </label>
                  <Input
                    id={`stats.${index}.value`}
                    type="text"
                    placeholder="Enter value"
                    {...register(`stats.${index}.value` as const)}
                  />
                </div>
              </div>
              <div className="flex-shrink-0 self-start sm:self-end">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => remove(index)}
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </form>
    </section>
  )
}

export const meta: MetaFunction = () => [{ title: 'Portfolio Stats - Portfolio Editor | Craftd' }]

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData()
    // Use Drizzle-generated insert type for safety
    type StatInsert = typeof portfolioStats.$inferInsert
    const statsDataResult = parseFormData<StatInsert[]>(formData, 'statsData')
    if ('success' in statsDataResult && !statsDataResult.success) {
      return statsDataResult
    }
    const statsData = statsDataResult as StatInsert[]
    if (!Array.isArray(statsData)) {
      return createErrorResponse('Invalid stats data')
    }
    if (statsData.length === 0) {
      // Nothing to do
      return createSuccessResponse(null, 'No stats to save')
    }
    // Ensure portfolioId exists
    const portfolioId = statsData[0]?.portfolioId
    if (!portfolioId) return createErrorResponse('Missing portfolioId')
    // Fetch existing stat IDs
    const current = await db
      .select({ id: portfolioStats.id })
      .from(portfolioStats)
      .where(eq(portfolioStats.portfolioId, portfolioId))
    const currentIds = current.map((s) => s.id)
    const submittedIds = statsData.filter((s) => s.id).map((s) => s.id)
    // Delete removed stats
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id))
    if (toDelete.length > 0) {
      await db
        .delete(portfolioStats)
        .where(
          and(eq(portfolioStats.portfolioId, portfolioId), inArray(portfolioStats.id, toDelete))
        )
    }
    // Upsert (insert or update)
    for (const stat of statsData) {
      if (stat.id) {
        const { id, ...updateData } = stat
        await db.update(portfolioStats).set(updateData).where(eq(portfolioStats.id, id))
      } else {
        await db.insert(portfolioStats).values(stat)
      }
    }
    return createSuccessResponse(null, 'Portfolio stats saved successfully')
  })
}

export default function EditorStats() {
  // Consume portfolio from parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>()

  return <PortfolioStatsEditorSection stats={portfolio.portfolioStats} portfolioId={portfolio.id} />
}
