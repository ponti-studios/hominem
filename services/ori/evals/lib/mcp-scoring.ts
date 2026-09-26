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

export type McpExpectation = {
  requiredTools?: readonly string[];
  forbiddenTools?: readonly string[];
  dependencies?: readonly (readonly [string, string])[];
  stopBefore?: string;
  confirmation?: boolean;
  outputIncludes?: readonly string[];
  argumentAssertions?: readonly { tool: string; equals: Record<string, unknown> }[];
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

const positions = (calls: readonly string[]): Map<string, number> =>
  new Map(calls.map((call, index) => [call, index]));

export function scoreMcpTrace(trace: McpTrace, expected: McpExpectation): McpScenarioScore {
  const calls = trace.toolCalls;
  const required = expected.requiredTools ?? [];
  const missing = required.filter((tool) => !calls.includes(tool));
  const forbidden = (expected.forbiddenTools ?? []).filter((tool) => calls.includes(tool));
  const indexByTool = positions(calls);
  const violated = (expected.dependencies ?? [])
    .filter(([before, after]) => {
      const beforeIndex = indexByTool.get(before);
      const afterIndex = indexByTool.get(after);
      return beforeIndex === undefined || afterIndex === undefined || beforeIndex >= afterIndex;
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
  const callsByTool = new Map((trace.calls ?? []).map((call) => [call.tool, call]));
  const failedArguments = (expected.argumentAssertions ?? [])
    .filter(
      (assertion) =>
        JSON.stringify(callsByTool.get(assertion.tool)?.input) !== JSON.stringify(assertion.equals),
    )
    .map((assertion) => assertion.tool);
  const failedResults = (expected.resultAssertions ?? []).flatMap((assertion) => {
    const call = callsByTool.get(assertion.tool);
    if (!call) return [assertion.tool];
    if (assertion.error && call.error !== assertion.error) return [assertion.tool];
    if (
      assertion.outputIncludes?.some((value) => !JSON.stringify(call.output ?? '').includes(value))
    )
      return [assertion.tool];
    return [];
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
