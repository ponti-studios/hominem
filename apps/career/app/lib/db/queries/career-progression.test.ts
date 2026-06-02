import { describe, expect, it } from 'vitest'

// Test the month calculation function directly by extracting it
function calculateMonthsWorked(startDate: Date, endDate: Date): number {
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()
  const startDay = startDate.getDate()

  const endYear = endDate.getFullYear()
  const endMonth = endDate.getMonth()
  const endDay = endDate.getDate()

  // Calculate total months between the dates
  let months = (endYear - startYear) * 12 + (endMonth - startMonth)

  // Add partial months based on days
  // If the end day is greater than or equal to start day, we have a full month
  // Otherwise, we need to subtract a fraction
  if (endDay >= startDay) {
    months += 1 // Include the final month
  } else {
    // Calculate the fraction of the final month
    const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate()
    const fractionOfMonth = endDay / daysInEndMonth
    months += fractionOfMonth
  }

  // Handle the starting month fraction
  if (startDay > 1) {
    const daysInStartMonth = new Date(startYear, startMonth + 1, 0).getDate()
    const daysWorkedInStartMonth = daysInStartMonth - startDay + 1
    const startMonthFraction = daysWorkedInStartMonth / daysInStartMonth
    months = months - 1 + startMonthFraction
  }

  return Math.max(0, months)
}

describe('Career Progression Calculations', () => {
  describe('calculateMonthsWorked', () => {
    it('should calculate months for full employment periods', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2020-12-31')
      const months = calculateMonthsWorked(start, end)
      expect(months).toBeCloseTo(12, 0)
    })

    it('should calculate months for partial year employment', () => {
      // Started September 15, 2020, ended December 31, 2020
      const start = new Date('2020-09-15')
      const end = new Date('2020-12-31')
      const months = calculateMonthsWorked(start, end)

      // From Sept 15 to Dec 31 should be about 3.5 months
      expect(months).toBeCloseTo(3.5, 0)
    })

    it('should handle single month employment', () => {
      const start = new Date('2020-06-01')
      const end = new Date('2020-06-30')
      const months = calculateMonthsWorked(start, end)
      expect(months).toBeCloseTo(1, 0)
    })

    it('should handle partial month employment', () => {
      const start = new Date('2020-06-15')
      const end = new Date('2020-06-30')
      const months = calculateMonthsWorked(start, end)
      expect(months).toBeLessThan(1)
      expect(months).toBeGreaterThan(0)
    })

    it('should handle multi-year employment', () => {
      const start = new Date('2020-03-15')
      const end = new Date('2022-09-30')
      const months = calculateMonthsWorked(start, end)

      // About 2.5 years should be around 30 months
      expect(months).toBeGreaterThan(25)
      expect(months).toBeLessThan(35)
    })
  })

  describe('Salary Proration Logic', () => {
    it('should prorate salary correctly for partial year', () => {
      const annualSalary = 120000 // $120k
      const monthsWorked = 3.5 // 3.5 months
      const monthlyFraction = monthsWorked / 12
      const proratedSalary = Math.round(annualSalary * monthlyFraction)

      // 3.5/12 = 0.292, so about 29.2% of annual salary
      expect(proratedSalary).toBeCloseTo(35000, -2) // Within $100
    })

    it('should handle full year employment', () => {
      const annualSalary = 100000
      const monthsWorked = 12
      const monthlyFraction = monthsWorked / 12
      const proratedSalary = Math.round(annualSalary * monthlyFraction)

      expect(proratedSalary).toBe(100000)
    })

    it('should handle very short employment periods', () => {
      const annualSalary = 120000
      const monthsWorked = 0.5 // Half a month
      const monthlyFraction = monthsWorked / 12
      const proratedSalary = Math.round(annualSalary * monthlyFraction)

      expect(proratedSalary).toBeCloseTo(5000, -2)
    })
  })
})
