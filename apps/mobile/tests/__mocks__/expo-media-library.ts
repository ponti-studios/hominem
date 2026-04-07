export const usePermissions = () => [
  { granted: true, status: 'granted' },
  async () => ({ granted: true, status: 'granted' }),
] as const

export const requestPermissionsAsync = async () => ({ granted: true, status: 'granted' })

export const saveToLibraryAsync = async () => undefined
