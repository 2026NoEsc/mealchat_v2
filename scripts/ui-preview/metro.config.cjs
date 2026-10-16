/** Manual fixture only. The production Metro configuration remains unchanged. */
const path = require('node:path');
const config = require('../../metro.config.js');

const previewDirectory = path.dirname(module.filename);
const productionClient = path.resolve(previewDirectory, '../../src/lib/supabase.ts');
const offlineClient = path.resolve(previewDirectory, 'offline-supabase.ts');
const previousResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = previousResolver
    ? previousResolver(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  if (resolved.type === 'sourceFile' && path.resolve(resolved.filePath) === productionClient) {
    return { type: 'sourceFile', filePath: offlineClient };
  }
  return resolved;
};

module.exports = config;
