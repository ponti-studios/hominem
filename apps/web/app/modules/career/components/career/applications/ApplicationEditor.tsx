import { humanizeIdentifier } from '@hominem/utils/text';
import { DatePicker } from '@ponti-studios/ui/forms';
import { Form } from 'react-router';

import { SelectField } from '~/components/design/form-field';
import { FormActions, FormGrid, TextAreaInput, TextInput } from '~/components/design/forms';
import { JOB_APPLICATION_STATUSES } from '~/modules/career/lib/types/career';
import type { CareerApplicationWithRelations } from '~/modules/career/lib/types/records';

interface ApplicationEditorProps {
  application: CareerApplicationWithRelations;
  onCancel: () => void;
}

export function ApplicationEditor({ application, onCancel }: ApplicationEditorProps) {
  return (
    <div className="hairline rounded-2xl bg-[#0e1116]/90 p-5">
      <h3 className="mb-4 text-[15px] font-semibold text-[#f2f4f8]">Edit application</h3>
      <Form method="post" className="flex flex-col gap-4">
        <input type="hidden" name="intent" value="update-application" />
        <FormGrid>
          <TextInput label="Job title" name="title" required defaultValue={application.title} />
          <TextInput label="Company" name="company" required defaultValue={application.company} />
          <TextInput label="Location" name="location" defaultValue={application.location ?? ''} />
          <TextInput label="Source" name="source" defaultValue={application.source ?? ''} />
          <DatePicker
            id="appliedAt"
            name="appliedAt"
            label="Applied date"
            defaultValue={application.appliedAt}
          />
          <SelectField
            label="Status"
            name="status"
            defaultValue={application.status ?? undefined}
            placeholder="Select status"
            options={JOB_APPLICATION_STATUSES.map((status) => ({
              value: status,
              label: humanizeIdentifier(status),
            }))}
          />
          <TextInput
            label="Salary expectation ($/yr)"
            name="salaryExpectation"
            type="number"
            defaultValue={
              application.salaryExpectation != null ? String(application.salaryExpectation) : ''
            }
          />
          <TextInput
            label="Job posting URL"
            name="jobPostingUrl"
            type="url"
            defaultValue={application.jobPostingUrl ?? ''}
          />
        </FormGrid>
        <TextAreaInput label="Notes" name="notes" rows={4} defaultValue={application.notes ?? ''} />
        <FormActions submitLabel="Save changes" onCancel={onCancel} />
      </Form>
    </div>
  );
}
