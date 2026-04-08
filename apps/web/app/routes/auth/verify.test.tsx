import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Component, { loader } from './verify';

const mocks = vi.hoisted(() => ({
  loaderData: { email: 'person@example.com' },
  navigate: vi.fn(),
  emailOtpSendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  getServerAuth: vi.fn(),
  location: { search: '?email=person@example.com&next=/notes/123' },
  searchParams: new URLSearchParams('email=person@example.com&next=/notes/123'),
  assign: vi.fn(),
}));

function expectResponse(response: Response | null | { email: string }): Response {
  if (!(response instanceof Response)) {
    throw new Error('Expected a redirect response');
  }

  return response;
}

vi.mock('@hominem/auth/client', () => ({
  useAuthClient: () => ({
    emailOtp: {
      sendVerificationOtp: mocks.emailOtpSendVerificationOtp,
    },
    signIn: {
      emailOtp: mocks.signInEmailOtp,
    },
  }),
}));

vi.mock('~/lib/auth.server', () => ({
  getServerAuth: mocks.getServerAuth,
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useFetcher: () => ({ state: 'idle', data: undefined, submit: vi.fn() }),
    useLoaderData: () => mocks.loaderData,
    useLocation: () => mocks.location,
    useNavigate: () => mocks.navigate,
    useNavigation: () => ({ state: 'idle', formAction: null }),
    useSearchParams: () => [mocks.searchParams, vi.fn()],
  };
});

describe('/auth/verify route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loaderData = { email: 'person@example.com' };
    mocks.location = { search: '?email=person@example.com&next=/notes/123' };
    mocks.searchParams = new URLSearchParams('email=person@example.com&next=/notes/123');
    mocks.emailOtpSendVerificationOtp.mockResolvedValue({ error: null });
    mocks.signInEmailOtp.mockResolvedValue({
      error: null,
      data: { user: { id: 'user-1' } },
    });
    mocks.getServerAuth.mockResolvedValue({ user: null, headers: new Headers() });
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost',
      assign: mocks.assign,
    });
  });

  it('redirects authenticated users to a safe destination', async () => {
    mocks.getServerAuth.mockResolvedValue({
      user: { id: 'user-1' },
      headers: new Headers(),
    });

    const response = expectResponse(
      await loader({
        request: new Request(
          'http://localhost/auth/verify?email=person@example.com&next=/notes/123',
        ),
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/notes/123');
  });

  it('redirects back to /auth when email is missing', async () => {
    const response = expectResponse(
      await loader({
        request: new Request('http://localhost/auth/verify?next=/notes/123'),
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth');
  });

  it('verifies the otp and navigates to a safe redirect', async () => {
    render(<Component />);

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mocks.signInEmailOtp).toHaveBeenCalledWith({
        email: 'person@example.com',
        otp: '123456',
      });
    });

    expect(mocks.navigate).toHaveBeenCalledWith('/notes/123');
  });

  it('shows otp verification failures inline', async () => {
    mocks.signInEmailOtp.mockResolvedValue({
      error: { message: 'Invalid code' },
      data: null,
    });

    render(<Component />);

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Invalid code')).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('resends otp through the route callback', async () => {
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));

    await waitFor(() => {
      expect(mocks.emailOtpSendVerificationOtp).toHaveBeenCalledWith({
        email: 'person@example.com',
        type: 'sign-in',
      });
    });
  });

  it('changes email while preserving next', () => {
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));

    expect(mocks.assign).toHaveBeenCalledWith('/auth?next=%2Fnotes%2F123');
  });
});
