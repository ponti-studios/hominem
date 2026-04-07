import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Set NODE_ENV to test for environment variable defaults
process.env.NODE_ENV = 'test'

// JSDOM doesn't implement window.matchMedia — polyfill for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// JSDOM doesn't implement HTMLDialogElement methods — polyfill for tests
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
  this.dispatchEvent(new Event('open'))
}
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
