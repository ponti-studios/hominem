import type { AssertionValueFunctionContext } from 'promptfoo';

import type { Golden } from '../lib/golden';
import { assertTimeBlockFields } from '../lib/time-block-compare';

/** Every structured field except `title` (the judge grades that one). */
export default function timeBlock(output: string | object, context: AssertionValueFunctionContext) {
  try {
    assertTimeBlockFields(
      typeof output === 'string' ? output : JSON.stringify(output),
      context.vars.golden as Golden,
    );
    return { pass: true, score: 1, reason: 'structured fields match' };
  } catch (error) {
    return {
      pass: false,
      score: 0,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
