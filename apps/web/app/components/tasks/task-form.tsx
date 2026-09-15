import type { Task, TasksCreateInput, TasksUpdateInput } from '@hominem/rpc/types';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '~/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  hasDetails,
  useTaskFormDraft,
  validateTaskDraft,
  type TaskFormDraft,
} from '~/hooks/use-task-form-draft';

import { DurationPicker } from './duration-picker';
import { PriorityPicker } from './priority-picker';
import { WhenInput } from './when-input';

interface TaskFormBase {
  initialTask?: Task;
  variant?: 'compact' | 'spacious';
  submitLabel: string;
  pending?: boolean;
  serverError?: string | null;
  hideSubmitUntilDirty?: boolean;
  showPreview?: (draft: TaskFormDraft) => React.ReactNode;
}

type TaskFormProps =
  | (TaskFormBase & { mode: 'create'; onSubmit: (input: TasksCreateInput) => void })
  | (TaskFormBase & { mode: 'edit'; onSubmit: (input: TasksUpdateInput) => void });

/**
 * The single owner of task form state. Accordion open/closed is local UI
 * state (`useState` + `onOpenChange`) — never form data — so toggling it
 * can't dirty the draft, clobber parse metadata, or get wiped by refetches.
 */
export function TaskForm(props: TaskFormProps) {
  const {
    initialTask,
    mode,
    variant = 'compact',
    submitLabel,
    pending = false,
    serverError = null,
    hideSubmitUntilDirty = false,
    showPreview,
    onSubmit,
  } = props;
  const form = useTaskFormDraft(initialTask);
  const { draft, setField, applyParsedWhen, isDirty } = form;
  const [detailsOpen, setDetailsOpen] = useState(() =>
    initialTask ? hasDetails(initialTask) : false,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const spacing = variant === 'spacious' ? 'space-y-6' : 'space-y-4';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = validateTaskDraft(draft);
    setFormError(error);
    if (error) return;
    if (mode === 'create') {
      onSubmit(form.toCreateInput());
    } else {
      onSubmit(form.toUpdateInput());
    }
  }

  const showSubmit = hideSubmitUntilDirty ? isDirty : true;

  return (
    <form className={spacing} onSubmit={handleSubmit}>
      <label className="block space-y-2 text-xs">
        <span className="text-muted-foreground">Title</span>
        <Input
          autoFocus={mode === 'create'}
          onChange={(event) => setField('title', event.target.value)}
          placeholder="Call the plumber"
          value={draft.title}
        />
      </label>
      <label className="block space-y-2 text-xs">
        <span className="text-muted-foreground">Description (optional)</span>
        <Textarea
          onChange={(event) => setField('description', event.target.value)}
          rows={variant === 'spacious' ? 4 : 3}
          value={draft.description}
        />
      </label>
      <Collapsible onOpenChange={setDetailsOpen} open={detailsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
            type="button"
          >
            <span>{detailsOpen ? 'Hide details' : 'Add details'}</span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="space-y-5 pt-4">
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">Priority</legend>
              <PriorityPicker
                onChange={(value) => setField('priority', value)}
                value={draft.priority}
              />
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">When</legend>
              <WhenInput
                applyParsedWhen={applyParsedWhen}
                dueAt={draft.dueAt}
                scheduledEndAt={draft.scheduledEndAt}
                scheduledStartAt={draft.scheduledStartAt}
                setField={setField}
              />
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">Duration</legend>
              <DurationPicker
                onChange={(value) => setField('durationMinutes', value)}
                value={draft.durationMinutes}
              />
            </fieldset>
            <label className="block space-y-2 text-xs">
              <span className="text-muted-foreground">Location</span>
              <Input
                onChange={(event) => setField('location', event.target.value)}
                placeholder="Optional"
                value={draft.location}
              />
            </label>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {showPreview ? showPreview(draft) : null}
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      {showSubmit ? (
        <div className="flex justify-end">
          <Button disabled={pending || !draft.title.trim()} type="submit">
            {pending ? `${submitLabel}…` : submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
