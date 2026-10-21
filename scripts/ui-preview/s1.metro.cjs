const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.join(directory, 's1.fixtures.ts');
const replaced = ['src/auth/AuthProvider.tsx', 'src/profile/useMyProfile.ts', 'src/components/NotificationsProvider.tsx', 'src/lib/profile.ts', 'src/lib/settlements.ts'].map(file => path.resolve(directory, '../..', file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  context = { ...context, preferNativePlatform: platform !== 'web' };
  if (platform === 'web' && name === 'react-native') return context.resolveRequest(context, 'react-native-web', platform);
  const result = previous(context, name, platform);
  return result.type === 'sourceFile' && replaced.includes(path.resolve(result.filePath)) ? { type: 'sourceFile', filePath: fixture } : result;
};
module.exports = config;
