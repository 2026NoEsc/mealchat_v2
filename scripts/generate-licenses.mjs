import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');

/** Legacy arrays are displayed as a list, without inventing an AND/OR licensing expression. */
export function normalizeLicense(value, packageName, warn = message => process.stderr.write(message + '\n')) {
  const parts = metadata => {
    if (typeof metadata === 'string' && metadata.trim()) return [metadata.trim()];
    if (Array.isArray(metadata) && metadata.length) return metadata.flatMap(parts);
    if (metadata && typeof metadata === 'object') {
      if (metadata.type !== undefined) return parts(metadata.type);
      if (metadata.license !== undefined) return parts(metadata.license);
    }
    warn(`Unrecognized license metadata for ${packageName}; review its package license notice.`);
    return ['라이선스 정보 확인 필요'];
  };
  return [...new Set(parts(value))].join('; ');
}

export function collectLicenses(root = projectRoot) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const entries = Object.keys(manifest.dependencies ?? {}).sort().map((name) => {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) throw new Error(`Invalid dependency name: ${name}`);
    const installed = JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8'));
    const metadata = installed.license ?? installed.licenses;
    if (installed.name !== name || typeof installed.version !== 'string' || !installed.version || metadata == null) {
      throw new Error(`Missing or invalid license metadata: ${name}`);
    }
    const license = normalizeLicense(metadata, name);
    return { name, version: installed.version, license };
  });
  // Bundled font notices are manual; no unsupported font-version number is invented.
  return [...entries,
    { name: '42dot Sans', version: null, license: 'SIL OFL 1.1' },
    { name: 'Iosevka Charon', version: null, license: 'SIL OFL 1.1' },
  ];
}

export function generateLicenses(root = projectRoot) {
  const entries = collectLicenses(root);
  const output = resolve(root, 'src/legal/licenses.generated.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  return entries;
}

/** CI check: never create, replace, or repair the committed generated file. */
export function checkLicenses(root = projectRoot) {
  const entries = collectLicenses(root);
  const output = resolve(root, 'src/legal/licenses.generated.json');
  let actual;
  try { actual = readFileSync(output, 'utf8'); }
  catch { throw new Error('License file is missing or unreadable. Run npm run legal:licenses and include src/legal/licenses.generated.json in the commit.'); }
  // Git on Windows can convert line endings on checkout; content must otherwise match exactly.
  if (actual.replace(/\r\n/g, '\n') !== JSON.stringify(entries, null, 2) + '\n') {
    throw new Error('License file is out of date. Run npm run legal:licenses and include src/legal/licenses.generated.json in the commit.');
  }
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/generate-licenses.mjs [--check]');
    const checking = args[0] === '--check';
    const entries = checking ? checkLicenses() : generateLicenses();
    process.stdout.write(`${checking ? 'Checked' : 'Generated'} ${entries.length} license entries.\n`);
  }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
