/** Read-only UI fixtures: no dotenv, no production Supabase client, no provider calls. */
const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.join(directory, 'schedule-fixtures.ts');
const blocked = [
  'src/rooms/useMyRooms.ts', 'src/auth/AuthProvider.tsx', 'src/profile/useMyProfile.ts', 'src/lifecycle/AppLifecycleContext.tsx',
  'src/components/NotificationsProvider.tsx', 'src/lib/calendarNotes.ts', 'src/lib/friends.ts',
  'src/lib/myLocation.ts', 'src/lib/tmap.ts', 'src/lib/rooms.ts', 'src/lib/availability.ts',
  'src/lib/placeCandidates.ts', 'scripts/ui-preview/offline-supabase.ts',
].map((file) => path.resolve(directory, '../..', file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-location') return { type: 'sourceFile', filePath: fixture };
  const resolved = previous(context, moduleName, platform);
  if (resolved.type !== 'sourceFile') return resolved;
  const file = path.resolve(resolved.filePath);
  if (blocked.includes(file)) return { type: 'sourceFile', filePath: fixture };
  if (/[/\\]components[/\\]TmapMap(?:\.web)?\.tsx$/.test(file)) return { type: 'sourceFile', filePath: path.join(directory, 'schedule-map-fixture.tsx') };
  return resolved;
};
module.exports = config;
