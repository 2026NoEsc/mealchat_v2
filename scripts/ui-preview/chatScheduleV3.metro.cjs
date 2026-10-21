/** Offline schedule-sheet preview only. Production API clients are replaced or blocked. */
const path = require('node:path');
const config = require('./metro.config.cjs');
const directory = path.dirname(module.filename);
const fixture = path.join(directory, 'chatScheduleV3.fixtures.ts');
const blocked = ['src/auth/AuthProvider.tsx', 'src/lib/availability.ts', 'src/lib/rooms.ts', 'src/theme/keyboard.ts'].map(file => path.resolve(directory, '../..', file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  const resolved = previous(context, name, platform);
  return resolved.type === 'sourceFile' && blocked.includes(path.resolve(resolved.filePath)) ? { type: 'sourceFile', filePath: fixture } : resolved;
};
module.exports = config;
