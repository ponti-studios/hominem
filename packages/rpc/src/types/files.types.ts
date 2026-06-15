import type { InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type UploadRoute = HonoClient['api']['files']['$post'];

export type UploadResponse = InferResponseType<UploadRoute, 200>;
export type UploadedFileDto = UploadResponse['file'];
