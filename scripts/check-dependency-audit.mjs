import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const severityLevels = ['info', 'low', 'moderate', 'high', 'critical'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const auditNotPerformed = (reason) => new Error(`Dependency audit not performed: ${reason}`);

function validateAuditReport(report) {
  if (!isRecord(report) || Object.hasOwn(report, 'error')) {
    throw auditNotPerformed('npm audit failed or returned no report.');
  }
  const counts = report.metadata?.vulnerabilities;
  if (report.auditReportVersion !== 2 || !isRecord(report.vulnerabilities) || !isRecord(counts)
    || !Number.isSafeInteger(report.metadata?.dependencies?.total) || report.metadata.dependencies.total <= 0
    || ![...severityLevels, 'total'].every((level) => Number.isSafeInteger(counts[level]) && counts[level] >= 0)
    || severityLevels.reduce((total, level) => total + counts[level], 0) !== counts.total
    || Object.keys(report.vulnerabilities).length !== counts.total) {
    throw auditNotPerformed('npm audit returned missing or inconsistent report metadata.');
  }
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    if (!isRecord(vulnerability) || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0
      || vulnerability.via.some((cause) => typeof cause === 'string'
        ? !Object.hasOwn(report.vulnerabilities, cause) : !isRecord(cause))) {
      throw auditNotPerformed('npm audit returned malformed vulnerability records.');
    }
  }
}

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
  // Never interpret a missing/incomplete audit as evidence that an exception was resolved.
  validateAuditReport(auditReport);
  const allowedAdvisories = validateAllowlist(allowlist, today);
  const detectedAdvisories = new Map();
  const errors = [];
  for (const [packageName, vulnerability] of Object.entries(auditReport.vulnerabilities)) {
    for (const cause of vulnerability.via) {
      if (typeof cause === 'string') continue;
      const id = typeof cause.url === 'string' ? cause.url.match(/GHSA-[\w-]+/i)?.[0]?.toUpperCase() : undefined;
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
  return { total: auditReport.metadata.vulnerabilities.total, detectedAdvisories, allowedAdvisories };
}

function npmResultJson(result, phase, allowedStatuses) {
  if (!result || result.error || result.signal || !allowedStatuses.includes(result.status)) {
    throw auditNotPerformed(`npm ${phase} did not complete successfully.`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw auditNotPerformed(`npm ${phase} returned empty or invalid JSON.`);
  }
}

export function getAuditReport(run = spawnSync) {
  const isWindows = process.platform === 'win32';
  const npm = (args) => {
    try {
      return run(isWindows ? process.env.ComSpec ?? 'cmd.exe' : 'npm',
        isWindows ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args, {
          cwd: projectRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: false,
        });
    } catch {
      throw auditNotPerformed('npm could not be started.');
    }
  };
  // Read only this non-secret effective setting (including npmrc/env config).
  // npm's offline audit can exit 0 with an apparently clean report without querying the registry.
  const offline = npmResultJson(npm(['config', 'get', 'offline', '--json']), 'config', [0]);
  if (offline !== false) {
    throw auditNotPerformed(offline === true ? 'npm is configured offline.' : 'npm offline configuration is invalid.');
  }
  // Explicit audit=true also prevents audit=false configuration from skipping the registry query.
  const result = npm(['audit', '--json', '--audit=true', '--prefer-online']);
  // Exit 1 is normal when vulnerabilities were found; registry/transport errors still fail below.
  const report = npmResultJson(result, 'audit', [0, 1]);
  validateAuditReport(report);
  if (result.status === 1 && report.metadata.vulnerabilities.total === 0) {
    throw auditNotPerformed('npm audit failed without reporting vulnerabilities.');
  }
  return report;
}

function runDependencyAudit() {
  const allowlist = JSON.parse(readFileSync(resolve(projectRoot, 'security/audit-allowlist.json'), 'utf8'));
  validateAllowlist(allowlist);
  const auditReport = getAuditReport();
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
