import { eq } from 'drizzle-orm'
import { useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { Form, Link, redirect, useActionData } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/Card'
import { Input } from '~/components/ui/input'
import { LoadingSpinner } from '~/components/ui/LoadingSpinner'
import { Select } from '~/components/ui/select'
import { db } from '~/lib/db'
import { companies, jobApplications } from '~/lib/db/schema'
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthAction,
  withAuthLoader,
} from '~/lib/route-utils'
import type { JobPosting, ScrapedJobPostingResponse } from '~/types/applications'
import { JobApplicationStage, JobApplicationStatus } from '~/types/career'

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    return createSuccessResponse({ user })
  })
}

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user, request }) => {
    const formData = await request.formData()
    const position = formData.get('position') as string
    const companyName = formData.get('company') as string
    const startDate = formData.get('startDate') as string
    const status = formData.get('status') as JobApplicationStatus
    const location = formData.get('location') as string
    const jobPosting = formData.get('jobPosting') as string
    const jobPostingData = formData.get('jobPostingData') as string
    const salaryQuoted = formData.get('salaryQuoted') as string
    const recruiterName = formData.get('recruiterName') as string
    const recruiterEmail = formData.get('recruiterEmail') as string
    const recruiterLinkedin = formData.get('recruiterLinkedin') as string

    try {
      if (!position || !companyName) {
        return createErrorResponse('Position and company are required')
      }

      // Find or create company
      let company = await db
        .select()
        .from(companies)
        .where(eq(companies.name, companyName))
        .limit(1)

      if (company.length === 0) {
        const [newCompany] = await db.insert(companies).values({ name: companyName }).returning()
        company = [newCompany]
      }

      // Use structured data if available, otherwise use the job description text
      const jobPostingToStore = jobPostingData || jobPosting

      // Parse the structured data if available
      let requirements: string[] = []
      let skills: string[] = []
      let jobPostingUrl: string | null = null
      let jobPostingWordCount: number | null = null

      if (jobPostingData) {
        try {
          const parsedData = JSON.parse(jobPostingData) as JobPosting
          requirements = parsedData.requirements || []
          skills = parsedData.skills || []
          jobPostingUrl = parsedData.url || null
          jobPostingWordCount = parsedData.wordCount || null
        } catch (error) {
          console.error('Error parsing job posting data:', error)
        }
      }

      // Create job application
      const [newApplication] = await db
        .insert(jobApplications)
        .values({
          userId: user.id,
          position,
          companyId: company[0].id,
          status,
          startDate: new Date(startDate),
          location: location || null,
          jobPosting: jobPostingToStore || null,
          requirements,
          skills,
          jobPostingUrl,
          jobPostingWordCount,
          salaryQuoted: salaryQuoted || null,
          recruiterName: recruiterName || null,
          recruiterEmail: recruiterEmail || null,
          recruiterLinkedin: recruiterLinkedin || null,
          reference: false,
          stages: [
            {
              stage: JobApplicationStage.APPLICATION,
              date: new Date().toISOString(),
            },
          ],
        })
        .returning()

      return redirect('/career/applications')
    } catch (error) {
      console.error('Error creating job application:', error)
      return createErrorResponse('Failed to create job application. Please try again.')
    }
  })
}

export default function CreateJobApplication() {
  const actionData = useActionData<{ success: boolean; error?: string }>()
  const [inputMethod, setInputMethod] = useState<'manual' | 'url' | 'paste' | null>(null)
  const [scrapedData, setScrapedData] = useState<JobPosting | null>(null)
  const [pastedDescription, setPastedDescription] = useState('')
  const [url, setUrl] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [scrapingError, setScrapingError] = useState<string | null>(null)

  const handleScrapedData = (data: JobPosting) => {
    setScrapedData(data)
    setInputMethod('manual')
  }

  const handleScrape = async () => {
    if (!url.trim()) return
    setIsScraping(true)
    setScrapingError(null)

    try {
      const response = await fetch('/api/job/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const result: ScrapedJobPostingResponse = await response.json()

      if (result.success && result.jobPosting) {
        handleScrapedData(result.jobPosting)
      } else {
        setScrapingError(result.error || 'Failed to scrape job posting.')
      }
    } catch (error) {
      console.error('Scraping error:', error)
      setScrapingError('An unexpected error occurred.')
    } finally {
      setIsScraping(false)
    }
  }

  const handlePasteDescription = () => {
    if (pastedDescription.trim()) {
      // Create a basic JobPosting object from pasted text
      const basicJobPosting: JobPosting = {
        jobTitle: '',
        companyName: '',
        companyDescription: '',
        jobDescription: pastedDescription,
        location: '',
        requirements: [],
        skills: [],
        fullText: pastedDescription,
        url: '',
        scrapedAt: new Date().toISOString(),
        wordCount: pastedDescription.split(' ').length,
      }
      setScrapedData(basicJobPosting)
      setInputMethod('manual')
    }
  }

  return (
    <div>
      <div className="container mx-auto py-4">
        <div className="max-w-3xl mx-auto">
          {/* Input Method Selection */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-4">
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                How would you like to add this job?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setInputMethod('url')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    inputMethod === 'url'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">🔗</div>
                    <div className="font-medium">Scrape from URL</div>
                    <div className="text-sm text-gray-500 mt-1">Paste a job posting URL</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMethod('paste')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    inputMethod === 'paste'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">📋</div>
                    <div className="font-medium">Paste Description</div>
                    <div className="text-sm text-gray-500 mt-1">Copy & paste job details</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMethod('manual')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    inputMethod === 'manual'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">✏️</div>
                    <div className="font-medium">Manual Entry</div>
                    <div className="text-sm text-gray-500 mt-1">Fill out form manually</div>
                  </div>
                </button>
              </div>

              {/* URL Scraping */}
              {inputMethod === 'url' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      name="url"
                      id="url"
                      placeholder="Paste job posting URL..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="h-11"
                      disabled={isScraping}
                    />
                    <Button
                      type="button"
                      onClick={handleScrape}
                      disabled={isScraping || !url.trim()}
                      className="h-11"
                      variant="default"
                    >
                      {isScraping ? <LoadingSpinner size="sm" /> : 'Scrape'}
                    </Button>
                  </div>
                  {scrapingError && <p className="text-red-500 text-sm mt-2">{scrapingError}</p>}
                </div>
              )}

              {/* Paste Description */}
              {inputMethod === 'paste' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-md font-semibold text-gray-800 mb-4">
                    Paste Job Description
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label
                        htmlFor="pastedDescription"
                        className="block text-sm font-medium text-gray-700 mb-2 sr-only"
                      >
                        Job Description
                      </label>
                      <textarea
                        id="pastedDescription"
                        value={pastedDescription}
                        onChange={(e) => setPastedDescription(e.target.value)}
                        rows={8}
                        placeholder="Paste the job description here..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div className="text-center">
                      <Button
                        onClick={handlePasteDescription}
                        disabled={!pastedDescription.trim()}
                        variant="default"
                      >
                        Use This Description
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Form (conditionally rendered) */}
          {inputMethod === 'manual' && (
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                {actionData && !actionData.success && (
                  <div className="mb-6 p-4 text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 text-sm">!</span>
                    </div>
                    {actionData.error}
                  </div>
                )}

                {/* Scraped Data Preview */}
                {scrapedData && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <span className="text-blue-600">📋</span>
                      Extracted Job Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {scrapedData.requirements.length > 0 && (
                        <div>
                          <h4 className="font-medium text-blue-800 mb-2">Requirements</h4>
                          <ul className="space-y-1">
                            {scrapedData.requirements.slice(0, 5).map((req, index) => (
                              <li
                                key={`req-${index}-${req.slice(0, 20)}`}
                                className="text-sm text-blue-700 flex items-start gap-2"
                              >
                                <span className="text-blue-500 mt-1">•</span>
                                <span>{req}</span>
                              </li>
                            ))}
                            {scrapedData.requirements.length > 5 && (
                              <li className="text-sm text-blue-600 italic">
                                +{scrapedData.requirements.length - 5} more requirements
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {scrapedData.skills.length > 0 && (
                        <div>
                          <h4 className="font-medium text-blue-800 mb-2">Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {scrapedData.skills.slice(0, 8).map((skill, index) => (
                              <span
                                key={`skill-${skill}`}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md"
                              >
                                {skill}
                              </span>
                            ))}
                            {scrapedData.skills.length > 8 && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-md italic">
                                +{scrapedData.skills.length - 8} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {scrapedData.companyDescription && (
                      <div className="mt-4">
                        <h4 className="font-medium text-blue-800 mb-2">Company Description</h4>
                        <p className="text-sm text-blue-700 leading-relaxed">
                          {scrapedData.companyDescription.length > 200
                            ? `${scrapedData.companyDescription.substring(0, 200)}...`
                            : scrapedData.companyDescription}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <div className="flex flex-wrap gap-4 text-xs text-blue-600">
                        <span>📊 {scrapedData.wordCount} words</span>
                        <span>🔗 {scrapedData.url ? 'URL available' : 'No URL'}</span>
                        <span>📅 {new Date(scrapedData.scrapedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Form method="post" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="position" className="text-sm font-medium text-gray-700">
                        Job Title *
                      </label>
                      <Input
                        id="position"
                        name="position"
                        placeholder="e.g. Senior Software Engineer"
                        required
                        className="h-11"
                        defaultValue={scrapedData?.jobTitle || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="company" className="text-sm font-medium text-gray-700">
                        Company *
                      </label>
                      <Input
                        id="company"
                        name="company"
                        placeholder="e.g. Google, Microsoft"
                        required
                        className="h-11"
                        defaultValue={scrapedData?.companyName || ''}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="startDate" className="text-sm font-medium text-gray-700">
                        Application Date *
                      </label>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="status" className="text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <Select name="status" defaultValue={JobApplicationStatus.APPLIED}>
                        <option value="" disabled>
                          Select Status
                        </option>
                        {Object.values(JobApplicationStatus).map((status) => (
                          <option key={status} value={status}>
                            {status.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="location" className="text-sm font-medium text-gray-700">
                      Location
                    </label>
                    <Input
                      id="location"
                      name="location"
                      placeholder="e.g. San Francisco, CA or Remote"
                      className="h-11"
                      defaultValue={scrapedData?.location || ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="jobPosting" className="text-sm font-medium text-gray-700">
                      Job Description
                    </label>
                    <textarea
                      id="jobPosting"
                      name="jobPosting"
                      rows={6}
                      placeholder="Paste the job description here..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      defaultValue={scrapedData ? scrapedData.jobDescription : ''}
                    />
                    {/* Hidden field to store full structured data */}
                    {scrapedData && (
                      <input
                        type="hidden"
                        name="jobPostingData"
                        value={JSON.stringify(scrapedData)}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="salaryQuoted" className="text-sm font-medium text-gray-700">
                      Salary Range
                    </label>
                    <Input
                      id="salaryQuoted"
                      name="salaryQuoted"
                      placeholder="e.g. $120k - $150k or $80/hour"
                      className="h-11"
                    />
                  </div>

                  {/* Recruiter Information */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Recruiter Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label
                          htmlFor="recruiterName"
                          className="text-sm font-medium text-gray-700"
                        >
                          Recruiter Name
                        </label>
                        <Input
                          id="recruiterName"
                          name="recruiterName"
                          placeholder="e.g. John Smith"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="recruiterEmail"
                          className="text-sm font-medium text-gray-700"
                        >
                          Recruiter Email
                        </label>
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
                      <label
                        htmlFor="recruiterLinkedin"
                        className="text-sm font-medium text-gray-700"
                      >
                        Recruiter LinkedIn URL
                      </label>
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
                      className="flex-1 h-11 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                    >
                      Cancel
                    </Link>
                  </div>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
