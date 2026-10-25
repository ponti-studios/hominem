/**
 * Dedupe keys for job postings pushed in by agents. Same posting, different tracking junk in the
 * URL, should land on the same key. When in doubt we keep a query param: a duplicate is visible
 * and fixable, a wrongly merged job just disappears.
 */

const TRACKING_PARAM =
  /^(utm_.*|mc_.*|ref|ref_?id|referrer|referral|src|source|gh_src|lever-source|lever-origin|fbclid|gclid|msclkid|igshid|trk|trk_?info|tracking.*|campaign|medium|channel|via|from|origin|share.*|_hs.*|cid|sid|session.*)$/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids look like long digits, UUIDs, or a token with a digit in it; "linkedin" or "email" do not. */
function looksLikeId(value: string): boolean {
  if (UUID.test(value)) return true;
  if (/^\d{4,}$/.test(value)) return true;
  return value.length >= 6 && /^[\w-]+$/.test(value) && /\d/.test(value);
}

export function jobPostingUrlKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!url.hostname) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  const kept: string[] = [];
  for (const [key, value] of url.searchParams) {
    if (TRACKING_PARAM.test(key) || !looksLikeId(value)) continue;
    kept.push(`${key.toLowerCase()}=${value}`);
  }
  kept.sort();
  return `${host}${path}${kept.length > 0 ? `?${kept.join('&')}` : ''}`;
}

/** The board's own id for the posting (Ashby/Greenhouse JSON-LD `identifier`, Lever UUID, ...). */
export function jobExternalKey(
  source: string | null | undefined,
  externalId: string | null | undefined,
): string | null {
  const board = source?.trim().toLowerCase();
  const id = externalId?.trim();
  return board && id ? `${board}:${id}` : null;
}
