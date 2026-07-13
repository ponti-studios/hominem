import { logger } from '@hominem/telemetry';

/**
 * Standard evidence wrapper for MCP tool results.
 * Every tool response goes through this to ensure consistent shape,
 * result capping, and redaction.
 */

export interface EvidenceEnvelope<T> {
  evidence: T[];
  isTruncated: boolean;
}

/**
 * Wrap domain results in a consistent evidence envelope.
 * Applies result cap enforcement and logs when truncation occurs.
 */
export function buildEvidence<T>(
  results: T[],
  toolName: string,
  resultCap: number,
): EvidenceEnvelope<T> {
  if (results.length <= resultCap) {
    return { evidence: results, isTruncated: false };
  }

  logger.warn('[mcp] result cap exceeded', {
    tool: toolName,
    total: results.length,
    cap: resultCap,
    dropped: results.length - resultCap,
  });

  return {
    evidence: results.slice(0, resultCap),
    isTruncated: true,
  };
}

/**
 * Return a clean no-data envelope when a service finds no matching records.
 * Per FR-006: report no-data rather than implying completeness.
 */
export function noData(): EvidenceEnvelope<never> {
  return { evidence: [], isTruncated: false };
}

/**
 * Log redaction activity — when sensitive fields are excluded from responses.
 */
export function logRedaction(toolName: string, redactedFields: string[], recordCount: number) {
  if (redactedFields.length === 0) return;

  logger.info('[mcp] evidence redaction applied', {
    tool: toolName,
    redactedFields,
    recordCount,
  });
}
