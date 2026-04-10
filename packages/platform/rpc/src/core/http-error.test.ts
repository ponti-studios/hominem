import { describe, expect, it } from 'vitest'
import { HonoHttpError } from './http-error'

describe('HonoHttpError', () => {
  it('creates error with correct properties', () => {
    const error = new HonoHttpError('Not Found', 404, '{"error":"not found"}')
    expect(error.message).toBe('Not Found')
    expect(error.status).toBe(404)
    expect(error.responseText).toBe('{"error":"not found"}')
    expect(error.name).toBe('HonoHttpError')
  })

  it('is an instance of Error', () => {
    const error = new HonoHttpError('Server Error', 500, 'internal')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(HonoHttpError)
  })

  it('preserves prototype chain', () => {
    const error = new HonoHttpError('Unauthorized', 401, '')
    expect(Object.getPrototypeOf(error)).toBe(HonoHttpError.prototype)
  })

  it('has a stack trace', () => {
    const error = new HonoHttpError('Bad Request', 400, '')
    expect(error.stack).toBeDefined()
  })
})
