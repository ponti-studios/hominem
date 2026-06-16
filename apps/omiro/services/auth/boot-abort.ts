export const AUTH_BOOT_TIMEOUT_MS = 8000;

export function createAuthBootAbortController(inputSignal?: AbortSignal): {
  cleanup: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(inputSignal?.reason);
  const timeoutId = setTimeout(() => controller.abort(), AUTH_BOOT_TIMEOUT_MS);

  if (inputSignal?.aborted) {
    forwardAbort();
  } else {
    inputSignal?.addEventListener('abort', forwardAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      inputSignal?.removeEventListener('abort', forwardAbort);
    },
  };
}
