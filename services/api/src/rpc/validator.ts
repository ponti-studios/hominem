import { zValidator as baseValidator } from '@hono/zod-validator';
import type { Env, ValidationTargets } from 'hono';
import type * as v4 from 'zod/v4/core';

/**
 * `@hono/zod-validator` 0.9 types the default 400 failure body into every RPC
 * client response, which makes each route's success type a union with
 * `ZodSafeParseError`. Passing a hook that returns nothing keeps the runtime
 * behavior (the library still answers 400 on a failed parse) but drops that
 * type from the response, so clients only see the success shape.
 */
const passThrough = () => {};

export function zValidator<
  T extends v4.$ZodType,
  Target extends keyof ValidationTargets,
  E extends Env = Env,
  P extends string = string,
>(target: Target, schema: T) {
  return baseValidator<T, Target, E, P, typeof passThrough>(target, schema, passThrough);
}
