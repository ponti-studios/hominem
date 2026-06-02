import { getServerEnv } from '~/lib/env'
import type { JobPosting, ScrapedJobPostingResponse } from '~/types/applications'

export class JobScrapingService {
  private readonly cloudflareAccountId: string
  private readonly cloudflareApiToken: string

  constructor() {
    try {
      const env = getServerEnv()
      this.cloudflareAccountId = env.VITE_CLOUDFLARE_ACCOUNT_ID || ''
      this.cloudflareApiToken = env.VITE_CLOUDFLARE_API_TOKEN || ''
    } catch (error) {
      // If we're on the client side, these will be empty
      this.cloudflareAccountId = ''
      this.cloudflareApiToken = ''
    }

    if (!this.cloudflareAccountId || !this.cloudflareApiToken) {
      console.warn('Cloudflare credentials not configured. Job scraping will not work.')
    }
  }

  /**
   * Scrape a job posting URL and extract structured data using Cloudflare Browser Rendering API
   */
  async scrapeJobPosting(jobUrl: string): Promise<ScrapedJobPostingResponse> {
    try {
      if (!this.cloudflareAccountId || !this.cloudflareApiToken) {
        throw new Error('Cloudflare credentials not configured')
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/browser-rendering/json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cloudflareApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: jobUrl,
            prompt:
              'Extract the job posting content, including job title, company name, job description, requirements, responsibilities, and qualifications. Remove any navigation, ads, or unrelated content.',
            response_format: {
              type: 'json_schema',
              json_schema: {
                type: 'object',
                properties: {
                  jobTitle: {
                    type: 'string',
                    description: 'The job title or position name',
                  },
                  companyName: {
                    type: 'string',
                    description: 'The company name',
                  },
                  companyDescription: {
                    type: 'string',
                    description: 'The company description',
                  },
                  jobDescription: {
                    type: 'string',
                    description: 'The main job description and responsibilities',
                  },
                  location: {
                    type: 'string',
                    description: 'The location of the job',
                  },
                  requirements: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of job requirements and qualifications',
                  },
                  skills: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of required or preferred skills',
                  },
                  fullText: {
                    type: 'string',
                    description: 'The complete cleaned text content of the job posting',
                  },
                },
                required: ['fullText', 'jobTitle'],
              },
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(
          `Cloudflare API returned error: ${result.errors?.[0]?.message || 'Unknown error'}`
        )
      }

      const extractedData = result.result
      const fullText = extractedData.fullText || ''

      // Clean up the text content
      const cleanedText = this.cleanJobPostingText(fullText)

      const jobPosting: JobPosting = {
        jobTitle: extractedData.jobTitle || 'Unknown Position',
        companyName: extractedData.companyName || 'Unknown Company',
        companyDescription: extractedData.companyDescription || '',
        jobDescription: extractedData.jobDescription || cleanedText,
        location: extractedData.location || '',
        requirements: extractedData.requirements || [],
        skills: extractedData.skills || [],
        fullText: cleanedText,
        url: jobUrl,
        scrapedAt: new Date().toISOString(),
        wordCount: cleanedText.split(/\s+/).length,
      }

      return {
        success: true,
        jobPosting,
      }
    } catch (error) {
      console.error('Job posting scraping failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Check if the job scraping service is healthy
   */
  async checkHealth(): Promise<{ status: string; runtime?: string; timestamp?: string }> {
    try {
      if (!this.cloudflareAccountId || !this.cloudflareApiToken) {
        return { status: 'unhealthy', runtime: 'direct-api', timestamp: new Date().toISOString() }
      }

      // Test with a simple request
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/browser-rendering/json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cloudflareApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: 'https://example.com',
            prompt: 'Extract the page title',
            response_format: {
              type: 'json_schema',
              json_schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                },
              },
            },
          }),
        }
      )

      if (!response.ok) {
        return { status: 'unhealthy', runtime: 'direct-api', timestamp: new Date().toISOString() }
      }

      return { status: 'healthy', runtime: 'direct-api', timestamp: new Date().toISOString() }
    } catch (error) {
      console.error('Health check failed:', error)
      return { status: 'unhealthy', runtime: 'direct-api', timestamp: new Date().toISOString() }
    }
  }

  /**
   * Scrape job posting and validate the content
   */
  async scrapeAndValidateJobPosting(jobUrl: string): Promise<ScrapedJobPostingResponse> {
    const result = await this.scrapeJobPosting(jobUrl)

    if (result.success && result.jobPosting) {
      // Basic validation - ensure we got meaningful content
      const wordCount = result.jobPosting.wordCount

      if (wordCount < 50) {
        return {
          success: false,
          error: 'Job posting appears to be too short or empty. Please check the URL.',
        }
      }

      // Check for common job posting indicators
      const hasJobContent =
        /(job|position|role|responsibilities|requirements|qualifications)/i.test(
          result.jobPosting.fullText
        )

      if (!hasJobContent) {
        return {
          success: false,
          error: "The page doesn't appear to contain job posting content. Please verify the URL.",
        }
      }
    }

    return result
  }

  /**
   * Clean and format job posting text content
   */
  private cleanJobPostingText(text: string): string {
    return (
      text
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove common job board noise
        .replace(/apply now|apply for this job|submit application/gi, '')
        .replace(/share this job|bookmark|save job/gi, '')
        // Remove email addresses
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
        // Remove phone numbers
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '')
        // Remove URLs
        .replace(/https?:\/\/[^\s]+/g, '')
        // Remove excessive punctuation
        .replace(/[.!?]{2,}/g, '.')
        // Trim whitespace
        .trim()
    )
  }
}

// Export a singleton instance
export const jobScrapingService = new JobScrapingService()
