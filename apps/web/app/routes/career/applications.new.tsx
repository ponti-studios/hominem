import { humanizeIdentifier } from '@hominem/utils/text';
import {
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  todayDateInput,
} from '@ponti-studios/ui/forms';
import { Button, Card, CardContent } from '@ponti-studios/ui/primitives';
import type { ActionFunctionArgs, MetaFunction } from 'react-router';
import { Form, Link, redirect } from 'react-router';

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <Form method="post" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="position">Job Title *</label>
                <Input
                  id="position"
                  name="position"
                  placeholder="e.g. Senior Software Engineer"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="company">Company *</label>
                <Input
                  id="company"
                  name="company"
                  placeholder="e.g. Google, Microsoft"
                  required
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <DatePicker
                  id="startDate"
                  name="startDate"
                  label="Application Date *"
                  defaultValue={todayDateInput()}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="status">Status</label>
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
            </div>

            <div className="space-y-2">
              <label htmlFor="location">Location</label>
              <Input
                id="location"
                name="location"
                placeholder="e.g. San Francisco, CA or Remote"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="jobPosting">Job Description</label>
              <textarea
                id="jobPosting"
                name="jobPosting"
                rows={6}
                placeholder="Paste the job description here..."
                className="w-full resize-none rounded-lg border border-border px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="salaryQuoted">Salary Range</label>
              <Input
                id="salaryQuoted"
                name="salaryQuoted"
                placeholder="e.g. $120k - $150k or $80/hour"
                className="h-11"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="heading-3 text-foreground mb-4">Recruiter Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="recruiterName">Recruiter Name</label>
                  <Input
                    id="recruiterName"
                    name="recruiterName"
                    placeholder="e.g. John Smith"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="recruiterEmail">Recruiter Email</label>
                  <Input
                    id="recruiterEmail"
                    name="recruiterEmail"
                    type="email"
                    placeholder="e.g. john.smith@company.com"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <label htmlFor="recruiterLinkedin">Recruiter LinkedIn URL</label>
                <Input
                  id="recruiterLinkedin"
                  name="recruiterLinkedin"
                  type="url"
                  placeholder="e.g. https://linkedin.com/in/johnsmith"
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <Button type="submit" className="flex-1 h-11 font-medium" variant="default">
                Create Application
              </Button>
              <Link
                to="/career/applications"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card subheading-4 text-muted-foreground transition-colors"
              >
                Cancel
              </Link>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
