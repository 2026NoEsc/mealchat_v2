/** Isolated settings preview: no backend or real device permission requests. */
const path = require('node:path');
const config = require('./authA.metro.cjs');
const previousResolver = config.resolver.resolveRequest;
const previewDirectory = path.dirname(module.filename);
const permissionModule = path.resolve(previewDirectory, '../../src/screens/settings/notificationPermission.ts');
config.resolver.resolveRequest = (context, name, platform) => {
  const resolved = previousResolver(context, name, platform);
  return resolved.type === 'sourceFile' && path.resolve(resolved.filePath) === permissionModule
    ? { type: 'sourceFile', filePath: path.resolve(previewDirectory, 'settingsS3.permission-fixture.ts') }
    : resolved;
};
module.exports = config;
