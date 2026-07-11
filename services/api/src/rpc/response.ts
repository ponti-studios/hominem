import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

export function dataEnvelopeSchema<const T extends z.ZodType>(dataSchema: T) {
  return dataSchema.transform((data) => ({ data }));
}

export function parseDataEnvelope<const T extends z.ZodType>(
  dataSchema: T,
  data: unknown,
): z.infer<ReturnType<typeof dataEnvelopeSchema<T>>> {
  return dataEnvelopeSchema(dataSchema).parse(data);
}

export function respondWithData<const T extends z.ZodType>(
  c: Context,
  dataSchema: T,
  data: unknown,
  status: ContentfulStatusCode = 200,
) {
  return c.json(parseDataEnvelope(dataSchema, data), status);
}
