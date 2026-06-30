export const OTP_LENGTH = 6;

export function normalizeOtp(value: string) {
  return value.replace(/\D/g, "");
}
