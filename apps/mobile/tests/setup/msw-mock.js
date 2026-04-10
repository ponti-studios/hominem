jest.mock('until-async', () => ({
  until: jest.fn(),
}), { virtual: true })

jest.mock('msw', () => ({
  setupServer: jest.fn(() => ({
    listen: jest.fn(),
    close: jest.fn(),
    resetHandlers: jest.fn(),
    use: jest.fn(),
  })),
  delay: jest.fn(),
  http: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  HttpResponse: {
    json: jest.fn((data, init) => ({ json: data, ...init })),
    error: jest.fn(),
    redirect: jest.fn(),
    null: jest.fn(),
  },
}))

jest.mock('msw/node', () => ({
  setupServer: jest.fn(() => ({
    listen: jest.fn(),
    close: jest.fn(),
    resetHandlers: jest.fn(),
    use: jest.fn(),
  })),
}))
