
import { isValidEmail, isValidOtp, normalizeEmail, normalizeOtp } from '../utils/auth/validation'

describe('auth validation', () => {
  describe('normalizeEmail', () => {
    it('should convert to lowercase', () => {
      expect(normalizeEmail('  USER@Example.COM ')).toBe('user@example.com')
    })

    it('should trim whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com')
    })
  })

  describe('normalizeOtp', () => {
    it('should trim whitespace', () => {
      expect(normalizeOtp(' 123456 ')).toBe('123456')
    })

    it('should remove spaces and dashes', () => {
      expect(normalizeOtp('12 34-56')).toBe('123456')
    })

    it('should truncate to 6 digits', () => {
      expect(normalizeOtp('1234567')).toBe('123456')
    })
  })

  describe('isValidEmail', () => {
    it('should accept valid email formats', () => {
      expect(isValidEmail('person@example.com')).toBe(true)
      expect(isValidEmail('person+test@example.co')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
      expect(isValidEmail('foo@bar')).toBe(false)
    })
  })

  describe('isValidOtp', () => {
    it('should accept valid six-digit codes', () => {
      expect(isValidOtp('123456')).toBe(true)
    })

    it('should accept formatted input (spaces and dashes)', () => {
      expect(isValidOtp('12 34-56')).toBe(true)
    })

    it('should reject invalid length codes', () => {
      expect(isValidOtp('12345')).toBe(false)
    })

    it('should reject non-digit input', () => {
      expect(isValidOtp('abcdef')).toBe(false)
    })

    it('should accept over-length input that normalizes to valid', () => {
      expect(isValidOtp('1234567')).toBe(true)
    })
  })
})
