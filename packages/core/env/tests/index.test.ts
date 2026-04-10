import * as z from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EnvValidationError,
  createClientEnv,
  createServerEnv,
} from '../src/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stringSchema = z.object({
  STRING_VAR: z.string(),
  OPTIONAL_VAR: z.string().optional(),
})

// ---------------------------------------------------------------------------
// EnvValidationError
// ---------------------------------------------------------------------------

describe('EnvValidationError', () => {
  it('has correct name', () => {
    const error = new EnvValidationError('msg', 'ctx', [])
    expect(error.name).toBe('EnvValidationError')
  })

  it('exposes context and issues', () => {
    const issues = [{ path: 'FOO', message: 'required' }]
    const error = new EnvValidationError('fail', 'myContext', issues)
    expect(error.context).toBe('myContext')
    expect(error.issues).toEqual(issues)
  })

  it('is instanceof Error', () => {
    expect(new EnvValidationError('msg', 'ctx', [])).toBeInstanceOf(Error)
  })
})

// ---------------------------------------------------------------------------
// createServerEnv
// ---------------------------------------------------------------------------

describe('createServerEnv', () => {
  const originalProcess = globalThis.process

  afterEach(() => {
    globalThis.process = originalProcess
  })

  it('parses valid env and returns typed object', () => {
    globalThis.process = { env: { STRING_VAR: 'hello' } } as unknown as typeof globalThis.process
    const env = createServerEnv(stringSchema, 'test')
    expect(env.STRING_VAR).toBe('hello')
    expect(env.OPTIONAL_VAR).toBeUndefined()
  })

  it('throws EnvValidationError (not ZodError) on invalid schema', () => {
    globalThis.process = { env: {} } as unknown as typeof globalThis.process
    const env = createServerEnv(stringSchema, 'test')
    expect(() => env.STRING_VAR).toThrow(EnvValidationError)
  })

  it('includes issues array in EnvValidationError on parse failure', () => {
    globalThis.process = { env: {} } as unknown as typeof globalThis.process
    const env = createServerEnv(stringSchema, 'test')
    try {
      env.STRING_VAR
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError)
      const error = err as EnvValidationError
      expect(error.context).toBe('test')
      expect(error.issues).toContainEqual(expect.objectContaining({ path: 'STRING_VAR' }))
    }
  })

  it('throws when process.env is undefined (non-Node context)', () => {
    globalThis.process = undefined as unknown as typeof globalThis.process
    const env = createServerEnv(stringSchema, 'test')
    expect(() => env.STRING_VAR).toThrow(EnvValidationError)
  })

  it('Proxy supports "in" operator (has)', () => {
    globalThis.process = { env: { STRING_VAR: 'yes' } } as unknown as typeof globalThis.process
    const env = createServerEnv(stringSchema, 'test') as Record<PropertyKey, unknown>
    expect('STRING_VAR' in env).toBe(true)
    expect('NONEXISTENT' in env).toBe(false)
  })

  it('Proxy.ownKeys returns all env keys', () => {
    globalThis.process = { env: { STRING_VAR: 'a', EXTRA: 'b' } } as unknown as typeof globalThis.process
    const env = createServerEnv(stringSchema, 'test') as Record<PropertyKey, unknown>
    expect(Object.keys(env)).toContain('STRING_VAR')
  })
})

// ---------------------------------------------------------------------------
// createClientEnv
// ---------------------------------------------------------------------------

describe('createClientEnv', () => {
  it('throws when called in non-browser context (window undefined) — Node env has no window', () => {
    const env = createClientEnv(stringSchema, 'client-test')
    expect(() => env.STRING_VAR).toThrow(EnvValidationError)
  })
})
