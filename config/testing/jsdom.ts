import { vi } from 'vitest';

export function installBaseJsdomTestSetup() {
  process.env.NODE_ENV = 'test';

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

export function installDialogJsdomPolyfills() {
  if (typeof HTMLDialogElement === 'undefined') {
    return;
  }

  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
    this.dispatchEvent(new Event('open'));
  };

  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

export function installRadixJsdomPolyfills() {
  if (typeof window === 'undefined' || typeof window.Element === 'undefined') {
    return;
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }

  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }

  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
