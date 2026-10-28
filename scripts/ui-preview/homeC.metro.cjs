/** Isolated C preview: no production clients or remote calls. */
const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.join(directory, 'homeC.fixtures.ts');
const blocked = ['src/auth/AuthProvider.tsx', 'src/profile/useMyProfile.ts', 'src/lifecycle/AppLifecycleContext.tsx', 'src/rooms/useMyRooms.ts', 'src/lib/rooms.ts', 'src/lib/settlements.ts', 'scripts/ui-preview/offline-supabase.ts'].map(file => path.resolve(directory, '../..', file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = previous(context, moduleName, platform);
  if (resolved.type === 'sourceFile' && blocked.includes(path.resolve(resolved.filePath))) return { type: 'sourceFile', filePath: fixture };
  return resolved;
};
module.exports = config;
