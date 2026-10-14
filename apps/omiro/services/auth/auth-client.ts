import { API_BASE_URL } from '~/constants';
import HominemAuth from '~/modules/hominem-auth-bridge';

export const authClient = {
  getSession: () => HominemAuth.getSession(API_BASE_URL),
  requestEmailOtp: (email: string) => HominemAuth.requestOTP(API_BASE_URL, email),
  verifyEmailOtp: (input: { email: string; otp: string }) =>
    HominemAuth.verifyOTP(API_BASE_URL, input.email, input.otp),
  signOut: () => HominemAuth.signOut(API_BASE_URL),
  updateUser: (updates: { name?: string; image?: string | null }) =>
    HominemAuth.updateUser(API_BASE_URL, updates.name ?? null, updates.image ?? null),
  getCookie: () => HominemAuth.getCookie(API_BASE_URL),
};
