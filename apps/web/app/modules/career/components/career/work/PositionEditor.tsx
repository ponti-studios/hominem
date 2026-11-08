import { DatePicker, Switch } from '@ponti-studios/ui/forms';
import { useState } from 'react';
import { Form } from 'react-router';

import { SelectField } from '~/components/design/form-field';
import { FormActions, FormGrid, TextAreaInput, TextInput } from '~/components/design/forms';
import type { CareerEngagementRecord } from '~/modules/career/lib/types/records';

interface PositionEditorProps {
  position?: CareerEngagementRecord;
  onCancel?: () => void;
  submitLabel?: string;
}

export function PositionEditor({
  position,
  onCancel,
  submitLabel = 'Save position',
}: PositionEditorProps) {
  const [isCurrent, setIsCurrent] = useState(position?.isCurrent ?? false);

  return (
    <Form method="post" className="flex flex-col gap-4">
      {position && <input type="hidden" name="intent" value="update-position" />}
      {position && <input type="hidden" name="id" value={position.id} />}
      <FormGrid>
        <TextInput
          label="Company *"
          name="company"
          required
          defaultValue={position?.company ?? ''}
        />
        <TextInput label="Title *" name="title" required defaultValue={position?.title ?? ''} />
        <TextInput label="Location" name="location" defaultValue={position?.location ?? ''} />
        <TextInput label="URL" name="url" type="url" defaultValue={position?.url ?? ''} />
        <SelectField
          label="Engagement type"
          name="kind"
          defaultValue={position?.kind ?? 'EMPLOYMENT'}
          options={[
            { value: 'EMPLOYMENT', label: 'Employment' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'FREELANCE', label: 'Freelance' },
            { value: 'VOLUNTEER', label: 'Volunteer' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />
      </FormGrid>

      <FormGrid>
        <DatePicker
          mode="range"
          id="startDate"
          key={isCurrent ? 'current-role' : 'fixed-term'}
          startName="startDate"
          endName="endDate"
          label="Dates"
          defaultValue={
            isCurrent
              ? { from: position?.startDate }
              : { from: position?.startDate, to: position?.endDate }
          }
        />
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={isCurrent} onCheckedChange={setIsCurrent} name="isCurrent" />
            Current role
          </label>
        </div>
      </FormGrid>

      <FormGrid cols={3}>
        <TextInput
          label="Salary low ($/yr)"
          name="salaryLow"
          type="number"
          defaultValue={position?.salaryLow != null ? String(position.salaryLow / 100) : ''}
        />
        <TextInput
          label="Salary high ($/yr)"
          name="salaryHigh"
          type="number"
          defaultValue={position?.salaryHigh != null ? String(position.salaryHigh / 100) : ''}
        />
        <TextInput label="Currency" name="currency" defaultValue={position?.currency ?? 'USD'} />
      </FormGrid>

      <TextAreaInput
        label="Description"
        name="description"
        rows={5}
        defaultValue={position?.description ?? ''}
      />

      <FormGrid>
        <TextInput
          label="Contact name"
          name="contactName"
          defaultValue={position?.contactName ?? ''}
        />
        <TextInput
          label="Contact phone"
          name="contactPhone"
          defaultValue={position?.contactPhone ?? ''}
        />
        <TextInput label="Address" name="address" defaultValue={position?.address ?? ''} />
        <TextInput label="Source" name="source" defaultValue={position?.source ?? ''} />
      </FormGrid>

      {!isCurrent && (
        <TextAreaInput
          label="Reason for leaving"
          name="reasonForLeaving"
          rows={3}
          defaultValue={position?.reasonForLeaving ?? ''}
        />
      )}

      <FormActions submitLabel={submitLabel} onCancel={onCancel} />
    </Form>
  );
}
