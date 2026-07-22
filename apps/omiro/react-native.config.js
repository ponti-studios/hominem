const usesDevelopmentClient =
  (((process.env.APP_ENV ?? 'development') === 'development').toString()) !== 'false'

module.exports = {
  dependencies: usesDevelopmentClient
    ? {}
    : {
        'expo-dev-client': {
          platforms: {
            ios: null,
            android: null,
          },
        },
      },
}
