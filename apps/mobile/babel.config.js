module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          reactCompiler: true,
          lazyImports: true,
        },
      ],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
