export function withIsolatedEnv<T>(fn: () => T | Promise<T>): T | Promise<T> {
  const originalEnv = { ...process.env }

  try {
    return fn()
  } finally {
    Object.assign(process.env, originalEnv)
  }
}

export function withIsolatedEnvAsync<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const originalEnv = { ...process.env }

  return fn().finally(() => {
    Object.assign(process.env, originalEnv)
  })
}

export function createEnvSnapshot() {
  const snapshot = { ...process.env }
  return {
    restore: () => {
      Object.keys(process.env).forEach((key) => {
        if (!(key in snapshot)) {
          delete process.env[key]
        }
      })
      Object.assign(process.env, snapshot)
    },
  }
}
