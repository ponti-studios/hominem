import { requireNativeModule } from 'expo';

export type HominemAuthUser = {
  id: string;
  email: string;
  emailVerified?: boolean | null;
  name?: string | null;
  image: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HominemAuthModuleType = {
  getSession(baseURL: string): Promise<HominemAuthUser | null>;
  requestOTP(baseURL: string, email: string): Promise<void>;
  verifyOTP(baseURL: string, email: string, otp: string): Promise<HominemAuthUser>;
  signOut(baseURL: string): Promise<void>;
  updateUser(baseURL: string, name: string | null, image: string | null): Promise<HominemAuthUser>;
  getCookie(baseURL: string): Promise<string | null>;
};

export default requireNativeModule<HominemAuthModuleType>('HominemAuth');
