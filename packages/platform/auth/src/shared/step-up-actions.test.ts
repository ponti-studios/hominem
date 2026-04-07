import { describe, expect, it } from 'vitest'
import { STEP_UP_ACTIONS, isStepUpAction } from './step-up-actions'

describe('isStepUpAction', () => {
  it('returns true for all defined step-up actions', () => {
    expect(isStepUpAction('passkey.register')).toBe(true)
    expect(isStepUpAction('passkey.delete')).toBe(true)
    expect(isStepUpAction('finance.account.delete')).toBe(true)
  })

  it('returns false for unknown actions', () => {
    expect(isStepUpAction('unknown.action')).toBe(false)
    expect(isStepUpAction('')).toBe(false)
    expect(isStepUpAction('passkey')).toBe(false)
  })
})

describe('STEP_UP_ACTIONS', () => {
  it('contains expected action constants', () => {
    expect(STEP_UP_ACTIONS.PASSKEY_REGISTER).toBe('passkey.register')
    expect(STEP_UP_ACTIONS.PASSKEY_DELETE).toBe('passkey.delete')
    expect(STEP_UP_ACTIONS.FINANCE_ACCOUNT_DELETE).toBe('finance.account.delete')
  })
})
