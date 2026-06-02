import { describe, expect, it } from 'vitest'
import {
  calculateCAGR,
  calculatePercentageChange,
  centsToDollars,
  createDateRange,
  dollarsToCents,
  formatCurrency,
  formatPercentage,
  getBonusesForYear,
  getCurrentSalary,
  getEmploymentYears,
  monthsBetween,
  safeParseJson,
  yearsBetween,
} from './utils'

describe('Currency Conversion Utils', () => {
  describe('centsToDollars', () => {
    it('should convert cents to dollars correctly', () => {
      expect(centsToDollars(10000)).toBe(100)
      expect(centsToDollars(12345)).toBe(123)
      expect(centsToDollars(0)).toBe(0)
    })

    it('should handle null input', () => {
      expect(centsToDollars(null)).toBe(0)
    })

    it('should round to nearest dollar', () => {
      expect(centsToDollars(12345)).toBe(123)
      expect(centsToDollars(12350)).toBe(124)
    })
  })

  describe('dollarsToCents', () => {
    it('should convert dollars to cents correctly', () => {
      expect(dollarsToCents(100)).toBe(10000)
      expect(dollarsToCents(123.45)).toBe(12345)
      expect(dollarsToCents(0)).toBe(0)
    })

    it('should handle decimal precision', () => {
      expect(dollarsToCents(123.456)).toBe(12346) // rounds up
      expect(dollarsToCents(123.454)).toBe(12345) // rounds down
    })
  })
})

describe('Date and Time Utils', () => {
  describe('yearsBetween', () => {
    it('should calculate years between dates correctly', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2023-01-01')
      expect(yearsBetween(start, end)).toBeCloseTo(3, 1)
    })

    it('should default to current date if end date not provided', () => {
      const start = new Date('2020-01-01')
      const years = yearsBetween(start)
      expect(years).toBeGreaterThan(3)
    })

    it('should handle partial years', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2020-06-01')
      expect(yearsBetween(start, end)).toBeCloseTo(0.41, 1)
    })
  })

  describe('monthsBetween', () => {
    it('should calculate months between dates correctly', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2020-06-01')
      expect(monthsBetween(start, end)).toBeCloseTo(5, 1)
    })

    it('should default to current date if end date not provided', () => {
      const start = new Date('2020-01-01')
      const months = monthsBetween(start)
      expect(months).toBeGreaterThan(40)
    })
  })
})

describe('Salary Utils', () => {
  describe('getCurrentSalary', () => {
    it('should return base salary when no adjustments', () => {
      const experience = { baseSalary: 100000 }
      expect(getCurrentSalary(experience)).toBe(100000)
    })

    it('should return 0 when no base salary', () => {
      const experience = {}
      expect(getCurrentSalary(experience)).toBe(0)
    })

    it('should return most recent salary adjustment', () => {
      const experience = {
        baseSalary: 100000,
        salaryAdjustments: [
          {
            effectiveDate: '2022-01-01',
            newSalary: 110000,
          },
          {
            effectiveDate: '2023-01-01',
            newSalary: 120000,
          },
          {
            effectiveDate: '2021-01-01',
            newSalary: 105000,
          },
        ],
      }
      expect(getCurrentSalary(experience)).toBe(120000)
    })

    it('should handle empty adjustments array', () => {
      const experience = {
        baseSalary: 100000,
        salaryAdjustments: [],
      }
      expect(getCurrentSalary(experience)).toBe(100000)
    })
  })

  describe('calculatePercentageChange', () => {
    it('should calculate percentage increase correctly', () => {
      expect(calculatePercentageChange(100, 120)).toBe(20)
      expect(calculatePercentageChange(80000, 100000)).toBe(25)
    })

    it('should calculate percentage decrease correctly', () => {
      expect(calculatePercentageChange(120, 100)).toBe(-16.666666666666664)
    })

    it('should handle zero old value', () => {
      expect(calculatePercentageChange(0, 100)).toBe(0)
    })

    it('should handle same values', () => {
      expect(calculatePercentageChange(100, 100)).toBe(0)
    })
  })

  describe('calculateCAGR', () => {
    it('should calculate compound annual growth rate correctly', () => {
      // $80k to $120k over 2 years should be about 22.47%
      expect(calculateCAGR(80000, 120000, 2)).toBeCloseTo(22.47, 1)
    })

    it('should handle single year', () => {
      expect(calculateCAGR(100000, 120000, 1)).toBeCloseTo(20, 1)
    })

    it('should handle zero or negative values', () => {
      expect(calculateCAGR(0, 100000, 2)).toBe(0)
      expect(calculateCAGR(100000, 0, 2)).toBe(0)
      expect(calculateCAGR(100000, 120000, 0)).toBe(0)
    })
  })
})

describe('Bonus and Employment Utils', () => {
  describe('getBonusesForYear', () => {
    const bonusHistory = [
      { date: '2022-12-31', amount: 5000 },
      { date: '2023-06-30', amount: 2500 },
      { date: '2023-12-31', amount: 6000 },
      { date: '2024-01-15', amount: 1000 },
    ]

    it('should return total bonuses for specific year', () => {
      expect(getBonusesForYear(bonusHistory, 2023)).toBe(8500)
      expect(getBonusesForYear(bonusHistory, 2022)).toBe(5000)
      expect(getBonusesForYear(bonusHistory, 2024)).toBe(1000)
    })

    it('should return 0 for year with no bonuses', () => {
      expect(getBonusesForYear(bonusHistory, 2021)).toBe(0)
    })

    it('should handle empty or null bonus history', () => {
      expect(getBonusesForYear([], 2023)).toBe(0)
      expect(getBonusesForYear(null as never, 2023)).toBe(0)
    })

    it('should handle bonuses without amounts', () => {
      const invalidBonuses = [{ date: '2023-12-31' }, { date: '2023-06-30', amount: 1000 }]
      expect(getBonusesForYear(invalidBonuses, 2023)).toBe(1000)
    })
  })

  describe('getEmploymentYears', () => {
    it('should return all years for employment period', () => {
      expect(getEmploymentYears('2020-06-01', '2022-03-01')).toEqual([2020, 2021, 2022])
    })

    it('should handle single year employment', () => {
      expect(getEmploymentYears('2020-06-01', '2020-12-31')).toEqual([2020])
    })

    it('should handle ongoing employment (no end date)', () => {
      const years = getEmploymentYears('2020-01-01', null)
      expect(years).toContain(2020)
      expect(years).toContain(2021)
      expect(years).toContain(new Date().getFullYear())
    })

    it('should handle null start date', () => {
      expect(getEmploymentYears(null, '2022-01-01')).toEqual([])
    })

    it('should handle Date objects', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2021-12-31')
      const result = getEmploymentYears(start, end)
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain(2020)
      expect(result).toContain(2021)
    })
  })
})

describe('JSON and Formatting Utils', () => {
  describe('safeParseJson', () => {
    it('should parse valid JSON string', () => {
      const jsonString = '{"name": "John", "age": 30}'
      const result = safeParseJson(jsonString, {})
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should return fallback for invalid JSON', () => {
      const invalidJson = '{ invalid json }'
      const fallback = { default: true }
      const result = safeParseJson(invalidJson, fallback)
      expect(result).toEqual(fallback)
    })

    it('should return object as-is if already parsed', () => {
      const obj = { name: 'John', age: 30 }
      const result = safeParseJson(obj, {})
      expect(result).toEqual(obj)
    })

    it('should return fallback for null/undefined', () => {
      const fallback = { default: true }
      expect(safeParseJson(null, fallback)).toEqual(fallback)
      expect(safeParseJson(undefined, fallback)).toEqual(fallback)
    })
  })

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(10000)).toBe('$100')
      expect(formatCurrency(123456)).toBe('$1,235')
      expect(formatCurrency(0)).toBe('$0')
    })

    it('should handle null input', () => {
      expect(formatCurrency(null)).toBe('$0')
    })

    it('should handle different currencies', () => {
      expect(formatCurrency(10000, 'EUR')).toBe('€100')
      expect(formatCurrency(10000, 'GBP')).toBe('£100')
    })
  })

  describe('formatPercentage', () => {
    it('should format percentage with default precision', () => {
      expect(formatPercentage(25.67)).toBe('25.7%')
      expect(formatPercentage(0)).toBe('0.0%')
      expect(formatPercentage(100)).toBe('100.0%')
    })

    it('should format with custom decimals', () => {
      expect(formatPercentage(25.6789, 2)).toBe('25.68%')
      expect(formatPercentage(25.6789, 0)).toBe('26%')
    })
  })

  describe('createDateRange', () => {
    it('should create date range from strings', () => {
      const range = createDateRange('2020-01-01', '2022-12-31')
      expect(range.start).toEqual(new Date('2020-01-01'))
      expect(range.end).toEqual(new Date('2022-12-31'))
    })

    it('should create date range from Date objects', () => {
      const start = new Date('2020-01-01')
      const end = new Date('2022-12-31')
      const range = createDateRange(start, end)
      expect(range.start).toEqual(start)
      expect(range.end).toEqual(end)
    })

    it('should default end date to current date', () => {
      const range = createDateRange('2020-01-01')
      expect(range.start).toEqual(new Date('2020-01-01'))
      expect(range.end).toBeInstanceOf(Date)
    })

    it('should handle null end date', () => {
      const range = createDateRange('2020-01-01', null)
      expect(range.start).toEqual(new Date('2020-01-01'))
      expect(range.end).toBeInstanceOf(Date)
    })
  })
})
