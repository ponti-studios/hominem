export function withConsoleErrorSpy(fn: (spy: jest.SpyInstance) => void | Promise<void>) {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

  return Promise.resolve(fn(spy)).finally(() => {
    spy.mockRestore()
  })
}

export function withConsoleWarnSpy(fn: (spy: jest.SpyInstance) => void | Promise<void>) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})

  return Promise.resolve(fn(spy)).finally(() => {
    spy.mockRestore()
  })
}
