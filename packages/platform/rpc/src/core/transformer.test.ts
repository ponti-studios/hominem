import { describe, expect, it } from 'vitest'
import { transformDates } from './transformer'

describe('transformDates', () => {
  it('converts ISO date strings to Date objects', () => {
    const result = transformDates('2024-03-15T10:30:00.000Z')
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).toISOString()).toBe('2024-03-15T10:30:00.000Z')
  })

  it('leaves non-date strings unchanged', () => {
    expect(transformDates('hello world')).toBe('hello world')
    expect(transformDates('2024-03-15')).toBe('2024-03-15') // date-only, no time
    expect(transformDates('123')).toBe('123')
  })

  it('handles null and undefined', () => {
    expect(transformDates(null)).toBeNull()
    expect(transformDates(undefined)).toBeUndefined()
  })

  it('handles numbers and booleans', () => {
    expect(transformDates(42)).toBe(42)
    expect(transformDates(true)).toBe(true)
  })

  it('transforms dates in arrays', () => {
    const result = transformDates(['2024-01-01T00:00:00.000Z', 'not a date'])
    expect(result[0]).toBeInstanceOf(Date)
    expect(result[1]).toBe('not a date')
  })

  it('recursively transforms dates in nested objects', () => {
    const input = {
      name: 'Test',
      createdAt: '2024-03-15T10:30:00.000Z',
      nested: {
        updatedAt: '2024-06-01T12:00:00.000Z',
        count: 5,
      },
    }
    const result = transformDates(input)
    expect(result.name).toBe('Test')
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.nested.updatedAt).toBeInstanceOf(Date)
    expect(result.nested.count).toBe(5)
  })

  it('handles arrays of objects with dates', () => {
    const input = [
      { id: '1', createdAt: '2024-01-01T00:00:00.000Z' },
      { id: '2', createdAt: '2024-06-15T12:00:00.000Z' },
    ]
    const result = transformDates(input)
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[1].createdAt).toBeInstanceOf(Date)
    expect(result[0].id).toBe('1')
  })

  it('does not transform ISO dates without timezone Z suffix', () => {
    // Only full ISO 8601 with Z should be transformed
    expect(transformDates('2024-03-15T10:30:00')).toBe('2024-03-15T10:30:00')
  })

  it('handles empty objects and arrays', () => {
    expect(transformDates({})).toEqual({})
    expect(transformDates([])).toEqual([])
  })

  it('does not match ISO dates without milliseconds when regex requires them', () => {
    // The regex accepts optional milliseconds: (\.\d{3})?
    const withMs = transformDates('2024-03-15T10:30:00.000Z')
    expect(withMs).toBeInstanceOf(Date)
    const withoutMs = transformDates('2024-03-15T10:30:00Z')
    expect(withoutMs).toBeInstanceOf(Date)
  })
})
