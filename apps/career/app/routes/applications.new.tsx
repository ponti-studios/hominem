import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { DatePicker } from '@hominem/ui/date-picker';
import { Input } from '@hominem/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { useState } from 'react';
import { Form, Link, redirect } from 'react-router';

import type { JobScrapeApiRequest, JobScrapeApiResponse } from '~/lib/api-contracts';
import { userContext } from '~/lib/middleware';
import { JobApplicationsService } from '~/lib/services/job-applications.service';
import { cn } from '~/lib/utils';
import type { JobPosting } from '~/types/applications';
import { JobApplicationStatus } from '~/types/career';

import { Route } from './+types/applications.new';

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return { user };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    throw new Response('User not found', { status: 401 });
  }
  const formData = await request.formData();
  const position = formData.get('position') as string;
  const companyName = formData.get('company') as string;
  const start_date = formData.get('start_date') as string;
  const status = formData.get('status') as JobApplicationStatus;
  const location = formData.get('location') as string;
  const job_posting = formData.get('job_posting') as string;
  const jobPostingData = formData.get('jobPostingData') as string;
  const salary_quoted = formData.get('salary_quoted') as string;
  const recruiter_name = formData.get('recruiter_name') as string;
  const recruiter_email = formData.get('recruiter_email') as string;
  const recruiter_linkedin = formData.get('recruiter_linkedin') as string;

  if (!position || !companyName) {
    throw new Response('Position and company are required', { status: 400 });
  }

  let requirements: string[] = [];
  let skills: string[] = [];
  let job_posting_url: string | null = null;
  let job_posting_word_count: number | null = null;

  if (jobPostingData) {
    try {
      const parsed = JSON.parse(jobPostingData) as JobPosting;
      requirements = parsed.requirements || [];
      skills = parsed.skills || [];
      job_posting_url = parsed.url || null;
      job_posting_word_count = parsed.wordCount || null;
    } catch {
      // fall through with defaults
    }
  }

  try {
    await JobApplicationsService.createApplication(user.id, {
      companyName,
      position,
      status,
      start_date: new Date(start_date),
      location: location || null,
      job_posting: jobPostingData || job_posting || null,
      requirements,
      skills,
      job_posting_url,
      job_posting_word_count,
      salary_quoted: salary_quoted || null,
      recruiter_name: recruiter_name || null,
      recruiter_email: recruiter_email || null,
      recruiter_linkedin: recruiter_linkedin || null,
    });

    return redirect('/applications');
  } catch (error) {
    console.error('Error creating job application:', error);
    throw new Response('Failed to create job application. Please try again.', { status: 500 });
  }
}

export default function CreateJobApplication() {
  const [inputMethod, setInputMethod] = useState<'manual' | 'url' | 'paste' | null>(null);
  const [scrapedData, setScrapedData] = useState<JobPosting | null>(null);
  const [pastedDescription, setPastedDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingError, setScrapingError] = useState<string | null>(null);
  const [application_date, setApplicationDate] = useState(() => new Date());

  const handleScrapedData = (data: JobPosting) => {
    setScrapedData(data);
    setInputMethod('manual');
  };

  const handleScrape = async () => {
    if (!url.trim()) return;
    setIsScraping(true);
    setScrapingError(null);

    try {
      const response = await fetch('/api/job/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url } satisfies JobScrapeApiRequest),
      });

      const result: JobScrapeApiResponse = await response.json();

      if (result.job_posting) {
        handleScrapedData(result.job_posting);
      } else {
        setScrapingError(result.error || 'Failed to scrape job posting.');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setScrapingError('An unexpected error occurred.');
    } finally {
      setIsScraping(false);
    }
  };

  const handlePasteDescription = () => {
    if (pastedDescription.trim()) {
      // Create a basic JobPosting object from pasted text
      const basicJobPosting: JobPosting = {
        job_title: '',
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
      };
      setScrapedData(basicJobPosting);
      setInputMethod('manual');
    }
  };

  return (
    <div>
      <div className="container mx-auto py-4">
        <div className="max-w-3xl mx-auto">
          {/* Input Method Selection */}
          <Card className=" border-0 bg-background/80 backdrop-blur-sm mb-4">
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                How would you like to add this job?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setInputMethod('url')}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    inputMethod === 'url'
                      ? 'border-primary bg-accent/10 text-primary'
                      : 'border-border bg-card hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-center">
                    <div className="font-medium">Scrape from URL</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Paste a job posting URL
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMethod('paste')}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    inputMethod === 'paste'
                      ? 'border-primary bg-accent/10 text-primary'
                      : 'border-border bg-card hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-center">
                    <div className="font-medium">Paste Description</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Copy & paste job details
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMethod('manual')}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    inputMethod === 'manual'
                      ? 'border-primary bg-accent/10 text-primary'
                      : 'border-border bg-card hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-center">
                    <div className="font-medium">Manual Entry</div>
                    <div className="text-sm text-muted-foreground mt-1">Fill out form manually</div>
                  </div>
                </button>
              </div>

              {/* URL Scraping */}
              {inputMethod === 'url' && (
                <div className="mt-4 pt-4 border-t border-border">
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
                      isLoading={isScraping}
                      loadingLabel="Scraping..."
                    >
                      Scrape
                    </Button>
                  </div>
                  {scrapingError && <p className="text-red-500 text-sm mt-2">{scrapingError}</p>}
                </div>
              )}

              {/* Paste Description */}
              {inputMethod === 'paste' && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-md font-semibold text-foreground mb-4">
                    Paste Job Description
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label
                        htmlFor="pastedDescription"
                        className="block text-sm font-medium text-muted-foreground mb-2 sr-only"
                      >
                        Job Description
                      </label>
                      <textarea
                        id="pastedDescription"
                        value={pastedDescription}
                        onChange={(e) => setPastedDescription(e.target.value)}
                        rows={8}
                        placeholder="Paste the job description here..."
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring/50 focus:border-transparent resize-none"
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
            <Card className=" border-0 bg-background/80 backdrop-blur-sm">
              <CardContent className="p-4">
                {/* Scraped Data Preview */}
                {scrapedData && (
                  <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Extracted Job Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {scrapedData.requirements.length > 0 && (
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Requirements</h4>
                          <ul className="space-y-1">
                            {scrapedData.requirements.slice(0, 5).map((req, index) => (
                              <li
                                key={`req-${index}-${req.slice(0, 20)}`}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <span className="mt-1">•</span>
                                <span>{req}</span>
                              </li>
                            ))}
                            {scrapedData.requirements.length > 5 && (
                              <li className="text-sm text-muted-foreground italic">
                                +{scrapedData.requirements.length - 5} more requirements
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {scrapedData.skills.length > 0 && (
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {scrapedData.skills.slice(0, 8).map((skill, _index) => (
                              <span
                                key={`skill-${skill}`}
                                className="px-2 py-1 bg-accent/20 text-muted-foreground text-xs rounded-md"
                              >
                                {skill}
                              </span>
                            ))}
                            {scrapedData.skills.length > 8 && (
                              <span className="px-2 py-1 bg-accent/20 text-primary text-xs rounded-md italic">
                                +{scrapedData.skills.length - 8} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {scrapedData.companyDescription && (
                      <div className="mt-4">
                        <h4 className="font-medium text-foreground mb-2">Company Description</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {scrapedData.companyDescription.length > 200
                            ? `${scrapedData.companyDescription.substring(0, 200)}...`
                            : scrapedData.companyDescription}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-accent/30">
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>{scrapedData.wordCount} words</span>
                        {scrapedData.url && <span>URL captured</span>}
                        <span>{new Date(scrapedData.scrapedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Form method="post" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label
                        htmlFor="position"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Job Title *
                      </label>
                      <Input
                        id="position"
                        name="position"
                        placeholder="e.g. Senior Software Engineer"
                        required
                        className="h-11"
                        defaultValue={scrapedData?.job_title || ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="company"
                        className="text-sm font-medium text-muted-foreground"
                      >
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
                      <DatePicker
                        id="start_date"
                        label="Application Date *"
                        value={application_date}
                        onSelect={(nextDate) => {
                          if (nextDate) {
                            setApplicationDate(nextDate);
                          }
                        }}
                        placeholder="Pick application date"
                        containerClassName="min-w-0"
                      />
                      <input
                        type="hidden"
                        name="start_date"
                        value={application_date.toISOString().split('T')[0]}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="status" className="text-sm font-medium text-muted-foreground">
                        Status
                      </label>
                      <Select name="status" defaultValue={JobApplicationStatus.APPLIED}>
                        <SelectTrigger id="status" className="w-full">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(JobApplicationStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="location" className="text-sm font-medium text-muted-foreground">
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
                    <label
                      htmlFor="job_posting"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Job Description
                    </label>
                    <textarea
                      id="job_posting"
                      name="job_posting"
                      rows={6}
                      placeholder="Paste the job description here..."
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring/50 focus:border-transparent resize-none"
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
                    <label
                      htmlFor="salary_quoted"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Salary Range
                    </label>
                    <Input
                      id="salary_quoted"
                      name="salary_quoted"
                      placeholder="e.g. $120k - $150k or $80/hour"
                      className="h-11"
                    />
                  </div>

                  {/* Recruiter Information */}
                  <div className="pt-4 border-t border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Recruiter Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label
                          htmlFor="recruiter_name"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Recruiter Name
                        </label>
                        <Input
                          id="recruiter_name"
                          name="recruiter_name"
                          placeholder="e.g. John Smith"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="recruiter_email"
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Recruiter Email
                        </label>
                        <Input
                          id="recruiter_email"
                          name="recruiter_email"
                          type="email"
                          placeholder="e.g. john.smith@company.com"
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      <label
                        htmlFor="recruiter_linkedin"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Recruiter LinkedIn URL
                      </label>
                      <Input
                        id="recruiter_linkedin"
                        name="recruiter_linkedin"
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
                      className="flex-1 h-11 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors border border-border bg-card hover:bg-muted text-muted-foreground"
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
  );
}
