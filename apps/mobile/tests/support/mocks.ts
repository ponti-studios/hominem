export interface StorageMocks {
  mockGetItemAsync: jest.Mock<Promise<string | null>, [string]>
  mockSetItemAsync: jest.Mock<Promise<void>, [string, string]>
  mockDeleteItemAsync: jest.Mock<Promise<void>, [string]>
  mockClearAllData: jest.Mock<Promise<void>, []>
}

export function createStorageMocks(): StorageMocks {
  const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>()
  const mockSetItemAsync = jest.fn<Promise<void>, [string, string]>()
  const mockDeleteItemAsync = jest.fn<Promise<void>, [string]>()
  const mockClearAllData = jest.fn<Promise<void>, []>()

  mockGetItemAsync.mockResolvedValue(null)
  mockSetItemAsync.mockResolvedValue(undefined)
  mockDeleteItemAsync.mockResolvedValue(undefined)
  mockClearAllData.mockResolvedValue(undefined)

  return {
    mockGetItemAsync,
    mockSetItemAsync,
    mockDeleteItemAsync,
    mockClearAllData,
  }
}

export interface AuthMocks {
  mockPasskeySignIn: jest.Mock
  mockAddPasskey: jest.Mock
  mockDeletePasskey: jest.Mock
  mockListPasskeys: jest.Mock
  mockFetch: jest.Mock
  mockRequestEmailOtp: jest.Mock
  mockVerifyEmailOtp: jest.Mock
  mockCompletePasskeySignIn: jest.Mock
}

export function createAuthMocks(): AuthMocks {
  return {
    mockPasskeySignIn: jest.fn(),
    mockAddPasskey: jest.fn(),
    mockDeletePasskey: jest.fn(),
    mockListPasskeys: jest.fn(),
    mockFetch: jest.fn(),
    mockRequestEmailOtp: jest.fn(),
    mockVerifyEmailOtp: jest.fn(),
    mockCompletePasskeySignIn: jest.fn(),
  }
}

export interface AnalyticsMocks {
  mockCapture: jest.Mock
  mockCaptureException: jest.Mock
  mockIdentify: jest.Mock
  mockReset: jest.Mock
}

export function createAnalyticsMocks(): AnalyticsMocks {
  return {
    mockCapture: jest.fn(),
    mockCaptureException: jest.fn(),
    mockIdentify: jest.fn(),
    mockReset: jest.fn(),
  }
}

export interface AppStateMocks {
  mockGetState: jest.Mock
  mockSubscribe: jest.Mock
  mockReset: jest.Mock
}

export function createAppStateMocks(): AppStateMocks {
  const mockGetState = jest.fn()
  const mockSubscribe = jest.fn()
  const mockReset = jest.fn()

  mockGetState.mockReturnValue({
    isAuthenticated: false,
    isInitializing: false,
  })
  mockSubscribe.mockReturnValue(jest.fn())

  return {
    mockGetState,
    mockSubscribe,
    mockReset,
  }
}

export function resetAllMocks(
  ...mockGroups: Array<Record<string, jest.Mock>>
): void {
  mockGroups.forEach((group) => {
    Object.values(group).forEach((mock) => {
      if (typeof mock?.mockReset === 'function') {
        mock.mockReset()
      }
    })
  })
}
