import type { User } from '@hominem/auth'
import type { MessageOutput } from '../../utils/services/chat/chat-contract'

export interface AuthStateFixture {
  authError: Error | null
  authStatus: 'signed_out' | 'degraded' | 'signed_in'
  isSignedIn: boolean
  isAuthenticating: boolean
  isRefreshing: boolean
}

export interface ChatThreadFixture {
  chatId: string
  userId: string
  title: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string
  }>
}

export interface NetworkStateFixture {
  isConnected: boolean
  isInternetReachable: boolean
}

export interface NoteFixture {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface MessageFixture {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export function buildAuthUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'mobile-test@hominem.test',
    name: 'Mobile Test User',
    emailVerified: false,
    image: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

export function createMockAuthState(overrides: Partial<AuthStateFixture> = {}): AuthStateFixture {
  return {
    authError: null,
    authStatus: 'signed_out',
    isSignedIn: false,
    isAuthenticating: false,
    isRefreshing: false,
    ...overrides,
  }
}

export function createMockAuthContext(
  overrides: Partial<Record<'authState' | 'completePasskeySignIn' | 'requestEmailOtp' | 'verifyEmailOtp' | 'signOut', unknown>> = {},
) {
  return {
    authState: createMockAuthState(),
    completePasskeySignIn: jest.fn(),
    requestEmailOtp: jest.fn(),
    verifyEmailOtp: jest.fn(),
    signOut: jest.fn(),
    ...overrides,
  }
}

export function buildMockSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user: buildAuthUser(),
    session: {
      id: 'session-123',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token: 'mock-token',
      ipAddress: '127.0.0.1',
      userAgent: 'Test User-Agent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  }
}

export function buildChatThreadFixture(overrides: Partial<ChatThreadFixture> = {}): ChatThreadFixture {
  return {
    chatId: 'chat-1',
    userId: 'user-1',
    title: 'Integration chat',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

export function buildMessageOutput(overrides: Partial<MessageOutput> = {}): MessageOutput {
  return {
    id: 'msg-1',
    role: 'user',
    message: 'Hello',
    created_at: '2026-01-01T00:00:00.000Z',
    chat_id: 'chat-1',
    profile_id: '',
    focus_ids: null,
    focus_items: null,
    toolCalls: null,
    ...overrides,
  }
}

export function buildOfflineNetworkState(overrides: Partial<NetworkStateFixture> = {}): NetworkStateFixture {
  return {
    isConnected: false,
    isInternetReachable: false,
    ...overrides,
  }
}

export function buildOnlineNetworkState(overrides: Partial<NetworkStateFixture> = {}): NetworkStateFixture {
  return {
    isConnected: true,
    isInternetReachable: true,
    ...overrides,
  }
}

export function buildChat(overrides: Partial<{ id: string; title: string; createdAt: string; archivedAt: string | null; updatedAt: string }> = {}) {
  return {
    id: `chat-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Chat',
    createdAt: new Date('2026-03-17T00:00:00.000Z').toISOString(),
    archivedAt: null,
    updatedAt: new Date('2026-03-18T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

export function buildNote(overrides: Partial<NoteFixture> = {}): NoteFixture {
  return {
    id: `note-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Note',
    content: 'Test note content',
    createdAt: new Date('2026-03-17T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-03-18T00:00:00.000Z').toISOString(),
    deletedAt: null,
    ...overrides,
  }
}

export function buildMessage(overrides: Partial<MessageFixture> = {}): MessageFixture {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    content: 'Test message',
    createdAt: new Date('2026-03-18T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}
