/** Read-only local fixtures. Real service modules are replaced before bundling. */
const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.join(directory, 'profileD.fixtures.ts');
const replaced = [
  'src/auth/AuthProvider.tsx', 'src/profile/useMyProfile.ts',
  'src/components/NotificationsProvider.tsx', 'src/lib/friends.ts',
  'src/lib/profile.ts', 'src/lib/avatar.ts', 'src/lib/tmap.ts',
  'src/lib/passwordReauthentication.ts',
].map((file) => path.resolve(directory, '../..', file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  context = { ...context, preferNativePlatform: platform !== 'web' };
  if (platform === 'web' && moduleName === 'react-native') return context.resolveRequest(context, 'react-native-web', platform);
  if (moduleName === 'expo-image-picker') return { type: 'sourceFile', filePath: fixture };
  const resolved = previous(context, moduleName, platform);
  if (resolved.type !== 'sourceFile') return resolved;
  if (replaced.includes(path.resolve(resolved.filePath))) return { type: 'sourceFile', filePath: fixture };
  if (/[/\\]components[/\\]TmapMap(?:\.web)?\.tsx$/.test(resolved.filePath)) return { type: 'sourceFile', filePath: path.join(directory, 'profileD.map.tsx') };
  return resolved;
};
module.exports = config;
