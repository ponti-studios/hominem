// Step-up action constants and type guards

export const STEP_UP_ACTIONS = {
  PASSKEY_REGISTER: 'passkey_register',
  PASSKEY_DELETE: 'passkey_delete',
  ACCOUNT_DELETE: 'account_delete',
} as const;

export type StepUpAction = (typeof STEP_UP_ACTIONS)[keyof typeof STEP_UP_ACTIONS];

const STEP_UP_VALUES = new Set<string>(Object.values(STEP_UP_ACTIONS));

export function isStepUpAction(value: unknown): value is StepUpAction {
  return typeof value === 'string' && STEP_UP_VALUES.has(value);
}
