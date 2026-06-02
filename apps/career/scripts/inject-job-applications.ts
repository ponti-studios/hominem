#!/usr/bin/env tsx
/* eslint-disable no-console */

import { CareerRepository, getDb, pool } from '@hominem/db'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'node:fs'

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

function cleanCompanyName(companyStr: string): string {
  return companyStr.split('(')[0].split(',')[0].trim()
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  try {
    if (dateStr.includes(',')) {
      const datePart = dateStr.split(' at ')[0].split(' 5:')[0]
      return new Date(datePart)
    }

    return new Date(dateStr)
  } catch {
    console.warn(`Could not parse date: ${dateStr}`)
    return null
  }
}

function parseSalary(salaryStr: string): number | null {
  if (!salaryStr || salaryStr.trim() === '') return null

  const cleanSalary = salaryStr.replace(/[$,]/g, '')
  const salary = Number.parseFloat(cleanSalary)

  if (Number.isNaN(salary)) return null

  return Math.round(salary * 100)
}

function parseStages(stagesStr: string): Array<{ stage: string; date: string; notes?: string }> {
  if (!stagesStr || stagesStr.trim() === '') return []

  return stagesStr
    .split(',')
    .map((stage) => stage.trim())
    .filter(Boolean)
    .map((stage) => ({
      stage,
      date: new Date().toISOString(),
    }))
}

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
      type: 'phone',
      date: new Date().toISOString(),
      notes: 'Phone screen conducted',
    })
  }

  if (stages?.includes('interview')) {
    interviews.push({
      type: 'video',
      date: new Date().toISOString(),
      notes: 'Interview conducted',
    })
  }

  return interviews
}

async function main() {
  console.info('🚀 Starting job applications data injection...')

  let csvContent = readFileSync('./job-applications.csv', 'utf-8')

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

  const db = getDb()
  const user = await db
    .selectFrom('user')
    .select(['id', 'email', 'name'])
    .where('email', '=', 'thecharlesponti@gmail.com')
    .executeTakeFirst()

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

      const position = record.Position
      const companyName = record.Company
      const status = record.status

      if (!position || position.trim() === '' || !companyName || companyName.trim() === '') {
        console.warn(
          `⚠️  Skipping #${recordIndex} due to missing data - Position: "${position}", Company: "${companyName}"`
        )
        console.info(`🔍 Raw record #${recordIndex}:`, JSON.stringify(record, null, 2))
        applicationsSkipped++
        continue
      }

      const cleanedCompanyName = cleanCompanyName(companyName)

      const existingCompany = await db
        .selectFrom('app.companies')
        .select('id')
        .where('owner_userid', '=', user.id)
        .where(({ eb, fn }) => eb(fn('lower', ['name']), '=', cleanedCompanyName.toLowerCase()))
        .executeTakeFirst()

      const companyRecord = await CareerRepository.findOrCreateCompany(db, user.id, {
        name: cleanedCompanyName,
        website: record.company_url || null,
        location: record.location || null,
      })

      if (!existingCompany) {
        companiesCreated++
      }

      const applicationDate = parseDate(record.date)
      const endDate = parseDate(record.end_date)
      const salaryQuoted = parseSalary(record.salary_quoted)
      const salaryAccepted = parseSalary(record.salary_accepted)
      const stages = parseStages(record.stages)
      const interviewDates = parseInterviewDates(record.phone_screen, record.stages)

      await CareerRepository.createJobApplication(db, user.id, {
        companyId: companyRecord.id,
        position,
        status: mapStatus(status),
        startDate: applicationDate || new Date(),
        endDate,
        location: record.location || null,
        jobPosting: record.job_posting || null,
        salaryQuoted: record.salary_quoted || null,
        salaryAccepted: record.salary_accepted || null,
        salaryOffered: salaryQuoted,
        salaryFinal: salaryAccepted,
        applicationDate,
        source: record.job_posting ? 'company_website' : 'other',
        reference: record.Reference?.toLowerCase() === 'true',
        stages,
        interviewDates,
      })

      applicationsCreated++

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

  await pool.end()
  console.info('\n🎉 Data injection completed!')
}

main().catch((error) => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})
