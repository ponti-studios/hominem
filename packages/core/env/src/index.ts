import * as z from 'zod';

export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly context: string,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

function parseEnv<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  source: Record<string, string | undefined>,
  ctx: string,
): z.infer<T> {
  try {
    return schema.parse(source);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw new EnvValidationError(
        `[${ctx}] validation failed:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
        ctx,
        issues,
      );
    }
    throw new EnvValidationError(
      `[${ctx}] ${err instanceof Error ? err.message : String(err)}`,
      ctx,
    );
  }
}

export function createClientEnv<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  context = 'clientEnv',
): z.infer<T> {
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    throw new EnvValidationError(
      'createClientEnv can only be used in browser context. Use createServerEnv for server-side code.',
      context,
    );
  }
  return parseEnv(
    schema,
    (import.meta as { env?: Record<string, string | undefined> }).env ?? {},
    context,
  );
}

export function createServerEnv<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  context = 'serverEnv',
): z.infer<T> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (typeof proc === 'undefined') {
    throw new EnvValidationError(
      'createServerEnv can only be used in Node.js context. Use createClientEnv for browser code.',
      context,
    );
  }
  return parseEnv(schema, proc.env ?? {}, context);
}

export { BRAND } from './brand';
export type { Brand } from './brand';
