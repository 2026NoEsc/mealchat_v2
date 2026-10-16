const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, statSync, copyFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const projectRoot = resolve(__dirname, '..');
const run = (source) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { cwd: projectRoot, encoding: 'utf8', timeout: 15000 }));

function fixture(metadata = { license: 'MIT' }) {
  const directory = mkdtempSync(join(tmpdir(), 'mealchat-licenses-test-'));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ dependencies: { fixture: '1' } }));
  mkdirSync(join(directory, 'node_modules', 'fixture'), { recursive: true });
  writeFileSync(join(directory, 'node_modules', 'fixture', 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', ...metadata }));
  return directory;
}

it('generates deterministic metadata for all direct dependencies and bundled fonts', () => {
  const actual = run("import { collectLicenses } from './scripts/generate-licenses.mjs'; process.stdout.write(JSON.stringify(collectLicenses()));");
  const generated = JSON.parse(readFileSync(resolve(projectRoot, 'src/legal/licenses.generated.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
  expect(generated).toEqual(actual);
  for (const name of Object.keys(manifest.dependencies)) {
    const installed = JSON.parse(readFileSync(resolve(projectRoot, 'node_modules', name, 'package.json'), 'utf8'));
    expect(actual.find((entry) => entry.name === name)).toMatchObject({ name, version: installed.version, license: typeof installed.license === 'string' ? installed.license : installed.license.type });
  }
  expect(actual.filter((entry) => entry.version === null).map((entry) => entry.name)).toEqual(['42dot Sans', 'Iosevka Charon']);
  expect(actual).toHaveLength(Object.keys(manifest.dependencies).length + 2);
});

it('rejects missing license metadata instead of inventing a license', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mealchat-licenses-test-'));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ dependencies: { fixture: '1' } }));
  mkdirSync(join(directory, 'node_modules', 'fixture'), { recursive: true });
  writeFileSync(join(directory, 'node_modules', 'fixture', 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
  const result = run(`import { collectLicenses } from './scripts/generate-licenses.mjs'; try { collectLicenses(${JSON.stringify(directory)}); process.stdout.write('false'); } catch { process.stdout.write('true'); }`);
  expect(result).toBe(true);
});

it.each([
  [{ license: { type: 'BSD-3-Clause', url: 'https://example.test/license' } }, 'BSD-3-Clause', false],
  [{ license: ['MIT', { type: 'Apache-2.0' }, 'MIT'] }, 'MIT; Apache-2.0', false],
  [{ licenses: [{ type: 'ISC' }, { type: 'MIT' }] }, 'ISC; MIT', false],
  [{ license: { license: 'ISC' } }, 'ISC', false],
  [{ license: { url: 'https://example.test/license' } }, '라이선스 정보 확인 필요', true],
  [{ license: [] }, '라이선스 정보 확인 필요', true],
])('normalizes non-string package license metadata without throwing: %j', (metadata, expected, warning) => {
  const directory = fixture(metadata);
  const source = `import { collectLicenses } from './scripts/generate-licenses.mjs'; process.stdout.write(JSON.stringify(collectLicenses(${JSON.stringify(directory)})));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: projectRoot, encoding: 'utf8', timeout: 15000 });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).find(entry => entry.name === 'fixture').license).toBe(expected);
  expect(Boolean(result.stderr.trim())).toBe(warning);
  if (warning) expect(result.stderr).toContain('Unrecognized license metadata for fixture');
});

it.each(['current', 'crlf', 'outdated', 'missing'])('checks generated license metadata without writing: %s', mode => {
  const directory = fixture();
  const output = join(directory, 'src', 'legal', 'licenses.generated.json');
  if (mode !== 'missing') {
    run(`import { generateLicenses } from './scripts/generate-licenses.mjs'; process.stdout.write(JSON.stringify(generateLicenses(${JSON.stringify(directory)})));`);
    if (mode === 'outdated') writeFileSync(output, '[]\n');
    if (mode === 'crlf') writeFileSync(output, readFileSync(output, 'utf8').replace(/\n/g, '\r\n'));
  }
  const before = existsSync(output) ? { content: readFileSync(output, 'utf8'), modified: statSync(output).mtimeMs } : null;
  const result = run(`import { checkLicenses } from './scripts/generate-licenses.mjs'; try { const entries = checkLicenses(${JSON.stringify(directory)}); process.stdout.write(JSON.stringify({ count: entries.length })); } catch (error) { process.stdout.write(JSON.stringify({ error: error.message })); }`);
  if (mode === 'current' || mode === 'crlf') expect(result).toEqual({ count: 3 });
  else expect(result.error).toContain(mode === 'missing' ? 'missing' : 'out of date');
  if (before) {
    expect(readFileSync(output, 'utf8')).toBe(before.content);
    expect(statSync(output).mtimeMs).toBe(before.modified);
  } else {
    expect(existsSync(output)).toBe(false);
    expect(existsSync(join(directory, 'src'))).toBe(false);
  }
});

it('runs CLI check successfully and keeps quality read-only while development hooks regenerate licenses', () => {
  const output = join(projectRoot, 'src/legal/licenses.generated.json');
  const before = { content: readFileSync(output, 'utf8'), modified: statSync(output).mtimeMs };
  const result = spawnSync(process.execPath, ['scripts/generate-licenses.mjs', '--check'], { cwd: projectRoot, encoding: 'utf8', timeout: 15000 });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Checked');
  expect(readFileSync(output, 'utf8')).toBe(before.content);
  expect(statSync(output).mtimeMs).toBe(before.modified);
  const { scripts } = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  expect(scripts.prequality).toBe('npm run legal:licenses:check');
  expect(scripts['legal:licenses:check']).toContain('--check');
  for (const hook of ['prestart', 'pretunnel', 'preandroid', 'preios', 'preweb']) expect(scripts[hook]).toBe('npm run legal:licenses');
});

it.each(['outdated', 'missing'])('exits nonzero from CLI check without repairing a %s file', mode => {
  const directory = fixture();
  const scriptsDirectory = join(directory, 'scripts');
  mkdirSync(scriptsDirectory);
  const script = join(scriptsDirectory, 'generate-licenses.mjs');
  copyFileSync(join(projectRoot, 'scripts/generate-licenses.mjs'), script);
  const output = join(directory, 'src/legal/licenses.generated.json');
  if (mode === 'outdated') { mkdirSync(join(directory, 'src/legal'), { recursive: true }); writeFileSync(output, '[]\n'); }
  const result = spawnSync(process.execPath, [script, '--check'], { cwd: directory, encoding: 'utf8', timeout: 15000 });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(mode === 'missing' ? 'missing' : 'out of date');
  expect(result.stdout).toBe('');
  if (mode === 'outdated') expect(readFileSync(output, 'utf8')).toBe('[]\n');
  else expect(existsSync(output)).toBe(false);
});
