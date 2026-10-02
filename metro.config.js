const { installMetroWatchCompatibility } = require('./scripts/metro-watch-compat.cjs');
installMetroWatchCompatibility();

const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
