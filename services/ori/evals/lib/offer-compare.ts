type OfferRecord = Record<string, unknown>;

function isOfferRecord(value: unknown): value is OfferRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIdentifier(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s._-]+/g, '')
    .replace(/[_\s.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeAbsent(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

/**
 * Canonicalizes values that the offer rubric already declares equivalent when a
 * source does not establish the fact: absent employment information and a benign
 * `employee` default both become unknown, and absent booleans and `false` both
 * become unknown. Explicit contractor or true values are preserved.
 */
function normalizeUnknown(value: unknown): unknown {
  const normalized = normalizeAbsent(value);
  if (normalized === null) return null;
  if (typeof normalized === 'string' && normalized.toLowerCase() === 'employee') return null;
  if (normalized === false) return null;
  return normalized;
}

function normalizeOffer(value: unknown): unknown {
  if (!isOfferRecord(value)) return value;
  return {
    ...value,
    currency:
      typeof value.currency === 'string' ? value.currency.trim().toUpperCase() : value.currency,
    location: normalizeIdentifier(value.location),
    employmentType: normalizeUnknown(value.employmentType),
    equityType: normalizeIdentifier(value.equityType),
    bonusFrequency: normalizeIdentifier(value.bonusFrequency),
    visaType: normalizeIdentifier(value.visaType),
    hasEquity: normalizeUnknown(value.hasEquity),
    hasBonus: normalizeUnknown(value.hasBonus),
    hasRelocation: normalizeUnknown(value.hasRelocation),
    requiresVisa: normalizeUnknown(value.requiresVisa),
    employerCoversVisa: normalizeUnknown(value.employerCoversVisa),
  };
}

function normalizePerson(value: unknown): unknown {
  if (!isOfferRecord(value)) return value;
  return {
    ...value,
    homeCity: normalizeIdentifier(value.homeCity),
    filingStatus: normalizeIdentifier(value.filingStatus),
  };
}

/**
 * Normalizes benchmark grading inputs without changing the model's emitted
 * output. It removes only representation differences already declared
 * equivalent: unknown/benign labels, empty strings, case, accents, and slug
 * punctuation. Numerical or explicit facts remain exact.
 */
export function normalizeOfferForGrading(input: string, source: 'candidate' | 'reference'): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error(`${source} offer output is not valid JSON`);
  }
  if (!isOfferRecord(parsed) || !Array.isArray(parsed.offers) || !isOfferRecord(parsed.person)) {
    throw new Error(`${source} offer output must contain an offers array and a person object`);
  }
  const normalized = {
    ...parsed,
    offers: parsed.offers.map((offer) => normalizeOffer(offer)),
    person: normalizePerson(parsed.person),
  };
  return JSON.stringify(normalized, null, 2);
}
