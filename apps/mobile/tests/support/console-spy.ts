export function withConsoleErrorSpy(fn: (spy: jest.SpyInstance) => void | Promise<void>) {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  return Promise.resolve(fn(spy)).finally(() => {
    spy.mockRestore();
  });
}
