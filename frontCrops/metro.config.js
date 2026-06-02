const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const withNw = withNativeWind(config, { input: './global.css' });

// After NativeWind wraps the config, force Metro to skip Watchman. Watchman often gets EPERM under ~/Downloads on macOS.
withNw.resolver = { ...withNw.resolver, useWatchman: false };

module.exports = withNw;