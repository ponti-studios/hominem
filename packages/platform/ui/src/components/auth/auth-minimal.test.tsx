import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthScaffold } from './auth-scaffold';
import { EmailEntryForm } from './email-entry-form';
import { OtpVerificationForm } from './otp-verification-form';
import { PasskeyButton } from './passkey-button';

const submit = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    Form: ({ children, ...props }: React.ComponentProps<'form'>) => <form {...props}>{children}</form>,
    useFetcher: () => ({ state: 'idle', data: undefined, submit }),
    useNavigation: () => ({ state: 'idle', formAction: null }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

describe('auth minimal surfaces', () => {
  afterEach(() => {
    submit.mockClear();
  });

  it('renders the stripped scaffold with a joyful accent', () => {
    render(<AuthScaffold title="Sign in" helper="We’ll send a code to your email." />);

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('We’ll send a code to your email.')).toBeInTheDocument();
    expect(document.querySelector('.animate-ping')).toBeInTheDocument();
  });

  it('renders the email entry form with only the compact controls', () => {
    render(<EmailEntryForm action="/auth" onPasskeyClick={vi.fn()} />);

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use passkey/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the otp verification form with a single field and recovery links', () => {
    render(
      <OtpVerificationForm
        action="/auth/verify"
        email="monday@example.com"
        onChangeEmail={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a different email' })).toBeInTheDocument();
    expect(screen.queryByText(/attempt/i)).toBeNull();
  });

  it('renders passkey as a compact text action', () => {
    render(<PasskeyButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /use passkey/i })).toBeInTheDocument();
  });
});
