import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const filename = resolve(root, 'src/legal', name + '.ts');
  if (!filename.startsWith(resolve(root, 'src/legal') + sep)) throw new Error('Legal imports must stay in src/legal.');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  modules.set(name, exports);
  const legalRequire = dependency => {
    if (!/^\.\/[\w.-]+$/.test(dependency)) throw new Error('Only sibling legal data imports are supported.');
    if (dependency.endsWith('.json')) return JSON.parse(readFileSync(resolve(dirname(filename), dependency), 'utf8'));
    return load(dependency.slice(2));
  };
  runInNewContext(code, { exports, require: legalRequire }, { filename });
  return exports;
}
const { canonicalLegalDocument } = load('canonical');
const documents = [
  ['service', 'service-2026-10-01-v2', load('terms').terms],
  ['privacy', 'privacy-2026-10-01-v1', load('privacy').privacy],
  ['health', 'health-2026-10-17-v1', load('healthConsent').healthConsent],
  ['marketing', 'marketing-2026-10-17-v1', load('marketingConsent').marketingConsent],
];
const result = Object.fromEntries(documents.map(([kind, version, document]) => {
  const canonical_content = canonicalLegalDocument(document);
  return [kind, { version, edition: document.edition, content_hash: createHash('sha256').update(canonical_content, 'utf8').digest('hex'), canonical_content }];
}));
/** Exported for isolated release/date/hash tests. Importing this module never writes files. */
export function buildPrivacyReleaseArtifact(releaseDate = load('privacyRevision').privacyRevisionReleaseDate) {
  const { resolvePrivacyRevisionPublication, finalizedPrivacyRevisionDocument, privacyRevisionSummary } = load('privacyRevision');
  const publication = resolvePrivacyRevisionPublication(releaseDate);
  const document = finalizedPrivacyRevisionDocument(publication);
  if (!document) return { release: null, privacy: null };
  const canonical_content = canonicalLegalDocument(document);
  return {
    release: {
      release_date: releaseDate, effective_date: publication.effectiveDate,
      effective_from: new Date(`${publication.effectiveDate}T00:00:00+09:00`).toISOString(),
      bundle_version: `mealchat-${publication.effectiveDate}-r2`, change_summary: privacyRevisionSummary.join('\n'),
    },
    privacy: {
      version: publication.version, edition: publication.edition,
      content_hash: createHash('sha256').update(canonical_content, 'utf8').digest('hex'), canonical_content,
    },
  };
}
function generate() {
  const revision = buildPrivacyReleaseArtifact();
  const outputs = [
    ['documents.generated.json', result], ['privacy-release.generated.json', revision],
  ].map(([name, data]) => ({ target: resolve(root, 'src/legal', name), output: JSON.stringify(data, null, 2) + '\n' }));
  if (process.argv.includes('--check')) {
    for (const { target, output } of outputs) {
      // Ignore checkout line endings only; canonical content and published hashes remain exact.
      if (readFileSync(target, 'utf8').replace(/\r\n?/g, '\n') !== output) throw new Error('Legal documents changed. Run node scripts/generate-legal-hashes.mjs and review versions before publishing.');
    }
  } else for (const { target, output } of outputs) writeFileSync(target, output, 'utf8');
  for (const document of Object.values(result)) process.stdout.write(`${document.version} ${document.content_hash}\n`);
  process.stdout.write(revision.privacy ? `${revision.privacy.version} ${revision.privacy.content_hash}\n` : 'Privacy revision: release date pending; no publication hash.\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generate();
