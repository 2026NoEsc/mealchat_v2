const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.resolve(directory, 'noServerS3b.fixtures.ts');
const blocked = ['src/auth/AuthProvider.tsx', 'src/profile/useMyProfile.ts', 'src/rooms/useMyRooms.ts', 'src/lib/rooms.ts', 'src/lib/placeCandidates.ts', 'src/lib/voting.ts', 'src/lib/tmap.ts', 'src/lib/settlements.ts', 'src/theme/keyboard.ts', 'scripts/ui-preview/offline-supabase.ts'].map(file => path.resolve(directory, '../..', file));
const previous = config.resolver.resolveRequest;
config.resolver.platforms = [...new Set([...config.resolver.platforms, 'web'])];
config.resolver.resolveRequest = (context, name, platform) => {
  // Expo CLI normally supplies these web-specific resolver settings.
  const target = platform === 'web' ? { ...context, preferNativePlatform: false, mainFields: ['browser', 'main'] } : context;
  if (platform === 'web' && name === 'react-native') return context.resolveRequest(target, 'react-native-web', platform);
  const result = previous(target, name, platform);
  return result.type === 'sourceFile' && blocked.includes(path.resolve(result.filePath)) ? { type: 'sourceFile', filePath: fixture } : result;
};
module.exports = config;
