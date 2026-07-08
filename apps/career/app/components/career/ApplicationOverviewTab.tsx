import type { CareerJobApplicationRecord as ApplicationWithCompany } from '@hominem/db';
import { Button } from '@hominem/ui';
import { Card, CardContent, CardHeader, CardTitle, Input } from '@hominem/ui';
import { Briefcase, Calendar, DollarSign, ExternalLink, MapPin, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Form, useNavigation } from 'react-router';

import { formatApplicationDate } from '~/lib/utils/applicationUtils';

interface OverviewTabProps {
  application: ApplicationWithCompany;
  company: ApplicationWithCompany['company'];
}

export function ApplicationOverviewTab({ application, company }: OverviewTabProps) {
  const [isEditingRecruiter, setIsEditingRecruiter] = useState(false);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const wasSubmitting = useRef(isSubmitting);

  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting) {
      setIsEditingRecruiter(false);
    }
    wasSubmitting.current = isSubmitting;
  }, [isSubmitting]);

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader>
          <CardTitle className="heading-4">Application Details</CardTitle>
          {application.jobPostingUrl && (
            <a
              href={application.jobPostingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors"
              aria-label="View job posting"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4" />
              <span>{application.position}</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              <span>{formatApplicationDate(application.startDate)}</span>
            </div>

            {application.salaryQuoted && (
              <div className="flex items-center gap-2">
                <DollarSign className="size-4" />
                <span>{application.salaryQuoted}</span>
              </div>
            )}
            {application.source && (
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                <span>{application.source}</span>
              </div>
            )}

            {application.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4" />
                <span>{application.location}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="heading-4">Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="subheading-4 text-muted-foreground">Company Name</span>
              <p className="text-foreground mt-1">{company?.name || 'Unknown Company'}</p>
            </div>

            {company?.website && (
              <div>
                <span className="subheading-4 text-muted-foreground">Website</span>
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
                <span className="subheading-4 text-muted-foreground">Industry</span>
                <p className="text-foreground mt-1">{company.industry}</p>
              </div>
            )}

            {company?.size && (
              <div>
                <span className="subheading-4 text-muted-foreground">Company Size</span>
                <p className="text-foreground mt-1">{company.size}</p>
              </div>
            )}

            {company?.location && (
              <div>
                <span className="subheading-4 text-muted-foreground">Company Location</span>
                <p className="text-foreground mt-1">{company.location}</p>
              </div>
            )}
          </div>

          {application.companyNotes && (
            <div className="mt-6 pt-6 border-t border-border">
              <span className="subheading-4 text-muted-foreground">Research Notes</span>
              <p className="text-muted-foreground whitespace-pre-wrap mt-1">
                {application.companyNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="w-full flex items-center justify-between">
            <CardTitle className="heading-4">Recruiter Information</CardTitle>
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
                  <span className="subheading-4 text-muted-foreground">Recruiter Name</span>
                  <Input
                    id="recruiterName"
                    name="recruiterName"
                    placeholder="e.g. John Smith"
                    defaultValue={application.recruiterName || ''}
                  />
                </div>

                <div className="space-y-2">
                  <span className="subheading-4 text-muted-foreground">Recruiter Email</span>
                  <Input
                    id="recruiterEmail"
                    name="recruiterEmail"
                    type="email"
                    placeholder="e.g. john.smith@company.com"
                    defaultValue={application.recruiterEmail || ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="subheading-4 text-muted-foreground">Recruiter LinkedIn URL</span>
                <Input
                  id="recruiterLinkedin"
                  name="recruiterLinkedin"
                  type="url"
                  placeholder="e.g. https://linkedin.com/in/johnsmith"
                  defaultValue={application.recruiterLinkedin || ''}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={isSubmitting} isLoading={isSubmitting}>
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
                <span className="subheading-4 text-muted-foreground">Recruiter Name</span>
                <p className="text-foreground mt-1">
                  {application.recruiterName || (
                    <span className="text-muted-foreground italic">Not specified</span>
                  )}
                </p>
              </div>

              <div>
                <span className="subheading-4 text-muted-foreground">Recruiter Email</span>
                {application.recruiterEmail ? (
                  <a
                    href={`mailto:${application.recruiterEmail}`}
                    className="mt-1 block text-primary"
                  >
                    {application.recruiterEmail}
                  </a>
                ) : (
                  <p className="text-muted-foreground italic mt-1">Not specified</p>
                )}
              </div>

              <div className="md:col-span-2">
                <span className="subheading-4 text-muted-foreground">Recruiter LinkedIn</span>
                {application.recruiterLinkedin ? (
                  <a
                    href={application.recruiterLinkedin}
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
