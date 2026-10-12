import type { SheetTransactionInput } from './sheet-import';

export interface SheetCsvInvalidRow {
  line: number;
  reason: string;
}

export interface SheetCsvParseResult {
  rows: SheetTransactionInput[];
  invalid: SheetCsvInvalidRow[];
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function isTruthyFlag(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

interface SheetCsvRecord {
  text: string;
  line: number;
}

// Split the document into records with quote state tracked across line
// breaks, so a quoted Notes cell containing \n stays one record. The line is
// the record's start line, keeping invalid-row reports accurate.
function splitRecords(csv: string): SheetCsvRecord[] {
  const normalized = csv.replace(/\r\n?/g, '\n');
  const records: SheetCsvRecord[] = [];
  let current = '';
  let inQuotes = false;
  let line = 1;
  let startLine = 1;
  const push = () => {
    records.push({ text: current, line: startLine });
    current = '';
  };
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          current += '""';
          i += 2;
          continue;
        }
        inQuotes = false;
      }
      current += char;
      if (char === '\n') line += 1;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      current += char;
      i += 1;
      continue;
    }
    if (char === '\n') {
      push();
      line += 1;
      startLine = line;
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  push();
  return records;
}

function parseAccountingAmountCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed);
  const digits = trimmed.replace(/[(),]/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(digits)) return null;
  const cents = Math.round(Number.parseFloat(digits) * 100);
  if (!Number.isFinite(cents)) return null;
  if (negative) return cents > 0 ? -cents : cents;
  return /^-\s*/.test(trimmed) ? -Math.abs(cents) : cents;
}

function isHeaderRow(fields: string[]): boolean {
  const first = (fields[0] ?? '').toLowerCase();
  return first === 'date' || !/^\d{4}-\d{2}-\d{2}$/.test(fields[0] ?? '');
}

export function parseSheetTransactionsCsv(csv: string): SheetCsvParseResult {
  const rows: SheetTransactionInput[] = [];
  const invalid: SheetCsvInvalidRow[] = [];
  const records = splitRecords(csv);
  let seenFirstRecord = false;
  for (const record of records) {
    const lineNumber = record.line;
    if (!record.text.trim()) continue;
    const fields = splitCsvLine(record.text);
    if (!seenFirstRecord) {
      seenFirstRecord = true;
      if (isHeaderRow(fields)) continue;
    }
    const [
      postedOn = '',
      account = '',
      description = '',
      amountRaw = '',
      currencyCode = '',
      tagsRaw = '',
      source = '',
      orderNumber = '',
      category = '',
      excludedRaw = '',
      recurringRaw = '',
      notes = '',
    ] = fields;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn)) {
      invalid.push({ line: lineNumber, reason: 'invalid_posted_on' });
      continue;
    }
    const amountCents = parseAccountingAmountCents(amountRaw);
    if (amountCents === null) {
      invalid.push({ line: lineNumber, reason: 'invalid_amount' });
      continue;
    }
    rows.push({
      postedOn,
      account,
      description,
      amountCents,
      currencyCode: currencyCode.toUpperCase(),
      category: category || null,
      tags: tagsRaw
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      notes: notes || null,
      orderNumber: orderNumber || null,
      source: source || null,
      excluded: isTruthyFlag(excludedRaw),
      recurring: isTruthyFlag(recurringRaw),
    });
  }
  return { rows, invalid };
}
