/** Isolated auth-screen preview. No production AuthProvider or backend client. */
const path = require('node:path');
const config = require('./metro.config.cjs');
const previewDirectory = path.dirname(module.filename);
const previousResolver = config.resolver.resolveRequest;
const authProvider = path.resolve(previewDirectory, '../../src/auth/AuthProvider.tsx');
const emailClient = path.resolve(previewDirectory, '../../src/lib/email.ts');
config.resolver.resolveRequest = (context, name, platform) => {
  const resolved = previousResolver(context, name, platform);
  if (resolved.type === 'sourceFile' && path.resolve(resolved.filePath) === emailClient) {
    return { type: 'sourceFile', filePath: path.resolve(previewDirectory, 'offline-email.ts') };
  }
  return resolved.type === 'sourceFile' && path.resolve(resolved.filePath) === authProvider
    ? { type: 'sourceFile', filePath: path.resolve(previewDirectory, 'offline-auth.ts') }
    : resolved;
};
module.exports = config;
