process.env.EXPO_NO_DOTENV = '1';
process.env.EXPO_OFFLINE = '1';
const Metro = require('metro');
const { loadConfig } = require('metro-config');
(async () => {
  const config = await loadConfig({ config: require.resolve('./s4App.metro.cjs'), port: 8144, maxWorkers: 2 });
  await Metro.runServer(config, { host: '127.0.0.1', waitForBundler: true });
  process.stdout.write('S4 isolated preview ready on 8144\n');
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
