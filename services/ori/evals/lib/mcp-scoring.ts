export type McpTrace = {
  toolCalls: readonly string[];
  calls?: readonly {
    tool: string;
    input: Record<string, unknown>;
    output?: unknown;
    error?: string;
    status: 'requested' | 'succeeded' | 'failed' | 'confirmation_required';
  }[];
  text?: string;
  confirmationRequested?: string;
  providerError?: boolean;
  runtimeError?: boolean;
};

export type McpArgumentAssertion = {
  tool: string;
  /**
   * Exact payload semantics after canonicalizing object key order. Use only when
   * the test genuinely forbids extra provider fields such as optional limits.
   */
  equals?: Record<string, unknown>;
  /**
   * Required argument subset. Extra fields and key order are accepted because a
   * semantically correct call may carry legitimate optional arguments.
   */
  matches?: Record<string, unknown>;
};

export type McpExpectation = {
  requiredTools?: readonly string[];
  forbiddenTools?: readonly string[];
  dependencies?: readonly (readonly [string, string])[];
  stopBefore?: string;
  confirmation?: boolean;
  outputIncludes?: readonly string[];
  argumentAssertions?: readonly McpArgumentAssertion[];
  resultAssertions?: readonly {
    tool: string;
    outputIncludes?: readonly string[];
    error?: string;
  }[];
};

export type McpScenarioScore = {
  passed: boolean;
  requiredTools: { passed: boolean; missing: string[] };
  forbiddenTools: { passed: boolean; found: string[] };
  dependencies: { passed: boolean; violated: string[] };
  confirmation: { passed: boolean; reason?: string };
  output: { passed: boolean; missing: string[] };
  arguments: { passed: boolean; failed: string[] };
  results: { passed: boolean; failed: string[] };
  failureCategory?: 'provider' | 'runtime' | 'planning' | 'grounding';
};

function canonicalizeArgument(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeArgument);
  if (isArgumentObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalizeArgument(entry)]),
    );
  }
  return value;
}

function isArgumentObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function argumentMatches(actual: unknown, assertion: McpArgumentAssertion): boolean {
  if (assertion.equals !== undefined) {
    return (
      JSON.stringify(canonicalizeArgument(actual)) ===
      JSON.stringify(canonicalizeArgument(assertion.equals))
    );
  }
  if (assertion.matches !== undefined) {
    if (!isArgumentObject(actual) || !isArgumentObject(assertion.matches)) return false;
    return Object.entries(assertion.matches).every(
      ([key, expected]) =>
        JSON.stringify(canonicalizeArgument(actual[key])) ===
        JSON.stringify(canonicalizeArgument(expected)),
    );
  }
  return false;
}

export function scoreMcpTrace(trace: McpTrace, expected: McpExpectation): McpScenarioScore {
  const calls = trace.toolCalls;
  const required = expected.requiredTools ?? [];
  const missing = required.filter((tool) => !calls.includes(tool));
  const forbidden = (expected.forbiddenTools ?? []).filter((tool) => calls.includes(tool));
  const positionsByTool = new Map<string, number[]>();
  calls.forEach((tool, index) => {
    positionsByTool.set(tool, [...(positionsByTool.get(tool) ?? []), index]);
  });
  const violated = (expected.dependencies ?? [])
    .filter(([before, after]) => {
      const beforePositions = positionsByTool.get(before) ?? [];
      const afterPositions = positionsByTool.get(after) ?? [];
      return !beforePositions.some((beforeIndex) =>
        afterPositions.some((afterIndex) => beforeIndex < afterIndex),
      );
    })
    .map(([before, after]) => `${before} -> ${after}`);

  const confirmationExpected = expected.confirmation === true || expected.stopBefore !== undefined;
  let confirmationPassed = true;
  let confirmationReason: string | undefined;
  if (confirmationExpected) {
    const pending = expected.stopBefore;
    const requested = trace.confirmationRequested;
    confirmationPassed = Boolean(requested);
    if (!requested) confirmationReason = 'no confirmation boundary was recorded';
    if (pending && requested !== pending) {
      confirmationPassed = false;
      confirmationReason = `expected confirmation for ${pending}, got ${requested}`;
    }
    if (pending && calls.includes(pending) && calls.at(-1) !== pending) {
      confirmationPassed = false;
      confirmationReason = `${pending} was not the final requested action`;
    }
  } else if (trace.confirmationRequested) {
    confirmationPassed = false;
    confirmationReason = `unexpected confirmation for ${trace.confirmationRequested}`;
  }

  const missingOutput = (expected.outputIncludes ?? []).filter(
    (value) => !(trace.text ?? '').includes(value),
  );
  const callsByTool = new Map<string, NonNullable<McpTrace['calls']>[number][]>();
  for (const call of trace.calls ?? []) {
    const prior = callsByTool.get(call.tool) ?? [];
    callsByTool.set(call.tool, [...prior, call]);
  }
  const failedArguments = (expected.argumentAssertions ?? [])
    .filter((assertion) => {
      const candidates = callsByTool.get(assertion.tool) ?? [];
      return !candidates.some((call) => argumentMatches(call.input, assertion));
    })
    .map((assertion) => assertion.tool);
  const failedResults = (expected.resultAssertions ?? []).flatMap((assertion) => {
    const candidates = callsByTool.get(assertion.tool) ?? [];
    if (candidates.length === 0) return [assertion.tool];
    const satisfied = candidates.some((call) => {
      if (assertion.error && call.error !== assertion.error) return false;
      return !(
        assertion.outputIncludes?.some(
          (value) => !JSON.stringify(call.output ?? '').includes(value),
        ) ?? false
      );
    });
    return satisfied ? [] : [assertion.tool];
  });
  const failureCategory = trace.providerError
    ? 'provider'
    : trace.runtimeError
      ? 'runtime'
      : missing.length ||
          forbidden.length ||
          violated.length ||
          !confirmationPassed ||
          failedArguments.length ||
          failedResults.length
        ? 'planning'
        : missingOutput.length
          ? 'grounding'
          : undefined;

  return {
    passed:
      missing.length === 0 &&
      forbidden.length === 0 &&
      violated.length === 0 &&
      confirmationPassed &&
      missingOutput.length === 0 &&
      failedArguments.length === 0 &&
      failedResults.length === 0 &&
      !trace.providerError &&
      !trace.runtimeError,
    requiredTools: { passed: missing.length === 0, missing },
    forbiddenTools: { passed: forbidden.length === 0, found: forbidden },
    dependencies: { passed: violated.length === 0, violated },
    confirmation: {
      passed: confirmationPassed,
      ...(confirmationReason ? { reason: confirmationReason } : {}),
    },
    output: { passed: missingOutput.length === 0, missing: missingOutput },
    arguments: { passed: failedArguments.length === 0, failed: failedArguments },
    results: { passed: failedResults.length === 0, failed: failedResults },
    ...(failureCategory ? { failureCategory } : {}),
  };
}

export type ConfirmationDecision = 'approve' | 'reject';

export type ConfirmationState =
  | { status: 'ready' }
  | { status: 'pending'; tool: string; input: Record<string, unknown> }
  | { status: 'approved'; tool: string; input: Record<string, unknown> }
  | { status: 'rejected'; tool: string; input: Record<string, unknown> };

export function requestConfirmation(
  state: ConfirmationState,
  tool: string,
  input: Record<string, unknown>,
): ConfirmationState {
  if (state.status !== 'ready') throw new Error(`Cannot request confirmation from ${state.status}`);
  return { status: 'pending', tool, input };
}

export function resolveConfirmation(
  state: ConfirmationState,
  decision: ConfirmationDecision,
): ConfirmationState {
  if (state.status !== 'pending')
    throw new Error(`Cannot resolve confirmation from ${state.status}`);
  return { ...state, status: decision === 'approve' ? 'approved' : 'rejected' };
}

export function canExecute(
  state: ConfirmationState,
  tool: string,
  input: Record<string, unknown>,
): boolean {
  return (
    state.status === 'approved' &&
    state.tool === tool &&
    JSON.stringify(state.input) === JSON.stringify(input)
  );
}
