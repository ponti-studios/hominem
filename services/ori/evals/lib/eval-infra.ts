export class EvaluationInfrastructureError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'EvaluationInfrastructureError';
    this.retryable = retryable;
  }
}

export function openRouterError(status: number, detail: string): EvaluationInfrastructureError {
  const retryable = status === 408 || status === 429 || (status >= 500 && status < 600);
  const summary = detail.trim().slice(0, 2000);
  return new EvaluationInfrastructureError(
    `OpenRouter request failed (${status})${summary ? `: ${summary}` : ''}`,
    retryable,
  );
}

type EvaluationRetryOptions = {
  attempts?: number;
  delayMs?: number;
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Runs one evaluation workflow, retrying only an explicitly retryable
 * infrastructure failure. Judge and assertion failures are returned unchanged
 * so another model call cannot mask a quality regression.
 */
export async function withEvaluationRetry(
  work: () => Promise<void>,
  options: EvaluationRetryOptions = {},
): Promise<void> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 2));
  const delayMs = options.delayMs ?? 1500;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await work();
      return;
    } catch (error) {
      const retryable =
        error instanceof EvaluationInfrastructureError && error.retryable && attempt < attempts;
      if (!retryable) throw error;
      await sleep(delayMs);
    }
  }
}
