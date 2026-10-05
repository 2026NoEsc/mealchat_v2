const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { readFileSync, readdirSync } = require('node:fs');

const projectRoot = resolve(__dirname, '..');
const runNode = (source) => JSON.parse(execFileSync(process.execPath, ['-e', source], {
  cwd: projectRoot,
  encoding: 'utf8',
  timeout: 15000,
}));

const sourcePathsIn = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourcePathsIn(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });

describe('patched build dependencies', () => {
  it('reads PNG buffers and asset file paths through the Expo Metro wrapper', () => {
    const result = runNode(`
      const { readFileSync } = require('node:fs');
      const { resolve } = require('node:path');
      const { getAssetSize, getAssetData } = require('@expo/metro/metro/Assets');
      const path = resolve('assets/ad/banner-1.png');
      const content = readFileSync(path);
      const expected = { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
      (async () => {
        const asset = await getAssetData(path, 'assets/ad/banner-1.png', [], 'android', '/assets');
        console.log(JSON.stringify({
          expected,
          buffer: getAssetSize('png', content, path),
          file: { width: asset.width, height: asset.height },
        }));
      })().catch(error => { console.error(error.message); process.exitCode = 1; });
    `);
    expect(result.expected.width).toBeGreaterThan(0);
    expect(result.expected.height).toBeGreaterThan(0);
    expect(result.buffer).toEqual(result.expected);
    expect(result.file).toEqual(result.expected);
  });

  it('rejects malformed image input without hanging', () => {
    const result = runNode(`
      const { getAssetSize } = require('@expo/metro/metro/Assets');
      const failures = [];
      for (const content of [Buffer.alloc(0), Buffer.from('invalid'), Buffer.from([0x89, 0x50, 0x4e, 0x47])]) {
        try { getAssetSize('png', content, 'invalid.png'); failures.push(false); }
        catch { failures.push(true); }
      }
      console.log(JSON.stringify(failures));
    `);
    expect(result).toEqual([true, true, true]);
  });

  it('generates unique Xcode identifiers through the CommonJS uuid consumer', () => {
    const result = runNode(`
      const project = require('xcode').project('test.pbxproj');
      project.hash = { project: { objects: {} } };
      const ids = Array.from({ length: 100 }, () => project.generateUuid());
      console.log(JSON.stringify(ids));
    `);
    expect(new Set(result).size).toBe(100);
    for (const id of result) expect(id).toMatch(/^[0-9A-F]{24}$/);
  });

  it('rejects undersized UUID output buffers in the package resolved by Xcode', () => {
    const result = runNode(`
      const { createRequire } = require('node:module');
      const { v3, v5, v6 } = createRequire(require.resolve('xcode'))('uuid');
      const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const failures = [
        () => v3('test', namespace, new Uint8Array(8), 4),
        () => v5('test', namespace, new Uint8Array(8), 4),
        () => v6({}, new Uint8Array(8), 4),
      ].map(write => {
        try { write(); return false; }
        catch (error) { return error instanceof RangeError; }
      });
      console.log(JSON.stringify(failures));
    `);
    expect(result).toEqual([true, true, true]);
  });
  it('round-trips plist through both updated XML parser consumers', () => {
    const result = runNode(`
      const expoPlist = require('@expo/plist').default;
      const plist = require('plist');
      const data = { name: 'MealChat', characters: '<&>', count: 2, enabled: true };
      console.log(JSON.stringify([
        expoPlist.parse(expoPlist.build(data)),
        plist.parse(plist.build(data)),
      ]));
    `);
    const expected = { name: 'MealChat', characters: '<&>', count: 2, enabled: true };
    expect(result).toEqual([expected, expected]);
  });

  it('keeps Expo CLI file observers working with the patched Metro watcher', () => {
    const result = runNode(`
      const { EventEmitter } = require('node:events');
      const { resolve } = require('node:path');
      const { installMetroWatchCompatibility } = require('./scripts/metro-watch-compat.cjs');
      installMetroWatchCompatibility();
      const FileMap = require('metro-file-map').default;
      const once = FileMap.prototype.emit;
      installMetroWatchCompatibility();
      const watcher = new EventEmitter();
      Object.setPrototypeOf(watcher, FileMap.prototype);
      const server = new EventEmitter();
      const runner = { server, metro: { getBundler: () => ({ getBundler: () => ({ getWatcher: () => watcher }) }) } };
      const cliPath = resolve(require.resolve('@expo/cli/package.json'), '..', 'build/src/start/server/metro/waitForMetroToObserveTypeScriptFile.js');
      const { observeFileChanges, observeAnyFileChanges, waitForMetroToObserveTypeScriptFile } = require(cliPath);
      let callbacks = 0, tsCallbacks = 0, captured;
      observeFileChanges(runner, [resolve('tsconfig.json')], () => callbacks++);
      observeAnyFileChanges(runner, events => { captured = events; });
      waitForMetroToObserveTypeScriptFile(process.cwd(), runner, () => tsCallbacks++);
      const changes = {
        addedFiles: new Map([['src/new.ts', { isSymlink: false, modifiedTime: 1 }]]),
        modifiedFiles: new Map([['tsconfig.json', { isSymlink: false, modifiedTime: 2 }]]),
        removedFiles: new Map([['src/removed.ts', { isSymlink: false, modifiedTime: 0 }]]),
        addedDirectories: new Set(['directory.ts']), removedDirectories: new Set(),
      };
      let preserved = false;
      watcher.once('change', event => { preserved = event.changes === changes; });
      watcher.emit('change', { changes, rootDir: process.cwd() });
      const translated = captured.map(event => ({type: event.type, filePath: event.filePath, kind: event.metadata.type}));
      const legacy = [{ type: 'change', filePath: resolve('tsconfig.json'), metadata: { type: 'f' } }];
      watcher.emit('change', { eventsQueue: legacy });
      const legacyPreserved = captured === legacy;
      server.emit('close');
      const remaining = watcher.listenerCount('change');
      console.log(JSON.stringify({ callbacks, tsCallbacks, translated, preserved, legacyPreserved, remaining, idempotent: once === FileMap.prototype.emit }));
    `);
    expect(result.callbacks).toBe(2);
    expect(result.tsCallbacks).toBe(1);
    expect(result.translated).toEqual([
      { type: 'add', filePath: resolve(projectRoot, 'src/new.ts'), kind: 'f' },
      { type: 'change', filePath: resolve(projectRoot, 'tsconfig.json'), kind: 'f' },
      { type: 'delete', filePath: resolve(projectRoot, 'src/removed.ts'), kind: 'f' },
      { type: 'add', filePath: resolve(projectRoot, 'directory.ts'), kind: 'd' },
    ]);
    expect(result.preserved).toBe(true);
    expect(result.legacyPreserved).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.idempotent).toBe(true);
  });
});

const auditAllowlist = JSON.parse(readFileSync(resolve(projectRoot, 'security/audit-allowlist.json'), 'utf8'));
const forgeException = auditAllowlist.advisories.find((entry) => entry.id.toUpperCase() === 'GHSA-86W9-CPQP-85RV');
const bracesException = auditAllowlist.advisories.find((entry) => entry.id.toUpperCase() === 'GHSA-VFJ7-8CJW-P6XM');

(bracesException ? describe : describe.skip)('temporary braces exception boundary', () => {
  it('requires reassessment before the reviewed expiry and any version change', () => {
    expect(bracesException.package).toBe('braces');
    expect(bracesException.expiresOn).toBe('2026-10-09');
    const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
    for (const target of ['braces', 'micromatch']) {
      const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${target}`) || path === `node_modules/${target}`);
      expect(entries).toHaveLength(1);
      expect(entries[0][1].version).toBe(target === 'braces' ? '3.0.3' : '4.0.8');
    }
  });

  it('limits consumers to the reviewed Jest and Metro tooling', () => {
    const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
    const consumers = (target) => Object.entries(lock.packages)
      .filter(([, entry]) => [entry.dependencies, entry.optionalDependencies, entry.peerDependencies]
        .some((dependencies) => Object.hasOwn(dependencies ?? {}, target)))
      .map(([path]) => path).sort();
    expect(consumers('braces')).toEqual(['node_modules/micromatch']);
    const reviewedConsumers = [
      'node_modules/@jest/core', 'node_modules/@jest/transform', 'node_modules/jest-config',
      'node_modules/jest-haste-map', 'node_modules/jest-message-util', 'node_modules/metro-file-map',
    ];
    expect(consumers('micromatch')).toEqual(reviewedConsumers);
    for (const path of reviewedConsumers) {
      expect(lock.packages[path].version).toBe(path.endsWith('/metro-file-map') ? '0.83.8' : '29.7.0');
    }
    const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
    for (const group of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of ['braces', 'micromatch']) expect(manifest[group]?.[name]).toBeUndefined();
    }
  });

  it('blocks glob package imports in app, config, and build scripts', () => {
    const configs = readdirSync(projectRoot).filter((name) => /\.config\.[cm]?[jt]s$/.test(name)).map((name) => resolve(projectRoot, name));
    const paths = [resolve(projectRoot, 'App.tsx'), resolve(projectRoot, 'index.js'), ...configs,
      ...sourcePathsIn(resolve(projectRoot, 'src')), ...sourcePathsIn(resolve(projectRoot, 'scripts'))];
    const imports = paths.filter((path) => /['"`](?:braces|micromatch|picomatch)(?:\/[^'"`]*)?['"`]/.test(readFileSync(path, 'utf8')));
    expect(imports).toEqual([]);
  });

  it('matches through the reviewed APIs without executing braces', () => {
    const result = runNode(`
      const bracesPath = require.resolve('braces');
      require(bracesPath);
      let calls = 0;
      const blocked = () => { calls++; throw new Error('Vulnerable braces execution is blocked'); };
      require.cache[bracesPath].exports = new Proxy(blocked, { get: () => blocked });
      const mm = require('micromatch');
      const { createRequire } = require('node:module');
      const picomatchVersion = createRequire(require.resolve('micromatch'))('picomatch/package.json').version;
      const { includedByGlob } = require('./node_modules/metro-file-map/src/watchers/common.js');
      const pattern = '**/*.{js,ts}';
      const matches = [
        mm(['src/app.ts', 'src/app.png'], pattern, { nocase: true, windows: false }),
        mm.some('src/app.ts', pattern, { dot: true }), mm.isMatch('src/app.ts', pattern),
        mm.any('src/app.ts', pattern),
        includedByGlob('f', [pattern], false, 'src/app.ts'),
        includedByGlob('f', [], false, 'src/app.ts'),
        includedByGlob('f', [pattern], false, 'src/app.png'),
      ];
      const matchingCalls = calls;
      let dangerousApiBlocked = false;
      try { mm.braceExpand('{a,b}'); } catch { dangerousApiBlocked = true; }
      console.log(JSON.stringify({ matches, matchingCalls, dangerousApiBlocked, picomatchVersion }));
    `);
    expect(result.matches).toEqual([['src/app.ts'], true, true, true, true, true, false]);
    expect(result.matchingCalls).toBe(0);
    expect(result.dangerousApiBlocked).toBe(true);
    expect(result.picomatchVersion).toBe('2.3.2');
  });

  it('checks the bundled workspace resolver and blocks its braces execution during matching', () => {
    const result = runNode(`
      const { readFileSync } = require('node:fs');
      const { createHash } = require('node:crypto');
      const { runInNewContext } = require('node:vm');
      const { dirname, join, resolve } = require('node:path');
      const source = readFileSync(require.resolve('resolve-workspace-root'), 'utf8');
      const marker = '610:(e,t,r)=>{';
      if (source.split(marker).length !== 2) throw new Error('Bundled braces module changed');
      const instrumented = source.replace(marker, marker + 'globalThis.bracesLoaded++;const blocked=()=>{globalThis.bracesCalls++;throw new Error("Bundled braces execution blocked");};e.exports=new Proxy(blocked,{get:()=>blocked});globalThis.blockedBraces=e.exports;return;');
      const root = resolve('tmp/virtual-workspace');
      const child = join(root, 'packages', 'app');
      const files = new Map([[join(root, 'package.json'), JSON.stringify({ workspaces: ['packages/{app,lib}'] })]]);
      const read = (path) => {
        if (files.has(path)) return files.get(path);
        throw Object.assign(new Error('Fixture file absent'), { code: 'ENOENT' });
      };
      const virtualFs = { readFileSync: read, promises: { readFile: async (path) => read(path) } };
      const sandbox = { module: { exports: {} }, bracesLoaded: 0, bracesCalls: 0, process, console, Buffer, __dirname: dirname(require.resolve('resolve-workspace-root')),
        require: (name) => name === 'node:fs' ? virtualFs : require(name) };
      try { runInNewContext(instrumented, sandbox); }
      catch (error) { console.error(error.message); process.exit(1); }
      const resolver = sandbox.module.exports;
      (async () => {
        const sync = resolver.resolveWorkspaceRoot(child) === root;
        const asyncMatch = await resolver.resolveWorkspaceRootAsync(child) === root;
        const excluded = resolver.resolveWorkspaceRoot(join(root, 'other')) === null;
        const matchingCalls = sandbox.bracesCalls;
        let dangerousApiBlocked = false;
        try { sandbox.blockedBraces('{a,b}'); } catch { dangerousApiBlocked = true; }
        console.log(JSON.stringify({
          sha256: createHash('sha256').update(source).digest('hex'),
          version: require('resolve-workspace-root/package.json').version,
          sync, async: asyncMatch, excluded, loaded: sandbox.bracesLoaded,
          matchingCalls, dangerousApiBlocked, callsAfterControl: sandbox.bracesCalls,
        }));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `);
    expect(result).toEqual({
      sha256: 'ee3be37ce5bce6f0de05ee538653d13f8cbf6a7ec8c8f4ed24466025e5e34f2e',
      version: '2.0.1', sync: true, async: true, excluded: true,
      loaded: 1, matchingCalls: 0, dangerousApiBlocked: true, callsAfterControl: 1,
    });
    const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
    expect(Object.keys(lock.packages).filter((path) => /(?:^|\/)node_modules\/resolve-workspace-root$/.test(path))).toEqual(['node_modules/resolve-workspace-root']);
    const consumers = Object.entries(lock.packages).filter(([, entry]) =>
      [entry.dependencies, entry.optionalDependencies, entry.peerDependencies].some((group) => Object.hasOwn(group ?? {}, 'resolve-workspace-root')))
      .map(([path, entry]) => [path, entry.version]).sort();
    expect(consumers).toEqual([['node_modules/@expo/config', '12.0.14'], ['node_modules/@expo/package-manager', '1.13.1']]);
  });
});

// Remove this conditional boundary guard when an upstream fix removes the exception.
(forgeException ? describe : describe.skip)('temporary node-forge exception boundary', () => {
  it('requires explicit reassessment before extending the seven-day exception', () => {
    expect(forgeException.package).toBe('node-forge');
    expect(forgeException.expiresOn).toBe('2026-10-09');
  });

  it('limits forge consumers to the reviewed CLI packages and excludes expo-updates', () => {
    const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
    const consumers = Object.entries(lock.packages)
      .filter(([, entry]) => [entry.dependencies, entry.optionalDependencies, entry.peerDependencies]
        .some((dependencies) => Object.hasOwn(dependencies ?? {}, 'node-forge')))
      .map(([path]) => path)
      .sort();
    expect(consumers).toEqual([
      'node_modules/@expo/cli',
      'node_modules/@expo/code-signing-certificates',
    ]);
    expect(Object.keys(lock.packages).filter((path) => /(?:^|\/)node_modules\/expo-updates$/.test(path))).toEqual([]);
    expect(() => require.resolve('expo-updates')).toThrow();
  });

  it('blocks configuration changes that enable the reviewed signing paths', () => {
    const config = JSON.parse(readFileSync(resolve(projectRoot, 'app.json'), 'utf8')).expo;
    expect(config.updates?.codeSigningCertificate).toBeUndefined();
    expect(config.updates?.codeSigningMetadata).toBeUndefined();
    expect(config.extra?.eas?.projectId).toBeUndefined();
    expect(readdirSync(projectRoot).filter((name) => /^app\.config\./.test(name))).toEqual([]);
    const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
    expect(manifest.expo).toBeUndefined();
  });

  it('blocks direct forge imports in application sources', () => {
    const sourcePaths = [resolve(projectRoot, 'App.tsx'), resolve(projectRoot, 'index.js')];
    const collectSources = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) collectSources(path);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name)) sourcePaths.push(path);
      }
    };
    collectSources(resolve(projectRoot, 'src'));
    const imports = sourcePaths.filter((path) => /['"]node-forge(?:\/[^'"]*)?['"]/.test(readFileSync(path, 'utf8')));
    expect(imports).toEqual([]);
  });
});
