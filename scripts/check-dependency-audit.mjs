import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function dateValue(value, field, id) {
  const timestamp = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T00:00:00.000Z`) : NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${field} date for ${id}: ${value}`);
  }
  return timestamp;
}

export function validateAllowlist(allowlist, today = new Date().toISOString().slice(0, 10)) {
  if (allowlist?.schemaVersion !== 2 || !Array.isArray(allowlist.advisories)) {
    throw new Error('security/audit-allowlist.json has an unsupported schema.');
  }
  const allowedAdvisories = new Map();
  for (const entry of allowlist.advisories) {
    if (!entry || typeof entry.id !== 'string' || !/^GHSA-[\w-]+$/i.test(entry.id)) {
      throw new Error(`Invalid advisory ID in allowlist: ${entry?.id}`);
    }
    if (typeof entry.package !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(entry.package)) {
      throw new Error(`Invalid package for ${entry.id}: ${entry.package}`);
    }
    const reviewed = dateValue(entry.reviewedOn, 'reviewedOn', entry.id);
    const expires = dateValue(entry.expiresOn, 'expiresOn', entry.id);
    if (entry.reviewedOn > today) {
      throw new Error(`Future reviewedOn for ${entry.id}: ${entry.reviewedOn}`);
    }
    if (expires <= reviewed || expires - reviewed > 30 * millisecondsPerDay) {
      throw new Error(`Exception period must be 1-30 days for ${entry.id}.`);
    }
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      throw new Error(`Missing reason for ${entry.id}.`);
    }
    const id = entry.id.toUpperCase();
    if (allowedAdvisories.has(id)) {
      throw new Error(`Duplicate advisory ID in allowlist: ${entry.id}`);
    }
    allowedAdvisories.set(id, entry);
  }
  return allowedAdvisories;
}

export function checkAuditReport(allowlist, auditReport, today = new Date().toISOString().slice(0, 10)) {
  const allowedAdvisories = validateAllowlist(allowlist, today);
  if (auditReport.error) {
    throw new Error(`npm audit failed: ${auditReport.error.summary ?? auditReport.error.code}`);
  }
  const detectedAdvisories = new Map();
  const errors = [];
  for (const [packageName, vulnerability] of Object.entries(auditReport.vulnerabilities ?? {})) {
    for (const cause of vulnerability.via ?? []) {
      if (typeof cause === 'string') continue;
      const id = cause.url?.match(/GHSA-[\w-]+/i)?.[0]?.toUpperCase();
      if (!id) {
        errors.push(`Unidentified audit finding: ${packageName}: ${cause.title ?? cause.source ?? 'unknown advisory'}`);
        continue;
      }
      const packages = detectedAdvisories.get(id) ?? new Set();
      packages.add(packageName);
      detectedAdvisories.set(id, packages);
    }
  }
  for (const [id, packages] of detectedAdvisories) {
    const entry = allowedAdvisories.get(id);
    if (!entry) {
      errors.push(`New advisory requires review: ${id}`);
    } else if (packages.size !== 1 || !packages.has(entry.package)) {
      errors.push(`Audit package mismatch for ${id}: allowed ${entry.package}; detected ${[...packages].sort().join(', ')}`);
    }
  }
  for (const [id, entry] of allowedAdvisories) {
    if (today >= entry.expiresOn) errors.push(`Expired audit exception: ${id} (${entry.expiresOn})`);
    if (!detectedAdvisories.has(id)) errors.push(`Resolved advisory must be removed from the allowlist: ${id}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { total: auditReport.metadata?.vulnerabilities?.total ?? 0, detectedAdvisories, allowedAdvisories };
}

function runDependencyAudit() {
  const allowlist = JSON.parse(readFileSync(resolve(projectRoot, 'security/audit-allowlist.json'), 'utf8'));
  validateAllowlist(allowlist);
  const isWindows = process.platform === 'win32';
  const auditResult = spawnSync(isWindows ? process.env.ComSpec ?? 'cmd.exe' : 'npm',
    isWindows ? ['/d', '/s', '/c', 'npm audit --json'] : ['audit', '--json'], {
      cwd: projectRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: false,
    });
  if (auditResult.error) throw auditResult.error;
  let auditReport;
  try {
    auditReport = JSON.parse(auditResult.stdout);
  } catch {
    throw new Error('npm audit did not return valid JSON.');
  }
  const { total, detectedAdvisories, allowedAdvisories } = checkAuditReport(allowlist, auditReport);
  console.log(`Dependency audit gate passed: ${total} vulnerability records map only to ${detectedAdvisories.size} temporary exceptions.`);
  for (const id of [...detectedAdvisories.keys()].sort()) {
    const entry = allowedAdvisories.get(id);
    console.log(`- ${id} (${entry.package}), reviewed ${entry.reviewedOn}, expires ${entry.expiresOn}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runDependencyAudit();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
