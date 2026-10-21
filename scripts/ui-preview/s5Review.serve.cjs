process.env.EXPO_NO_DOTENV = '1';
process.env.EXPO_NO_CACHE = '1';
const path = require('node:path');
const Metro = require('metro');
const { loadConfig } = require('metro-config');
(async () => {
  const config = await loadConfig({ config: path.join(path.dirname(module.filename), 's5Review.metro.cjs'), port: 8116, maxWorkers: 2, resetCache: true });
  await Metro.runServer(config, { host: '127.0.0.1', waitForBundler: true });
  console.log('S5 review fixture Metro ready on 8116');
})().catch(() => { console.error('S5 review preview failed'); process.exitCode = 1; });
