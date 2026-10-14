// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockRequestEmailOtp = vi.fn();
const mockVerifyEmailOtp = vi.fn();
const mockUpdateUser = vi.fn();
const mockCaptureEvent = vi.fn();
const mockCaptureFailure = vi.fn();

vi.mock('~/services/auth/auth-client', () => ({
  authClient: {
    requestEmailOtp: mockRequestEmailOtp,
    verifyEmailOtp: mockVerifyEmailOtp,
    updateUser: mockUpdateUser,
  },
}));

vi.mock('~/services/auth/analytics', () => ({
  captureAuthAnalyticsEvent: mockCaptureEvent,
  captureAuthAnalyticsFailure: mockCaptureFailure,
}));

const { useEmailOtp } = await import('~/services/auth/hooks/use-email-otp');

describe('useEmailOtp', () => {
  describe('requestEmailOtp', () => {
    it('sends a sign-in OTP request and records success', async () => {
      mockRequestEmailOtp.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useEmailOtp());

      await act(async () => {
        await result.current.requestEmailOtp('user@example.com');
      });

      expect(mockRequestEmailOtp).toHaveBeenCalledWith('user@example.com');
      expect(mockCaptureEvent).toHaveBeenCalledWith(
        'auth_email_otp_request_succeeded',
        expect.objectContaining({ email: 'user@example.com' }),
      );
    });

    it('throws and records failure when HominemAuth rejects the request', async () => {
      mockRequestEmailOtp.mockRejectedValueOnce(new Error('Rate limited'));
      const { result } = renderHook(() => useEmailOtp());

      await act(async () => {
        await expect(result.current.requestEmailOtp('user@example.com')).rejects.toThrow(
          'Rate limited',
        );
      });

      expect(mockCaptureFailure).toHaveBeenCalledWith(
        'auth_email_otp_request_failed',
        expect.objectContaining({ email: 'user@example.com' }),
      );
    });

    it('records failures without inventing a response status', async () => {
      mockRequestEmailOtp.mockRejectedValueOnce(new Error('network down'));
      const { result } = renderHook(() => useEmailOtp());

      await act(async () => {
        await expect(result.current.requestEmailOtp('user@example.com')).rejects.toThrow(
          'network down',
        );
      });

      expect(mockCaptureFailure).toHaveBeenCalledWith(
        'auth_email_otp_request_failed',
        expect.objectContaining({ phase: 'email_otp_request', email: 'user@example.com' }),
      );
    });
  });

  describe('verifyEmailOtp', () => {
    it('verifies the OTP and records success', async () => {
      mockVerifyEmailOtp.mockResolvedValueOnce({ id: 'user-1' });
      const onAuthenticated = vi.fn();
      const { result } = renderHook(() => useEmailOtp(onAuthenticated));

      await act(async () => {
        await result.current.verifyEmailOtp({ email: 'user@example.com', otp: '123456' });
      });

      expect(mockVerifyEmailOtp).toHaveBeenCalledWith({ email: 'user@example.com', otp: '123456' });
      expect(onAuthenticated).toHaveBeenCalledWith({ id: 'user-1' });
      expect(mockCaptureEvent).toHaveBeenCalledWith(
        'auth_email_otp_verify_succeeded',
        expect.objectContaining({ email: 'user@example.com' }),
      );
    });

    it('updates the user name after successful OTP verification', async () => {
      mockVerifyEmailOtp.mockResolvedValueOnce({ id: 'user-1' });
      mockUpdateUser.mockResolvedValueOnce({ id: 'user-1', name: 'Jane' });
      const { result } = renderHook(() => useEmailOtp());

      await act(async () => {
        await result.current.verifyEmailOtp({
          email: 'user@example.com',
          otp: '123456',
          name: 'Jane',
        });
      });

      expect(mockVerifyEmailOtp).toHaveBeenCalledWith({ email: 'user@example.com', otp: '123456' });
      expect(mockUpdateUser).toHaveBeenCalledWith({ name: 'Jane' });
    });

    it('surfaces HominemAuth verification errors', async () => {
      mockVerifyEmailOtp.mockRejectedValueOnce(new Error('Invalid code'));
      const { result } = renderHook(() => useEmailOtp());

      await act(async () => {
        await expect(
          result.current.verifyEmailOtp({ email: 'user@example.com', otp: '000000' }),
        ).rejects.toThrow('Invalid code');
      });
    });
  });
});
