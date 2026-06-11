import type { CareerPortfolioStatRecord } from '@hominem/db';
import { CareerRepository, db, runInTransaction } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { Input } from '@hominem/ui/input';
import { BarChart3, PlusIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/stats';

type PortfolioStat = CareerPortfolioStatRecord;

interface PortfolioStatsFormValues {
  stats: Array<Partial<PortfolioStat> & { label?: string; value?: string }>;
}

interface PortfolioStatsEditorSectionProps {
  stats?: PortfolioStat[] | null;
  portfolio_id: string;
}

function PortfolioStatsEditorSection({
  stats: initialStats,
  portfolio_id,
}: PortfolioStatsEditorSectionProps) {
  const fetcher = useFetcher();
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
  });

  useEffect(() => {
    reset({ stats: initialStats || [] });
  }, [initialStats, reset]);

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher,
    errorMessage: 'We couldn’t save your portfolio stats. Try again.',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'stats',
  });

  const handleAddNewStat = () => {
    append({ label: '', value: '' });
  };

  const _handleRemoveStat = (index: number, statId?: string) => {
    if (statId) {
      if (confirm('Are you sure you want to delete this stat? This action is permanent.')) {
        remove(index);
      }
    } else {
      remove(index);
    }
  };

  const onSubmit = (formData: PortfolioStatsFormValues) => {
    if (!isDirty) {
      return;
    }

    // Clean up the data - only send essential fields
    const statsToSave = formData.stats.map((s) => ({
      id: s.id,
      label: s.label,
      value: s.value,
      portfolio_id,
    }));

    const formData2 = new FormData();
    formData2.append('statsData', JSON.stringify(statsToSave));

    clearSubmissionError();
    fetcher.submit(formData2, {
      method: 'POST',
      action: '/stats',
    });
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Portfolio Stats</h2>
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
            variant="default"
            size="sm"
            isLoading={isSaving}
            loadingLabel="Saving..."
          >
            Save Changes
          </Button>
        </div>
      </div>
      <form id="stats-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormErrorAlert title="Portfolio stats weren’t saved" message={submissionError} />
        {fields.map((field, index) => (
          <div key={field.id} className="card">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
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
                <div className="flex flex-col gap-2">
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
  );
}

export const meta: Route.MetaFunction = () => [{ title: 'Portfolio Stats | Craftd' }];

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext)!;
  const stats = await db
    .selectFrom('app.portfolio_stats')
    .selectAll()
    .where('portfolio_id', '=', portfolio.id)
    .orderBy('sort_order', 'asc')
    .execute();
  return { stats, portfolio_id: portfolio.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your portfolio stats.' };
  }
  const formData = await request.formData();
  const statsDataResult = parseFormData<
    Array<{ id?: string; label: string; value: string; portfolio_id: string }>
  >(formData, 'statsData');
  if ('success' in statsDataResult && !statsDataResult.success) {
    return { success: false, error: 'Your stats couldn’t be read. Refresh and try again.' };
  }
  const statsData = statsDataResult as Array<{
    id?: string;
    label: string;
    value: string;
    portfolio_id: string;
  }>;
  if (!Array.isArray(statsData)) {
    return { success: false, error: 'Your stats couldn’t be read. Refresh and try again.' };
  }
  if (statsData.length === 0) {
    return { success: true, message: 'No stats to save' };
  }
  // Ensure portfolio_id exists
  const portfolio_id = statsData[0]?.portfolio_id;
  if (!portfolio_id) {
    return { success: false, error: 'Choose a portfolio before saving your stats.' };
  }
  try {
    await runInTransaction((tx) =>
      CareerRepository.replacePortfolioStats(
        tx,
        user.id,
        portfolio_id,
        statsData.map((stat, index) => ({
          id: stat.id,
          label: stat.label,
          value: stat.value,
          sort_order: index,
        })),
      ),
    );
    return { success: true, message: 'Portfolio stats saved successfully' };
  } catch (error) {
    console.error('Failed to save portfolio stats:', error);
    return { success: false, error: 'We couldn’t save your portfolio stats. Try again.' };
  }
}

export default function Stats({ loaderData }: Route.ComponentProps) {
  return (
    <PortfolioStatsEditorSection stats={loaderData.stats} portfolio_id={loaderData.portfolio_id} />
  );
}
