import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalLegalDocument, parseLegalDocument } from '../src/legal/canonical';
import { privacy } from '../src/legal/privacy';
import { finalizedPrivacyRevisionDocument, privacyRevisionPublication, privacyRevisionReleaseDate, resolvePrivacyRevisionPublication } from '../src/legal/privacyRevision';
import existing from '../src/legal/documents.generated.json';
import release from '../src/legal/privacy-release.generated.json';

function artifact(releaseDate: string | null) {
  const code = `import {buildPrivacyReleaseArtifact} from './scripts/generate-legal-hashes.mjs'; process.stdout.write(JSON.stringify(buildPrivacyReleaseArtifact(${JSON.stringify(releaseDate)})));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }));
}
it('keeps undated publication metadata and M7 artifact unfinalized', () => {
  const undated = resolvePrivacyRevisionPublication(null);
  expect(undated).toEqual({ announce: false, edition: null, effectiveDate: null, version: null, contentHash: null });
  expect(finalizedPrivacyRevisionDocument(undated)).toBeNull();
  expect(artifact(null)).toEqual({ release: null, privacy: null });
});
it('matches the one release input to the generated artifact and exported publication hash', () => {
  const generated = artifact(privacyRevisionReleaseDate);
  expect(release).toEqual(generated);
  expect(privacyRevisionPublication.contentHash).toBe(generated.privacy?.content_hash ?? null);
});
it.each([
  ['2026-10-17', '2026-10-24'], ['2026-12-28', '2027-01-04'], ['2028-02-23', '2028-03-01'],
])('derives edition, version and +7 calendar-day effective date from release %s', (date, effectiveDate) => {
  expect(resolvePrivacyRevisionPublication(date)).toMatchObject({ announce: true, edition: 2, effectiveDate, version: `privacy-${effectiveDate}-v2` });
});
it.each(['2026-02-29', '2026-13-01', '2026-11-31', 'not-a-date'])('rejects invalid release date %s', date => {
  expect(() => resolvePrivacyRevisionPublication(date)).toThrow('valid YYYY-MM-DD');
});
it('produces canonical M7 fields without touching current artifacts when imported', () => {
  const before = readFileSync('src/legal/privacy-release.generated.json', 'utf8');
  const generated = artifact('2026-10-17');
  expect(generated.release).toMatchObject({ release_date: '2026-10-17', effective_date: '2026-10-24', effective_from: '2026-10-23T15:00:00.000Z', bundle_version: 'mealchat-2026-10-24-r2' });
  expect(generated.privacy).toMatchObject({ edition: 2, version: 'privacy-2026-10-24-v2' });
  const document = parseLegalDocument(generated.privacy.canonical_content);
  expect(document.edition).toBe(2); expect(document.effectiveDate).toBe('2026년 10월 24일');
  expect(document.sections).toHaveLength(11);
  expect(createHash('sha256').update(generated.privacy.canonical_content, 'utf8').digest('hex')).toBe(generated.privacy.content_hash);
  expect(readFileSync('src/legal/privacy-release.generated.json', 'utf8')).toBe(before);
  expect(Object.keys(existing)).toEqual(['service', 'privacy', 'health', 'marketing']);
  expect(existing.privacy.version).toBe('privacy-2026-10-01-v1');
});
it('includes section 11 effective-date text in the hash even when top-level metadata stays identical', () => {
  const publication = resolvePrivacyRevisionPublication('2026-10-17');
  const document = finalizedPrivacyRevisionDocument(publication)!;
  const hash = (value: typeof document) => createHash('sha256').update(canonicalLegalDocument(value), 'utf8').digest('hex');
  expect(document.sections[10].paragraphs).toContain('시행일: 2026년 10월 24일');
  const changed = { ...document, sections: document.sections.map(section => section.id === 'changes'
    ? { ...section, paragraphs: section.paragraphs.map(text => text.startsWith('시행일:') ? '시행일: 2026년 10월 25일' : text) } : section) };
  expect(changed.effectiveDate).toBe(document.effectiveDate);
  expect(hash(changed)).not.toBe(hash(document));
  expect(createHash('sha256').update(canonicalLegalDocument(privacy), 'utf8').digest('hex')).toBe(existing.privacy.content_hash);
});
it('checks both generated artifacts without writing', () => {
  const output = execFileSync(process.execPath, ['scripts/generate-legal-hashes.mjs', '--check'], { encoding: 'utf8' });
  expect(output).toContain(privacyRevisionPublication.version ?? 'release date pending');
});
