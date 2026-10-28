/** Isolated bundle; production configuration is untouched. */
const config = require('./metro.config.cjs');
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  context = { ...context, preferNativePlatform: platform !== 'web' };
  if (platform === 'web' && moduleName === 'react-native') return context.resolveRequest(context, 'react-native-web', platform);
  return previous(context, moduleName, platform);
};
module.exports = config;
