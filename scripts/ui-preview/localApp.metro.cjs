const path = require('node:path');
const config = require('./figmaRemaining.metro.cjs');
const previous = config.resolver.resolveRequest;
const stub = path.join(path.dirname(module.filename), 'localApp.stubs.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = previous(context, moduleName, platform);
  if (resolved.type === 'sourceFile' && /src[\\/]((auth[\\/]AuthProvider)|(components[\\/]NotificationsProvider))\.tsx$/.test(resolved.filePath)) return { type: 'sourceFile', filePath: stub };
  return resolved;
};
module.exports = config;
