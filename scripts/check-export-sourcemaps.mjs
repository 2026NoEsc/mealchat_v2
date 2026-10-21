import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const packages = ['node-forge', 'braces', 'sprintf-js', 'argparse'];
const sourcePattern = new RegExp(`(?:^|[/\\\\])(?:${packages.join('|')})(?:[/\\\\]|$)`);
// Quoted package specifiers also catch references inside bundled module sources.
// An ordinary prose use of the word "braces" is not a package reference.
const contentPattern = new RegExp(`(['"\x60])(?:${packages.join('|')})(?:/[^'"\x60]*)?\\1`);
const exportDirectory = mkdtempSync(join(tmpdir(), 'mealchat-export-audit-'));

function sourceMapsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceMapsIn(path) : entry.name.endsWith('.map') ? [path] : [];
  });
}

function mapParts(map) {
  return map.sections ? map.sections.flatMap((section) => mapParts(section.map)) : [map];
}

async function exportApp() {
  const args = ['--no-install', 'expo', 'export', '--platform', 'all', '--source-maps',
    '--no-bytecode', '--max-workers', '2', '--output-dir', exportDirectory];
  let command = 'npx';
  if (process.platform === 'win32') {
    // Run npx's JavaScript entry directly so temporary paths never enter a shell.
    const npxCommand = execFileSync('where.exe', ['npx.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    const npxCli = resolve(dirname(npxCommand), 'node_modules/npm/bin/npx-cli.js');
    if (!existsSync(npxCli)) throw new Error('Cannot locate the installed npx JavaScript entry.');
    command = process.execPath;
    args.unshift(npxCli);
  }
  await new Promise((resolveExport, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot, shell: false,
      env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', CI: '1', npm_config_offline: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk) => { output = (output + chunk.toString()).slice(-16000); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolveExport();
      else reject(new Error(`Expo export failed (${code}).\n${output}`));
    });
  });
}

try {
  console.log(`Export source-map audit date (UTC): ${new Date().toISOString().slice(0, 10)}`);
  console.log('Command: npx --no-install expo export --platform all --source-maps --no-bytecode --max-workers 2 --output-dir <temporary-directory>');
  console.log('Environment: EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 CI=1 npm_config_offline=true');
  console.log(`Checked packages: ${packages.join(', ')}`);
  await exportApp();
  console.log('Expo export: PASS');
  let failed = false;
  for (const platform of ['android', 'ios', 'web']) {
    const maps = sourceMapsIn(join(exportDirectory, '_expo/static/js', platform));
    if (!maps.length) throw new Error(`Missing source maps for ${platform}.`);
    let sources = 0;
    let pathMatches = 0;
    let contentMatches = 0;
    for (const path of maps) {
      for (const map of mapParts(JSON.parse(readFileSync(path, 'utf8')))) {
        if (!Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)
          || map.sources.length === 0 || map.sources.length !== map.sourcesContent.length
          || map.sourcesContent.some((content) => typeof content !== 'string')) {
          throw new Error(`Incomplete sources/sourcesContent in ${platform} source map.`);
        }
        sources += map.sources.length;
        for (const [index, source] of map.sources.entries()) {
          if (sourcePattern.test(source)) {
            pathMatches++;
            console.log(`${platform} package path match: ${source}`);
          }
          if (contentPattern.test(map.sourcesContent[index])) {
            contentMatches++;
            console.log(`${platform} quoted package reference in: ${source}`);
          }
        }
      }
    }
    const passed = pathMatches === 0 && contentMatches === 0;
    failed ||= !passed;
    console.log(`${platform}: maps=${maps.length}, sources=${sources}, pathMatches=${pathMatches}, contentMatches=${contentMatches}, ${passed ? 'PASS' : 'FAIL'}`);
  }
  if (failed) throw new Error('Exception package references were found in exported source maps.');
  console.log('Export source-map audit: PASS');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const cleanupPath = realpathSync(exportDirectory);
  if (dirname(cleanupPath) !== realpathSync(tmpdir()) || !basename(cleanupPath).startsWith('mealchat-export-audit-')) {
    throw new Error('Refusing to remove an unverified temporary export directory.');
  }
  rmSync(cleanupPath, { recursive: true, force: true });
  console.log('Temporary export directory removed.');
}
