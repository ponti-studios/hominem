// Test OTP store for e2e tests

type TestOtpRecord = {
  email: string;
  otp: string;
  type: string;
  createdAt: Date;
  expiresAt: Date;
};

const otpStore = new Map<string, TestOtpRecord>();
let storeEnabled = false;

export function isTestOtpStoreEnabled(): boolean {
  return storeEnabled;
}

export function enableTestOtpStore(): void {
  storeEnabled = true;
}

export function disableTestOtpStore(): void {
  storeEnabled = false;
}

export function getLatestTestOtp(input: { email: string; type?: string }): TestOtpRecord | null {
  if (!storeEnabled) return null;

  const key = input.type ? `${input.email}:${input.type}` : input.email;
  return otpStore.get(key) ?? null;
}

export function recordTestOtp(
  emailOrInput: string | { email: string; otp: string; type?: string },
  otp?: string,
  type?: string,
): void {
  const now = new Date();
  let email: string;
  let otpValue: string;
  let typeValue = 'sign-in';

  if (typeof emailOrInput === 'string') {
    email = emailOrInput;
    otpValue = otp ?? '';
    typeValue = type ?? 'sign-in';
  } else {
    email = emailOrInput.email;
    otpValue = emailOrInput.otp;
    typeValue = emailOrInput.type ?? 'sign-in';
  }

  const key = `${email}:${typeValue}`;
  otpStore.set(key, {
    email,
    otp: otpValue,
    type: typeValue,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });
}

export function clearTestOtpStore(): void {
  otpStore.clear();
}
