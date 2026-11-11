import { humanizeIdentifier } from '@hominem/utils/text';
import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  todayDateInput,
} from '@ponti-studios/ui/forms';
import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { Form, redirect } from 'react-router';

import { DetailSection, PageHeader } from '~/components/design';
import { Container } from '~/components/design/container';
import { FormActions, FormGrid, TextAreaInput, TextInput } from '~/components/design/forms';
import { formText } from '~/modules/career/lib/route-utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';
import { isJobApplicationStatus, JobApplicationStatus } from '~/modules/career/lib/types/career';

export const meta: MetaFunction = () => [
  { title: 'New Application | Hominem' },
  { name: 'description', content: 'Add a new job application to track your search progress.' },
];

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const position = formText(formData, 'position') ?? '';
  const company = formText(formData, 'company') ?? '';
  const statusValue = formData.get('status');
  if (typeof statusValue !== 'string' || !isJobApplicationStatus(statusValue)) {
    throw new Response('Invalid application status', { status: 400 });
  }
  if (!position || !company) {
    throw new Response('Position and company are required', { status: 400 });
  }

  const salaryQuoted = formText(formData, 'salaryQuoted') ?? '';
  let salaryExpectation: number | null = null;
  if (salaryQuoted) {
    const dollars = Number(salaryQuoted.replace(/[$,\s]/g, ''));
    if (Number.isFinite(dollars)) salaryExpectation = Math.round(dollars);
  }

  const response = await createCareerServerClient(request).applications.create.$post({
    json: {
      company,
      title: position,
      status: statusValue,
      location: formText(formData, 'location') || null,
      appliedAt: formText(formData, 'startDate') || null,
      salaryExpectation,
      notes: formText(formData, 'jobPosting') || null,
    },
  });
  if (!response.ok) {
    throw new Response('Failed to create job application. Please try again.', { status: 500 });
  }

  const application = await response.json();
  return redirect(`/career/applications/${application.id}`);
}

export default function CreateJobApplication() {
  return (
    <Container size="xs">
      <PageHeader eyebrow="Career · Applications" title="New Application" />
      <DetailSection title="Application">
        <Form method="post" className="flex flex-col gap-4">
          <FormGrid>
            <TextInput
              label="Job Title *"
              name="position"
              placeholder="e.g. Senior Software Engineer"
              required
            />
            <TextInput
              label="Company *"
              name="company"
              placeholder="e.g. Google, Microsoft"
              required
            />
          </FormGrid>

          <FormGrid>
            <DatePicker
              id="startDate"
              name="startDate"
              label="Application Date *"
              defaultValue={todayDateInput()}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status" className="text-sm font-medium text-foreground">
                Status
              </label>
              <Select name="status" defaultValue={JobApplicationStatus.APPLIED}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(JobApplicationStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {humanizeIdentifier(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormGrid>

          <TextInput
            label="Location"
            name="location"
            placeholder="e.g. San Francisco, CA or Remote"
          />

          <TextAreaInput
            label="Job Description"
            name="jobPosting"
            rows={6}
            placeholder="Paste the job description here..."
          />

          <TextInput
            label="Salary Range"
            name="salaryQuoted"
            placeholder="e.g. $120k - $150k or $80/hour"
          />

          <div>
            <p className="mb-4 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Recruiter Information
            </p>
            <FormGrid>
              <TextInput
                label="Recruiter Name"
                name="recruiterName"
                placeholder="e.g. John Smith"
              />
              <TextInput
                label="Recruiter Email"
                name="recruiterEmail"
                type="email"
                placeholder="e.g. john.smith@company.com"
              />
            </FormGrid>
            <div className="mt-4">
              <TextInput
                label="Recruiter LinkedIn URL"
                name="recruiterLinkedin"
                type="url"
                placeholder="e.g. https://linkedin.com/in/johnsmith"
              />
            </div>
          </div>

          <FormActions submitLabel="Create Application" />
        </Form>
      </DetailSection>
    </Container>
  );
}
