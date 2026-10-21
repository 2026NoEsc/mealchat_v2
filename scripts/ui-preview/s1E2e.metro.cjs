const config = require('../../metro.config.js');
const previous = config.resolver.resolveRequest;
// Real application and real SDK. Only React Native's web target is selected.
config.resolver.resolveRequest = (context, name, platform) => {
  context = { ...context, preferNativePlatform: platform !== 'web' };
  if (platform === 'web' && name === 'react-native') return context.resolveRequest(context, 'react-native-web', platform);
  return previous ? previous(context, name, platform) : context.resolveRequest(context, name, platform);
};
module.exports = config;
