import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowlistPath = resolve(projectRoot, 'security', 'audit-allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));

if (allowlist.schemaVersion !== 1 || !Array.isArray(allowlist.advisories)) {
  throw new Error('security/audit-allowlist.json has an unsupported schema.');
}

const allowedAdvisories = new Map();
for (const entry of allowlist.advisories) {
  if (!/^GHSA-[\w-]+$/i.test(entry.id ?? '')) {
    throw new Error(`Invalid advisory ID in allowlist: ${entry.id}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn ?? '')) {
    throw new Error(`Invalid expiry date for ${entry.id}: ${entry.expiresOn}`);
  }
  if (!entry.reason?.trim()) {
    throw new Error(`Missing reason for ${entry.id}.`);
  }
  if (allowedAdvisories.has(entry.id.toUpperCase())) {
    throw new Error(`Duplicate advisory ID in allowlist: ${entry.id}`);
  }
  allowedAdvisories.set(entry.id.toUpperCase(), entry);
}

const isWindows = process.platform === 'win32';
const auditCommand = isWindows ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
const auditArguments = isWindows
  ? ['/d', '/s', '/c', 'npm audit --json']
  : ['audit', '--json'];
const auditResult = spawnSync(auditCommand, auditArguments, {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  shell: false,
});

if (auditResult.error) {
  throw auditResult.error;
}

let auditReport;
try {
  auditReport = JSON.parse(auditResult.stdout);
} catch {
  console.error(auditResult.stderr || auditResult.stdout);
  throw new Error('npm audit did not return valid JSON.');
}

if (auditReport.error) {
  throw new Error(`npm audit failed: ${auditReport.error.summary ?? auditReport.error.code}`);
}

const detectedAdvisories = new Map();
const unidentifiedFindings = [];

for (const [packageName, vulnerability] of Object.entries(auditReport.vulnerabilities ?? {})) {
  for (const cause of vulnerability.via ?? []) {
    if (typeof cause === 'string') {
      continue;
    }

    const advisoryId = cause.url?.match(/GHSA-[\w-]+/i)?.[0]?.toUpperCase();
    if (!advisoryId) {
      unidentifiedFindings.push(`${packageName}: ${cause.title ?? cause.source ?? 'unknown advisory'}`);
      continue;
    }

    const packages = detectedAdvisories.get(advisoryId) ?? new Set();
    packages.add(packageName);
    detectedAdvisories.set(advisoryId, packages);
  }
}

const today = new Date().toISOString().slice(0, 10);
const unknownAdvisories = [...detectedAdvisories.keys()].filter(
  (id) => !allowedAdvisories.has(id),
);
const expiredAdvisories = [...allowedAdvisories.values()].filter(
  (entry) => today >= entry.expiresOn,
);
const staleAdvisories = [...allowedAdvisories.keys()].filter(
  (id) => !detectedAdvisories.has(id),
);

if (
  unknownAdvisories.length > 0 ||
  expiredAdvisories.length > 0 ||
  staleAdvisories.length > 0 ||
  unidentifiedFindings.length > 0
) {
  if (unknownAdvisories.length > 0) {
    console.error(`New advisories require review: ${unknownAdvisories.sort().join(', ')}`);
  }
  if (expiredAdvisories.length > 0) {
    console.error(
      `Expired audit exceptions: ${expiredAdvisories
        .map((entry) => `${entry.id} (${entry.expiresOn})`)
        .join(', ')}`,
    );
  }
  if (staleAdvisories.length > 0) {
    console.error(`Resolved advisories must be removed from the allowlist: ${staleAdvisories.sort().join(', ')}`);
  }
  if (unidentifiedFindings.length > 0) {
    console.error(`Unidentified audit findings: ${unidentifiedFindings.join(' | ')}`);
  }
  process.exit(1);
}

const total = auditReport.metadata?.vulnerabilities?.total ?? 0;
console.log(
  `Dependency audit gate passed: ${total} vulnerability records map only to ${detectedAdvisories.size} temporary exceptions.`,
);
for (const id of [...detectedAdvisories.keys()].sort()) {
  const entry = allowedAdvisories.get(id);
  console.log(`- ${id} (${entry.package}), expires ${entry.expiresOn}`);
}
