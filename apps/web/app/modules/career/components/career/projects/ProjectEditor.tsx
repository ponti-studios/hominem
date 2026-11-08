import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { BriefcaseIcon } from 'lucide-react';
import { useState } from 'react';
import { Form } from 'react-router';

import { Chip } from '~/components/design/chip';
import { FormActions, FormGrid, TextAreaInput, TextInput } from '~/components/design/forms';
import { SearchInput } from '~/components/design/search-input';
import type { CareerProjectRecord } from '~/modules/career/lib/types/records';

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
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => project?.engagements?.map((e) => e.id) ?? [],
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
      <TextInput label="Title" name="title" required defaultValue={project?.title ?? ''} />
      <TextInput
        label="Organization"
        name="organization"
        placeholder="Optional company or client"
        defaultValue={project?.organization ?? ''}
      />
      <TextInput
        label="Short description"
        name="shortDescription"
        placeholder="One-line summary"
        defaultValue={project?.shortDescription ?? ''}
      />

      <FormGrid cols={3}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-[#f2f4f8]">
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
        <div className="md:col-span-2">
          <DatePicker
            mode="range"
            id="startDate"
            startName="startDate"
            endName="endDate"
            label="Dates"
            defaultValue={{ from: project?.startDate, to: project?.endDate }}
          />
        </div>
      </FormGrid>

      {engagements.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="block text-sm font-medium text-[#f2f4f8]">Related work engagements</span>
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="engagementIds" value={id} />
          ))}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((engagement) => (
                <Chip
                  key={engagement.id}
                  onRemove={() => toggle(engagement.id)}
                  removeLabel={`Remove ${engagement.title}`}
                >
                  {engagement.title} at {engagement.company}
                </Chip>
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
              <SearchInput
                value={query}
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder="Search engagements"
                ariaLabel="Search engagements"
              />
              <div className="flex flex-col gap-1 overflow-y-auto">
                {visible.map((engagement) => (
                  <label
                    key={engagement.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-white/[0.04]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(engagement.id)}
                      onChange={() => toggle(engagement.id)}
                      className="size-4 accent-[#d7ff3e]"
                    />
                    <span className="text-[#f2f4f8]">
                      {engagement.title}{' '}
                      <span className="text-[#9ba3b4]">at {engagement.company}</span>
                    </span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <p className="px-2 py-4 text-sm text-[#9ba3b4]">
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

      <TextAreaInput
        label="Description"
        name="description"
        rows={4}
        defaultValue={project?.description ?? ''}
      />

      <FormGrid>
        <TextInput
          label="Live URL"
          name="liveUrl"
          placeholder="https://"
          defaultValue={project?.liveUrl ?? ''}
        />
        <TextInput
          label="GitHub URL"
          name="githubUrl"
          placeholder="https://"
          defaultValue={project?.githubUrl ?? ''}
        />
      </FormGrid>

      <TextInput
        label="Technologies"
        name="technologies"
        placeholder="TypeScript, React, PostgreSQL"
        hint="Comma-separated"
        defaultValue={Array.isArray(project?.technologies) ? project.technologies.join(', ') : ''}
      />

      <FormActions submitLabel={submitLabel} onCancel={onCancel} />
    </Form>
  );
}
