const fs = require('node:fs');
const { spawnSync, execFileSync } = require('node:child_process');
fs.mkdirSync('tmp/s4-e2e', { recursive: true });
const identity = execFileSync('docker', ['inspect', '--format', '{{.Name}} {{json .NetworkSettings.Ports}}', 'supabase_db_mealchat_v2'], { encoding: 'utf8', windowsHide: true });
const ports = JSON.parse(identity.slice(identity.indexOf(' ') + 1));
if (!identity.startsWith('/supabase_db_mealchat_v2 ') || ports['5432/tcp']?.[0]?.HostPort !== '54322') throw Error('Project-local DB identity mismatch');
const result = { container: 'supabase_db_mealchat_v2', port: 54322, commands: [] };
for (const command of ['npx --no-install supabase start', 'npx --no-install supabase db reset --local']) {
  const run = spawnSync(process.env.ComSpec, ['/d', '/s', '/c', command], { encoding: 'utf8', windowsHide: true, timeout: 300000 });
  // CLI status/start may contain local secret keys. Never persist or print its raw output.
  const migrations = [...((run.stdout ?? '') + (run.stderr ?? '')).matchAll(/Applying migration ([a-zA-Z0-9_.]+)\.\.\./g)].map(match => match[1]);
  result.commands.push({ command, exitCode: run.status, migrations });
  fs.writeFileSync('tmp/s4-e2e/setup.json', JSON.stringify(result, null, 2));
  console.log(command + ': exit ' + run.status + ', migrations ' + migrations.length);
  if (run.status !== 0) process.exit(run.status ?? 1);
}
