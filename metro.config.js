const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 🔥 FORCE tslib ESM RESOLUTION
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  tslib: require.resolve('tslib/tslib.es6.js'),
};

module.exports = config;
