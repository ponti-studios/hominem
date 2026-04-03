import React from 'react'
import { screen, waitFor } from '@testing-library/react-native'

import { changeText, createDeferred, press, renderScreen } from '../support/render'
import { routerSpies } from '../support/router'

const mockCompletePasskeySignIn = jest.fn()
const mockRequestEmailOtp = jest.fn()
const mockVerifyEmailOtp = jest.fn()
const mockPasskeySignIn = jest.fn()
const mockUseAuth = jest.fn()
const mockUseMobilePasskeyAuth = jest.fn()
let mockIsE2ETesting = false
let mockIsMobilePasskeyEnabled = true

const authState: {
  authError: Error | null
  authStatus: 'signed_out' | 'degraded'
  isSignedIn: boolean
  completePasskeySignIn: typeof mockCompletePasskeySignIn
  requestEmailOtp: typeof mockRequestEmailOtp
  verifyEmailOtp: typeof mockVerifyEmailOtp
} = {
  authError: null,
  authStatus: 'signed_out',
  isSignedIn: false,
  completePasskeySignIn: mockCompletePasskeySignIn,
  requestEmailOtp: mockRequestEmailOtp,
  verifyEmailOtp: mockVerifyEmailOtp,
}

jest.mock('expo-router')

jest.mock('~/utils/auth-provider', () => ({
  __esModule: true,
  useAuth: () => mockUseAuth(),
}))

jest.mock('~/utils/use-mobile-passkey-auth', () => ({
  __esModule: true,
  useMobilePasskeyAuth: () => mockUseMobilePasskeyAuth(),
}))

jest.mock('~/utils/constants', () => ({
  get E2E_TESTING() {
    return mockIsE2ETesting
  },
  get MOBILE_PASSKEY_ENABLED() {
    return mockIsMobilePasskeyEnabled
  },
}))

jest.mock('~/lib/posthog', () => ({
  posthog: {
    capture: jest.fn(),
  },
}))

function resetAuthState() {
  authState.authError = null
  authState.authStatus = 'signed_out'
  authState.isSignedIn = false
}

function installHookMocks() {
  mockUseAuth.mockImplementation(() => authState)
  mockUseMobilePasskeyAuth.mockImplementation(() => ({
    signIn: mockPasskeySignIn,
    isLoading: false,
    error: null,
    isSupported: true,
  }))
}

function renderAuthScreen() {
  installHookMocks()
  const { AuthScreen } = require('../../app/(auth)/index')
  return renderScreen(<AuthScreen />)
}

function renderVerifyScreen() {
  installHookMocks()
  const { VerifyScreen } = require('../../app/(auth)/verify')
  return renderScreen(<VerifyScreen />, {
    pathname: '/(auth)/verify',
    params: { email: 'mobile-test@hominem.test' },
  })
}

describe('auth rendered screens', () => {
  beforeEach(() => {
    resetAuthState()
    mockCompletePasskeySignIn.mockReset()
    mockRequestEmailOtp.mockReset()
    mockVerifyEmailOtp.mockReset()
    mockPasskeySignIn.mockReset()
    mockUseAuth.mockReset()
    mockUseMobilePasskeyAuth.mockReset()
    mockIsE2ETesting = false
    mockIsMobilePasskeyEnabled = true
  })

  it('shows validation error when email is empty', async () => {
    renderAuthScreen()

    await press(screen.getByTestId('auth-send-otp'))

    expect(await screen.findByTestId('auth-email-message')).toHaveTextContent('Email is required.')
    expect(mockRequestEmailOtp).not.toHaveBeenCalled()
  })

  it('submits normalized email and routes to verify screen', async () => {
    mockRequestEmailOtp.mockResolvedValue(undefined)

    renderAuthScreen()

    await changeText(screen.getByTestId('auth-email-input'), '  USER@Example.com  ')
    await press(screen.getByTestId('auth-send-otp'))

    await waitFor(() => {
      expect(mockRequestEmailOtp).toHaveBeenCalledWith('user@example.com')
      expect(screen.getByTestId('auth-send-otp')).not.toBeDisabled()
    })

    expect(routerSpies.replace).toHaveBeenCalledWith('/(auth)/verify?email=user%40example.com')
  })

  it('shows verify screen validation error when OTP is invalid', async () => {
    renderVerifyScreen()

    await changeText(screen.getByTestId('auth-otp-input'), '12')
    await press(screen.getByTestId('auth-verify-otp'))

    expect(await screen.findByTestId('auth-otp-message')).toHaveTextContent('Code must be 6 digits.')
    expect(mockVerifyEmailOtp).not.toHaveBeenCalled()
  })

  it('submits normalized OTP to verify flow', async () => {
    mockVerifyEmailOtp.mockResolvedValue(undefined)

    renderVerifyScreen()

    await changeText(screen.getByTestId('auth-otp-input'), '12 34-56')
    await press(screen.getByTestId('auth-verify-otp'))

    await waitFor(() => {
      expect(mockVerifyEmailOtp).toHaveBeenCalledWith({
        email: 'mobile-test@hominem.test',
        otp: '123456',
      })
      expect(screen.getByTestId('auth-verify-otp')).not.toBeDisabled()
    })
  })

  it('renders a single OTP field and keeps the typed code normalized', async () => {
    renderVerifyScreen()

    await changeText(screen.getByTestId('auth-otp-input'), '12 34-56')

    expect(screen.getByTestId('auth-otp-input')).toHaveProp('value', '123456')
    expect(screen.queryByTestId('auth-otp-slot-0')).toBeNull()
  })

  it('resends the code without showing extra confirmation chrome', async () => {
    mockRequestEmailOtp.mockResolvedValue(undefined)

    renderVerifyScreen()

    await press(screen.getByTestId('auth-resend-otp'))

    await waitFor(() => {
      expect(mockRequestEmailOtp).toHaveBeenCalledWith('mobile-test@hominem.test')
    })

    expect(screen.queryByText('A new code is on the way.')).toBeNull()
  })

  it('shows inline error and re-enables submit on OTP verify failure', async () => {
    mockVerifyEmailOtp.mockRejectedValue(new Error('Invalid or expired code.'))

    renderVerifyScreen()

    await changeText(screen.getByTestId('auth-otp-input'), '123456')
    await press(screen.getByTestId('auth-verify-otp'))

    expect(await screen.findByTestId('auth-otp-message')).toHaveTextContent('Invalid or expired code.')

    await waitFor(() => {
      expect(screen.getByTestId('auth-verify-otp')).not.toBeDisabled()
    })
  })

  it('disables send-code button while OTP request is in-flight', async () => {
    const otpRequest = createDeferred<void>()
    mockRequestEmailOtp.mockReturnValue(otpRequest.promise)

    renderAuthScreen()
    await changeText(screen.getByTestId('auth-email-input'), 'user@example.com')
    await press(screen.getByTestId('auth-send-otp'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-send-otp')).toBeDisabled()
    })

    otpRequest.resolve()

    await waitFor(() => {
      expect(screen.getByTestId('auth-send-otp')).not.toBeDisabled()
    })
  })

  it('disables verify button while OTP verify is in-flight', async () => {
    const verifyRequest = createDeferred<void>()
    mockVerifyEmailOtp.mockReturnValue(verifyRequest.promise)

    renderVerifyScreen()
    await changeText(screen.getByTestId('auth-otp-input'), '123456')
    await press(screen.getByTestId('auth-verify-otp'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-verify-otp')).toBeDisabled()
    })

    verifyRequest.resolve()

    await waitFor(() => {
      expect(screen.getByTestId('auth-verify-otp')).not.toBeDisabled()
    })
  })

  it('shows passkey CTA when supported and invokes passkey sign-in', async () => {
    mockPasskeySignIn.mockResolvedValue({
      accessToken: 'passkey-access-token',
      refreshToken: 'passkey-refresh-token',
      expiresIn: 600,
      tokenType: 'Bearer',
      user: {
        id: 'passkey-user',
        email: 'passkey-user@hominem.test',
      },
    })

    renderAuthScreen()

    await press(screen.getByTestId('auth-passkey-button'))

    await waitFor(() => {
      expect(mockPasskeySignIn).toHaveBeenCalledTimes(1)
      expect(mockCompletePasskeySignIn).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('auth-passkey-button')).not.toBeDisabled()
    })
  })

  it('shows degraded boot errors without a retry recovery CTA', () => {
    authState.authStatus = 'degraded'
    authState.authError = new Error('Boot timed out')

    renderAuthScreen()

    expect(screen.getByTestId('auth-email-message')).toHaveTextContent('Boot timed out')
    expect(screen.queryByTestId('auth-retry-recovery')).toBeNull()
  })

  it('hides passkey CTA when the mobile passkey flag is disabled', () => {
    mockIsMobilePasskeyEnabled = false

    renderAuthScreen()

    expect(screen.queryByTestId('auth-passkey-button')).toBeNull()
    expect(screen.queryByTestId('auth-e2e-passkey-success')).toBeNull()
    expect(screen.queryByTestId('auth-e2e-passkey-cancel')).toBeNull()
  })
})
