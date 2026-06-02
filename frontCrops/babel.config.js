module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4: only this plugin (must be last). Do not add worklets/plugin — duplicates break Metro.
    plugins: ['react-native-reanimated/plugin'],
  };
};
