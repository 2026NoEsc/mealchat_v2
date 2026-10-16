const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.join(directory,'chatE.fixtures.ts');
const blocked = ['src/auth/AuthProvider.tsx','src/profile/useMyProfile.ts','src/rooms/useMyRooms.ts','src/lib/rooms.ts','src/lib/placeCandidates.ts','src/lib/voting.ts','src/theme/keyboard.ts','scripts/ui-preview/offline-supabase.ts'].map(file=>path.resolve(directory,'../..',file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context,moduleName,platform) => {
  const resolved = previous(context,moduleName,platform);
  return resolved.type === 'sourceFile' && blocked.includes(path.resolve(resolved.filePath)) ? {type:'sourceFile',filePath:fixture} : resolved;
};
module.exports = config;
