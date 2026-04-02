import { BRAND } from '@hominem/env/brand';

/** Single source of truth for the API service brand strings. */
export const API_BRAND = {
  appName: BRAND.appName,
  api: {
    title: `${BRAND.appName} API`,
    description: `API for the ${BRAND.appName} notes, chat, files, and voice product`,
    contactName: `${BRAND.appName} Support`,
    docsTitle: `${BRAND.appName} API Documentation`,
  },
} as const;
