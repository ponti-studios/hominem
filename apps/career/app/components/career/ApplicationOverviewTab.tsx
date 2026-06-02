import { Briefcase, Calendar, DollarSign, MapPin, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Form } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card'
import { Input } from '~/components/ui/input'
import type { ApplicationWithCompany, Company } from '~/lib/db/schema'
import { formatApplicationDate } from '~/lib/utils/applicationUtils'

interface OverviewTabProps {
  application: ApplicationWithCompany
  company: Company | null
}

export function ApplicationOverviewTab({ application, company }: OverviewTabProps) {
  const [isEditingRecruiter, setIsEditingRecruiter] = useState(false)

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span>{application.position}</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatApplicationDate(application.startDate)}</span>
            </div>

            {application.salaryQuoted && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span>{application.salaryQuoted}</span>
              </div>
            )}
            {application.source && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Source: {application.source}</span>
              </div>
            )}

            {application.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{application.location}</span>
              </div>
            )}

            {application.salaryQuoted && (
              <div>
                <span className="text-sm font-medium text-gray-700">Salary Quoted</span>
                <p className="text-gray-900 mt-1">{application.salaryQuoted}</p>
              </div>
            )}

            {application.source && (
              <div>
                <span className="text-sm font-medium text-gray-700">Source</span>
                <p className="text-gray-900 mt-1">{application.source}</p>
              </div>
            )}
          </div>

          {application.jobPostingUrl && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <a
                href={application.jobPostingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 bg-white border border-gray-300 hover:bg-gray-50 h-9 px-4 py-2"
              >
                View Job Posting
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-sm font-medium text-gray-700">Company Name</span>
              <p className="text-gray-900 mt-1">{company?.name || 'Unknown Company'}</p>
            </div>

            {company?.website && (
              <div>
                <span className="text-sm font-medium text-gray-700">Website</span>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 mt-1 block"
                >
                  {company.website}
                </a>
              </div>
            )}

            {company?.industry && (
              <div>
                <span className="text-sm font-medium text-gray-700">Industry</span>
                <p className="text-gray-900 mt-1">{company.industry}</p>
              </div>
            )}

            {company?.size && (
              <div>
                <span className="text-sm font-medium text-gray-700">Company Size</span>
                <p className="text-gray-900 mt-1">{company.size}</p>
              </div>
            )}

            {company?.location && (
              <div>
                <span className="text-sm font-medium text-gray-700">Company Location</span>
                <p className="text-gray-900 mt-1">{company.location}</p>
              </div>
            )}
          </div>

          {application.companyNotes && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Research Notes</span>
              <p className="text-gray-700 whitespace-pre-wrap mt-1">{application.companyNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recruiter Information */}
      <Card>
        <CardHeader>
          <div className="w-full  flex items-center justify-between">
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
                  <span className="text-sm font-medium text-gray-700">Recruiter Name</span>
                  <Input
                    id="recruiterName"
                    name="recruiterName"
                    placeholder="e.g. John Smith"
                    defaultValue={application.recruiterName || ''}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Recruiter Email</span>
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
                <span className="text-sm font-medium text-gray-700">Recruiter LinkedIn URL</span>
                <Input
                  id="recruiterLinkedin"
                  name="recruiterLinkedin"
                  type="url"
                  placeholder="e.g. https://linkedin.com/in/johnsmith"
                  defaultValue={application.recruiterLinkedin || ''}
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
                <span className="text-sm font-medium text-gray-700">Recruiter Name</span>
                <p className="text-gray-900 mt-1">
                  {application.recruiterName || (
                    <span className="text-gray-500 italic">Not specified</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-700">Recruiter Email</span>
                {application.recruiterEmail ? (
                  <a
                    href={`mailto:${application.recruiterEmail}`}
                    className="text-blue-600 hover:text-blue-800 mt-1 block"
                  >
                    {application.recruiterEmail}
                  </a>
                ) : (
                  <p className="text-gray-500 italic mt-1">Not specified</p>
                )}
              </div>

              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Recruiter LinkedIn</span>
                {application.recruiterLinkedin ? (
                  <a
                    href={application.recruiterLinkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 mt-1 block"
                  >
                    View Profile
                  </a>
                ) : (
                  <p className="text-gray-500 italic mt-1">Not specified</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
