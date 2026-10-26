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
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Form, Link, redirect } from 'react-router';

import { logger } from '~/lib/logger';
import { userContext } from '~/lib/middleware';
import { formText } from '~/lib/route-utils';
import { JobApplicationsService } from '~/lib/services/job-applications.service';
import { isJobApplicationStatus, JobApplicationStatus } from '~/types/career';

export const meta: MetaFunction = () => [
  { title: 'New Application | career' },
  { name: 'description', content: 'Add a new job application to track your search progress.' },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(userContext);
  return { user };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response('User not found', { status: 401 });
  }
  const formData = await request.formData();
  const position = formText(formData, 'position') ?? '';
  const companyName = formText(formData, 'company') ?? '';
  const statusValue = formData.get('status');
  if (typeof statusValue !== 'string' || !isJobApplicationStatus(statusValue)) {
    throw new Response('Invalid application status', { status: 400 });
  }
  const status = statusValue;
  const location = formText(formData, 'location') ?? '';
  const salaryQuoted = formText(formData, 'salaryQuoted') ?? '';
  const jobDescription = formText(formData, 'jobPosting') ?? '';

  if (!position || !companyName) {
    throw new Response('Position and company are required', { status: 400 });
  }

  let salaryExpectation: number | null = null;
  if (salaryQuoted) {
    const cleaned = salaryQuoted.replace(/[$,\s]/g, '');
    const dollars = Number(cleaned);
    if (Number.isFinite(dollars)) {
      salaryExpectation = Math.round(dollars);
    }
  }

  try {
    const application = await JobApplicationsService.createApplication(user.id, {
      companyName,
      position,
      status,
      location: location || null,
      salaryExpectation,
      notes: jobDescription || null,
    });

    return redirect(`/applications/${application.id}`);
  } catch (error) {
    logger.error('Error creating job application', error, { owner_userid: user.id });
    throw new Response('Failed to create job application. Please try again.', { status: 500 });
  }
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
                to="/applications"
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
