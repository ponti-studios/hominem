#!/usr/bin/env tsx
/* eslint-disable no-console */

import { parse } from 'csv-parse/sync'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { client, db, schema } from '../app/lib/db'

// Define the CSV row structure
interface CSVRow {
  Position: string
  Company: string
  status: string
  job_posting: string
  stages: string
  phone_screen: string
  date: string
  Reference: string
  end_date: string
  location: string
  company_url: string
  salary_accepted: string
  salary_quoted: string
}

// Map CSV status to database status
function mapStatus(csvStatus: string): string {
  const statusMap: Record<string, string> = {
    Application: 'APPLIED',
    Rejected: 'REJECTED',
    Withdrew: 'WITHDRAWN',
    Hired: 'ACCEPTED',
    application: 'APPLIED',
    'phone screen': 'PHONE_SCREEN',
    interview: 'INTERVIEW',
    offer: 'OFFER',
  }

  return statusMap[csvStatus] || 'APPLIED'
}

// Clean company name from CSV (remove Notion-style references)
function cleanCompanyName(companyStr: string): string {
  // Remove everything after the first opening parenthesis or comma
  return companyStr.split('(')[0].split(',')[0].trim()
}

// Parse date string to Date object
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  try {
    // Handle various date formats
    if (dateStr.includes(',')) {
      // Format: "January 2, 2025" or "January 2, 2025 5:15 AM (PST)"
      const datePart = dateStr.split(' at ')[0].split(' 5:')[0]
      return new Date(datePart)
    }

    // Try direct parsing
    return new Date(dateStr)
  } catch (error) {
    console.warn(`Could not parse date: ${dateStr}`)
    return null
  }
}

// Parse salary string to cents
function parseSalary(salaryStr: string): number | null {
  if (!salaryStr || salaryStr.trim() === '') return null

  // Remove currency symbols and commas
  const cleanSalary = salaryStr.replace(/[$,]/g, '')
  const salary = Number.parseFloat(cleanSalary)

  if (Number.isNaN(salary)) return null

  // Convert to cents
  return Math.round(salary * 100)
}

// Parse stages into structured format
function parseStages(stagesStr: string): Array<{ stage: string; date: string; notes?: string }> {
  if (!stagesStr || stagesStr.trim() === '') return []

  const stages = stagesStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return stages.map((stage) => ({
    stage,
    date: new Date().toISOString(), // Default to current date since we don't have stage dates
  }))
}

// Parse interview dates (simplified since we don't have detailed interview data)
function parseInterviewDates(
  phoneScreen: string,
  stages: string
): Array<{
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'final'
  date: string
  duration?: number
  interviewer?: string
  notes?: string
}> {
  const interviews: Array<{
    type: 'phone' | 'video' | 'onsite' | 'technical' | 'final'
    date: string
    duration?: number
    interviewer?: string
    notes?: string
  }> = []

  if (phoneScreen && phoneScreen.toLowerCase() === 'true') {
    interviews.push({
      type: 'phone' as const,
      date: new Date().toISOString(),
      notes: 'Phone screen conducted',
    })
  }

  if (stages?.includes('interview')) {
    interviews.push({
      type: 'video' as const,
      date: new Date().toISOString(),
      notes: 'Interview conducted',
    })
  }

  return interviews
}

async function main() {
  console.info('🚀 Starting job applications data injection...')

  // Read and parse CSV file
  let csvContent = readFileSync('./job-applications.csv', 'utf-8')

  // Remove BOM if present
  if (csvContent.charCodeAt(0) === 0xfeff) {
    csvContent = csvContent.slice(1)
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relaxQuotes: true,
    relaxColumnCount: true,
  }) as Record<string, string>[]

  console.info(`📄 Found ${records.length} job applications in CSV`)

  // Get or create a default user (you may need to adjust this)
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, 'thecharlesponti@gmail.com'),
  })

  if (!user) {
    throw new Error('User not found. Please create a user first.')
  }

  console.info(`👤 Using user: ${user.name} (${user.email})`)

  let companiesCreated = 0
  let applicationsCreated = 0
  let applicationsSkipped = 0

  let recordIndex = 0
  for (const record of records) {
    try {
      recordIndex++

      // Access properties directly since we know the CSV structure
      const position = record.Position
      const companyName = record.Company
      const status = record.status

      // Skip empty rows - be more specific about what's empty
      if (!position || position.trim() === '' || !companyName || companyName.trim() === '') {
        console.warn(
          `⚠️  Skipping #${recordIndex} due to missing data - Position: "${position}", Company: "${companyName}"`
        )
        console.info(`🔍 Raw record #${recordIndex}:`, JSON.stringify(record, null, 2))
        applicationsSkipped++
        continue
      }

      const cleanedCompanyName = cleanCompanyName(companyName)

      // Get or create company
      let companyRecord = await db.query.companies.findFirst({
        where: eq(schema.companies.name, cleanedCompanyName),
      })

      if (!companyRecord) {
        const [newCompany] = await db
          .insert(schema.companies)
          .values({
            name: cleanedCompanyName,
            website: record.company_url || null,
            location: record.location || null,
          })
          .returning()
        companyRecord = newCompany
        companiesCreated++
      }

      // Parse dates
      const applicationDate = parseDate(record.date)
      const endDate = parseDate(record.end_date)

      // Parse salaries
      const salaryQuoted = parseSalary(record.salary_quoted)
      const salaryAccepted = parseSalary(record.salary_accepted)

      // Parse stages and interviews
      const stages = parseStages(record.stages)
      const interviewDates = parseInterviewDates(record.phone_screen, record.stages)

      // Create job application
      await db.insert(schema.jobApplications).values({
        userId: user.id,
        companyId: companyRecord.id,
        position: position,
        status: mapStatus(status),
        startDate: applicationDate || new Date(), // Use application date or current date
        endDate: endDate,
        location: record.location || null,
        jobPosting: record.job_posting || null,
        salaryQuoted: record.salary_quoted || null,
        salaryAccepted: record.salary_accepted || null,
        salaryOffered: salaryQuoted,
        salaryFinal: salaryAccepted,
        applicationDate: applicationDate,
        source: record.job_posting ? 'company_website' : 'other',
        reference: record.Reference?.toLowerCase() === 'true',
        stages: stages,
        interviewDates: interviewDates,
      })

      applicationsCreated++

      // Show progress every 10 records
      if (applicationsCreated % 10 === 0) {
        console.info(`📈 Progress: ${applicationsCreated} applications created`)
      }
    } catch (error) {
      console.error(`❌ Error processing application: ${record.Position} at ${record.Company}`)
      console.error(error)
      applicationsSkipped++
    }
  }

  console.info('\n📊 Import Summary:')
  console.info(`✅ Companies created: ${companiesCreated}`)
  console.info(`✅ Applications created: ${applicationsCreated}`)
  console.warn(`⚠️  Applications skipped: ${applicationsSkipped}`)
  console.info(`📈 Total processed: ${records.length}`)

  // Close database connection
  await client.end()
  console.info('\n🎉 Data injection completed!')
}

// Handle errors and run the script
main().catch((error) => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})
