const config = require('../../metro.config.js');
const previous = config.resolver.resolveRequest;
config.resolver.platforms = [...new Set([...config.resolver.platforms, 'web'])];
config.resolver.resolveRequest = (context, name, platform) => {
  const target = platform === 'web' ? { ...context, preferNativePlatform: false, mainFields: ['browser', 'main'] } : context;
  if (platform === 'web' && name === 'react-native') return context.resolveRequest(target, 'react-native-web', platform);
  return previous ? previous(target, name, platform) : context.resolveRequest(target, name, platform);
};
module.exports = config;
