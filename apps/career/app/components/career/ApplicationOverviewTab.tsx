import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';
import { Input } from '@hominem/ui/input';
import { Briefcase, Calendar, DollarSign, ExternalLink, MapPin, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Form } from 'react-router';

import { formatApplicationDate } from '~/lib/utils/applicationUtils';
import type { ApplicationWithCompany } from '~/types/career-data';

interface OverviewTabProps {
  application: ApplicationWithCompany;
  company: ApplicationWithCompany['company'];
}

export function ApplicationOverviewTab({ application, company }: OverviewTabProps) {
  const [isEditingRecruiter, setIsEditingRecruiter] = useState(false);

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          {application.job_posting_url && (
            <a
              href={application.job_posting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors"
              aria-label="View job posting"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span>{application.position}</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatApplicationDate(application.start_date)}</span>
            </div>

            {application.salary_quoted && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span>{application.salary_quoted}</span>
              </div>
            )}
            {application.source && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>{application.source}</span>
              </div>
            )}

            {application.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{application.location}</span>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Company Name</span>
              <p className="text-foreground mt-1">{company?.name || 'Unknown Company'}</p>
            </div>

            {company?.website && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Website</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-primary"
                >
                  {company.website}
                </a>
              </div>
            )}

            {company?.industry && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Industry</span>
                <p className="text-foreground mt-1">{company.industry}</p>
              </div>
            )}

            {company?.size && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Company Size</span>
                <p className="text-foreground mt-1">{company.size}</p>
              </div>
            )}

            {company?.location && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Company Location</span>
                <p className="text-foreground mt-1">{company.location}</p>
              </div>
            )}
          </div>

          {application.company_notes && (
            <div className="mt-6 pt-6 border-t border-border">
              <span className="text-sm font-medium text-muted-foreground">Research Notes</span>
              <p className="text-muted-foreground whitespace-pre-wrap mt-1">
                {application.company_notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="w-full flex items-center justify-between">
            <CardTitle>Recruiter Information</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingRecruiter(!isEditingRecruiter)}
            >
              {isEditingRecruiter ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditingRecruiter ? (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="operation" value="update_application" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Recruiter Name</span>
                  <Input
                    id="recruiter_name"
                    name="recruiter_name"
                    placeholder="e.g. John Smith"
                    defaultValue={application.recruiter_name || ''}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Recruiter Email</span>
                  <Input
                    id="recruiter_email"
                    name="recruiter_email"
                    type="email"
                    placeholder="e.g. john.smith@company.com"
                    defaultValue={application.recruiter_email || ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Recruiter LinkedIn URL
                </span>
                <Input
                  id="recruiter_linkedin"
                  name="recruiter_linkedin"
                  type="url"
                  placeholder="e.g. https://linkedin.com/in/johnsmith"
                  defaultValue={application.recruiter_linkedin || ''}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" onClick={() => setIsEditingRecruiter(false)}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingRecruiter(false)}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Recruiter Name</span>
                <p className="text-foreground mt-1">
                  {application.recruiter_name || (
                    <span className="text-muted-foreground italic">Not specified</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-muted-foreground">Recruiter Email</span>
                {application.recruiter_email ? (
                  <a
                    href={`mailto:${application.recruiter_email}`}
                    className="mt-1 block text-primary"
                  >
                    {application.recruiter_email}
                  </a>
                ) : (
                  <p className="text-muted-foreground italic mt-1">Not specified</p>
                )}
              </div>

              <div className="md:col-span-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Recruiter LinkedIn
                </span>
                {application.recruiter_linkedin ? (
                  <a
                    href={application.recruiter_linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-primary"
                  >
                    View Profile
                  </a>
                ) : (
                  <p className="text-muted-foreground italic mt-1">Not specified</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
