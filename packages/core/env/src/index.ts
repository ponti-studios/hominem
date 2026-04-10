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
  const envSource = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  let cachedEnv: z.infer<T> | null = null;
  let cachedError: Error | null = null;

  return new Proxy({} as z.infer<T>, {
    get: (target, prop: string | symbol) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
          cachedError = new EnvValidationError(
            'createClientEnv can only be used in browser context. Use createServerEnv for server-side code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, envSource, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      return cachedEnv[prop as keyof typeof cachedEnv];
    },
    has: (target, prop: string | symbol) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
          cachedError = new EnvValidationError(
            'createClientEnv can only be used in browser context. Use createServerEnv for server-side code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, envSource, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      return prop in cachedEnv;
    },
    ownKeys: (target) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
          cachedError = new EnvValidationError(
            'createClientEnv can only be used in browser context. Use createServerEnv for server-side code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, envSource, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      return Object.keys(cachedEnv);
    },
    getOwnPropertyDescriptor: (target, prop: string | symbol) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
          cachedError = new EnvValidationError(
            'createClientEnv can only be used in browser context. Use createServerEnv for server-side code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, envSource, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      if (prop in cachedEnv) {
        return {
          configurable: true,
          enumerable: true,
          value: cachedEnv[prop as keyof typeof cachedEnv],
        };
      }
      return undefined;
    },
  });
}

export function createServerEnv<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  context = 'serverEnv',
): z.infer<T> {
  let cachedEnv: z.infer<T> | null = null;
  let cachedError: Error | null = null;

  return new Proxy({} as z.infer<T>, {
    get: (target, prop: string | symbol) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
        if (typeof proc === 'undefined') {
          cachedError = new EnvValidationError(
            'createServerEnv can only be used in Node.js context. Use createClientEnv for browser code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, proc.env ?? {}, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      return cachedEnv[prop as keyof typeof cachedEnv];
    },
    has: (target, prop: string | symbol) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
        if (typeof proc === 'undefined') {
          cachedError = new EnvValidationError(
            'createServerEnv can only be used in Node.js context. Use createClientEnv for browser code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, proc.env ?? {}, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      return prop in cachedEnv;
    },
    ownKeys: (target) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
        if (typeof proc === 'undefined') {
          cachedError = new EnvValidationError(
            'createServerEnv can only be used in Node.js context. Use createClientEnv for browser code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, proc.env ?? {}, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      return Object.keys(cachedEnv);
    },
    getOwnPropertyDescriptor: (target, prop: string | symbol) => {
      if (cachedError) throw cachedError;

      if (!cachedEnv) {
        const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
        if (typeof proc === 'undefined') {
          cachedError = new EnvValidationError(
            'createServerEnv can only be used in Node.js context. Use createClientEnv for browser code.',
            context,
          );
          throw cachedError;
        }
        try {
          cachedEnv = parseEnv(schema, proc.env ?? {}, context);
        } catch (err) {
          cachedError = err as Error;
          throw cachedError;
        }
      }

      if (prop in cachedEnv) {
        return {
          configurable: true,
          enumerable: true,
          value: cachedEnv[prop as keyof typeof cachedEnv],
        };
      }
      return undefined;
    },
  });
}

export { BRAND } from './brand';
export type { Brand } from './brand';
