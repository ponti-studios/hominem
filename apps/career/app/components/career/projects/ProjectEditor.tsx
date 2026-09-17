import type { CareerProjectRecord } from '@hominem/db/career';
import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
  Textarea,
} from '@ponti-studios/ui/forms';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@ponti-studios/ui/overlays';
import { Button } from '@ponti-studios/ui/primitives';
import { BriefcaseIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Form, useNavigation } from 'react-router';

import { AddButton } from '~/components/AddButton';

const PROJECT_STATUSES = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELED', label: 'Canceled' },
] as const;

interface ProjectEditorProps {
  project?: CareerProjectRecord;
  engagements?: Array<{ id: string; title: string; company: string }>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function ProjectEditor({
  project,
  engagements = [],
  onCancel,
  submitLabel = 'Save project',
}: ProjectEditorProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => project?.engagements.map((e) => e.id) ?? [],
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = engagements.filter((e) => selectedIds.includes(e.id));
  const visible = query.trim()
    ? engagements.filter((e) =>
        `${e.title} ${e.company}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : engagements;
  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );

  return (
    <Form method="post" className="flex flex-col gap-4">
      <TextField label="Title" name="title" required defaultValue={project?.title ?? ''} />
      <TextField
        label="Organization"
        name="organization"
        placeholder="Optional company or client"
        defaultValue={project?.organization ?? ''}
      />
      <TextField
        label="Short description"
        name="shortDescription"
        placeholder="One-line summary"
        defaultValue={project?.shortDescription ?? ''}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <Select
            name="status"
            defaultValue={project?.status ?? 'BACKLOG'}
            items={PROJECT_STATUSES.map(({ value, label }) => ({ value, label }))}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <DatePicker
            mode="range"
            id="startDate"
            startName="startDate"
            endName="endDate"
            label="Dates"
            defaultValue={{ from: project?.startDate, to: project?.endDate }}
          />
        </div>
      </div>

      {engagements.length > 0 && (
        <div className="space-y-2">
          <span className="block text-sm font-medium">Related work engagements</span>
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="engagementIds" value={id} />
          ))}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((engagement) => (
                <span
                  key={engagement.id}
                  className="body-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1"
                >
                  {engagement.title} at {engagement.company}
                  <button
                    type="button"
                    aria-label={`Remove ${engagement.title}`}
                    onClick={() => toggle(engagement.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
            >
              <BriefcaseIcon className="mr-2 size-4" />
              {selected.length > 0 ? `${selected.length} selected — edit` : 'Select engagements'}
            </Button>
            <SheetContent aria-label="Select related work engagements">
              <SheetHeader>
                <SheetTitle>Related work engagements</SheetTitle>
                <SheetDescription>
                  Choose the work engagements this project relates to.
                </SheetDescription>
              </SheetHeader>
              <label className="relative block">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search engagements"
                  aria-label="Search engagements"
                  className="h-10 w-full rounded-md border border-border bg-background pr-3 pl-9 text-sm"
                />
              </label>
              <div className="flex flex-col gap-1 overflow-y-auto">
                {visible.map((engagement) => (
                  <label
                    key={engagement.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(engagement.id)}
                      onChange={() => toggle(engagement.id)}
                      className="size-4 accent-primary"
                    />
                    <span>
                      {engagement.title}{' '}
                      <span className="text-muted-foreground">at {engagement.company}</span>
                    </span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <p className="body-3 px-2 py-4 text-muted-foreground">
                    No engagements match “{query.trim()}”.
                  </p>
                )}
              </div>
              <SheetFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                  disabled={selected.length === 0}
                >
                  Clear
                </Button>
                <Button type="button" onClick={() => setSheetOpen(false)}>
                  Done{selected.length > 0 ? ` (${selected.length})` : ''}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-foreground text-sm font-medium">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={project?.description ?? ''}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Live URL"
          name="liveUrl"
          placeholder="https://"
          defaultValue={project?.liveUrl ?? ''}
        />
        <TextField
          label="GitHub URL"
          name="githubUrl"
          placeholder="https://"
          defaultValue={project?.githubUrl ?? ''}
        />
      </div>

      <TextField
        label="Technologies"
        name="technologies"
        placeholder="TypeScript, React, PostgreSQL"
        helpText="Comma-separated"
        defaultValue={Array.isArray(project?.technologies) ? project.technologies.join(', ') : ''}
      />

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        {submitLabel.startsWith('Add ') ? (
          <AddButton type="submit" label={submitLabel} disabled={isSubmitting} />
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        )}
      </div>
    </Form>
  );
}
