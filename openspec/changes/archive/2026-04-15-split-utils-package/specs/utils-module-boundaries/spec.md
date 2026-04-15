# Utils Module Boundaries

Defines where each former `@hominem/utils` submodule now lives after the split.

## Ownership Map

| Former Path | New Path | Status |
|---|---|---|
| `@hominem/utils/api-response-validation` | `@hominem/rpc/schemas/voice.schema.ts` + `files.schema.ts` | ✅ Moved |
| `@hominem/utils/consts` | `@hominem/queues/src/consts.ts` | ✅ Moved |
| `@hominem/utils/headers` | `@hominem/auth/src/server/headers.ts` | ✅ Moved |
| `@hominem/utils/error-types` | `@hominem/auth/src/server/error-types.ts` | ✅ Moved |
| `@hominem/utils/google` | `services/api/src/routes/images.ts` (inlined) | ✅ Moved |
| `@hominem/utils/images` | N/A | ⚠️ Dead code left in utils |
| `@hominem/utils/storage` | `@hominem/utils/storage` (kept) | 🔵 Kept |
| `@hominem/utils/upload` | `@hominem/chat/src/upload/` | ✅ Moved |
| `@hominem/utils/dates` (partial) | `@hominem/chat/src/dates.ts` | ✅ Moved |
| `@hominem/utils/time` (partial) | N/A (TIME_UNITS stays in utils) | 🔵 Kept |
| `@hominem/utils/markdown` | `@hominem/chat/src/markdown/` | ✅ Moved |

## Retained in `@hominem/utils`

| Path | Rationale |
|---|---|
| `@hominem/utils/logger` | Cross-cutting server logging |
| `@hominem/utils/client-logger` | Browser console logging |
| `@hominem/utils/logger.shared` | Shared log formatting types |
| `@hominem/utils/delay` | Generic async delay utility |
| `@hominem/utils/http` | Generic HTTP helpers |
| `@hominem/utils/time` (partial) | `TIME_UNITS`, `formatTime`, `getTimeAgo`, `getDatesFromText` — generic time utilities |
| `@hominem/utils/dates` (partial) | `getTimezone`, `getLocalDate`, `adjustDateRange`, etc. — generic date utilities |
| `@hominem/utils/storage` | R2 storage services — kept in utils due to cross-workspace complexity |
| `@hominem/utils/images` | Dead code — `getHominemPhotoURL`, etc. not imported anywhere |

## Import Migration (Actual)

```typescript
// Before
import { UploadResponseSchema } from '@hominem/utils/api-response-validation';
import { QUEUE_NAMES } from '@hominem/utils/consts';
import { getSetCookieHeaders } from '@hominem/utils/headers';
import { CHAT_UPLOAD_MAX_FILE_COUNT } from '@hominem/utils/upload';
import { parseInboxTimestamp } from '@hominem/utils/dates';

// After
import { UploadResponseSchema } from '@hominem/rpc/schemas/files.schema';
import { VoiceTranscribeSuccessSchema } from '@hominem/rpc/schemas/voice.schema';
import { QUEUE_NAMES } from '@hominem/queues';
import { getSetCookieHeaders } from '@hominem/auth/server-utils';
import { CHAT_UPLOAD_MAX_FILE_COUNT } from '@hominem/chat';
import { parseInboxTimestamp } from '@hominem/chat';
```

## Still in `@hominem/utils` (Valid)

```typescript
// These remain in @hominem/utils — they belong there:
import { delay } from '@hominem/utils';
import { TIME_UNITS, formatTime, getTimeAgo } from '@hominem/utils/time';
import { getTimezone } from '@hominem/utils/dates';
import { logger } from '@hominem/utils/logger';
import { fileStorageService } from '@hominem/utils/storage';
```
