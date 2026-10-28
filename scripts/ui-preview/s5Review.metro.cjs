const path = require('node:path');
const config = require('./s5App.metro.cjs');
const fixture = path.resolve(path.dirname(module.filename), 's5Review.fixtures.ts');
const blocked = ['src/lib/supabase.ts', 'src/auth/AuthProvider.tsx', 'src/lib/consents.ts', 'src/lib/rooms.ts', 'src/lib/voting.ts'].map(file => path.resolve(file));
const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  const resolved = previous(context, name, platform);
  return resolved.type === 'sourceFile' && blocked.includes(path.resolve(resolved.filePath)) ? { type: 'sourceFile', filePath: fixture } : resolved;
};
module.exports = config;
