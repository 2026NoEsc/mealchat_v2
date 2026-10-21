process.env.EXPO_NO_DOTENV = '1';
process.env.EXPO_OFFLINE = '1';
const { execFileSync } = require('node:child_process');
const Metro = require('metro');
const { loadConfig } = require('metro-config');
const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'npx --no-install supabase status -o json'], { encoding: 'utf8', windowsHide: true });
const status = JSON.parse(raw.slice(raw.indexOf('{')));
if (status.API_URL !== 'http://127.0.0.1:54321' || !status.ANON_KEY) throw Error('Project-local public configuration unavailable');
// Only public, project-local configuration enters the bundle. Never load dotenv/provider configuration.
process.env.EXPO_PUBLIC_SUPABASE_URL = status.API_URL;
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.ANON_KEY;
process.env.EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP = '1';
process.env.EXPO_PUBLIC_TMAP_APP_KEY = '';
(async () => {
  const config = await loadConfig({ config: require.resolve('./s1E2e.metro.cjs'), port: 8146, maxWorkers: 2 });
  await Metro.runServer(config, { host: '127.0.0.1', waitForBundler: true });
  process.stdout.write('Real S4 application preview ready on 8146\n');
})().catch(() => { process.stderr.write('Local S4 Metro failed\n'); process.exitCode = 1; });
