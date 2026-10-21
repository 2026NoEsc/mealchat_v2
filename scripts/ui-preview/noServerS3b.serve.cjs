process.env.EXPO_NO_DOTENV = '1';
process.env.EXPO_NO_CACHE = '1';
const path = require('node:path');
const Metro = require('metro');
const { loadConfig } = require('metro-config');
async function serve() {
  // loadConfig adds projectRoot to watchFolders; passing the raw Expo config leaves its file map empty.
  const config = await loadConfig({ config: path.join(path.dirname(module.filename), 'noServerS3b.metro.cjs'), port: 8113, maxWorkers: 2, resetCache: true });
  await Metro.runServer(config, { host: '127.0.0.1', waitForBundler: true });
  console.log('Offline Metro ready on 127.0.0.1:8113');
}
serve().catch(error => { console.error(error); process.exitCode = 1; });
