const path = require('node:path');
const config = require('../../metro.config.js');
const directory = path.dirname(module.filename);
const root = path.resolve(directory, '../..');
const fixture = path.join(directory, 's4App.fixtures.ts');
const blocked = ['src/auth/AuthProvider.tsx', 'src/navigation/NavigationContext.tsx', 'src/lib/consents.ts', 'src/lib/foodProfile.ts', 'src/lib/voting.ts', 'src/lib/rooms.ts', 'src/lib/settlements.ts', 'src/profile/useMyProfile.ts', 'src/lib/supabase.ts', 'src/lib/tmap.ts', 'src/theme/keyboard.ts', 'src/rooms/useMyRooms.ts'].map(file => path.join(root, file));
const previous = config.resolver.resolveRequest;
config.resolver.platforms = [...new Set([...config.resolver.platforms, 'web'])];
config.resolver.resolveRequest = (context, name, platform) => {
  const target = platform === 'web' ? { ...context, preferNativePlatform: false, mainFields: ['browser', 'main'] } : context;
  if (platform === 'web' && name === 'react-native') return context.resolveRequest(target, 'react-native-web', platform);
  const result = previous ? previous(target, name, platform) : context.resolveRequest(target, name, platform);
  return result.type === 'sourceFile' && blocked.includes(path.resolve(result.filePath)) ? { type: 'sourceFile', filePath: fixture } : result;
};
module.exports = config;
