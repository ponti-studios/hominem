import { type Mock, vi } from 'vitest';

function mockFn(implementation?: (...args: never[]) => unknown): Mock {
  return vi.fn(implementation);
}

export const mockOAuth2Client = {
  setCredentials: mockFn(),
  refreshAccessToken: mockFn(),
  generateAuthUrl: mockFn(),
  getToken: mockFn(),
};

export const mockCalendar = {
  events: {
    list: mockFn(),
    insert: mockFn(),
    update: mockFn(),
    delete: mockFn(),
  },
  calendarList: {
    list: mockFn(),
  },
};

export const mockPlaces = {
  searchText: mockFn(),
  get: mockFn(),
};

const OAuth2Mock = class {
  setCredentials = mockOAuth2Client.setCredentials;
  refreshAccessToken = mockOAuth2Client.refreshAccessToken;
  generateAuthUrl = mockOAuth2Client.generateAuthUrl;
  getToken = mockOAuth2Client.getToken;
};

export const googleapi = {
  Auth: {
    OAuth2Client: OAuth2Mock,
  },
  google: {
    auth: {
      OAuth2: OAuth2Mock,
    },
    calendar: mockFn(() => mockCalendar),
    places: mockFn(() => ({
      places: mockPlaces,
    })),
  },
};
