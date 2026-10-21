import type { LegalDocument } from './terms';

const normalize = (value: string) => value.replace(/\r\n?/g, '\n').normalize('NFC');

/** S1 4.2: order and whitespace are part of the document identity. No trim/sort. */
export function canonicalLegalDocument(document: LegalDocument): string {
  return JSON.stringify({
    id: normalize(document.id), title: normalize(document.title),
    effectiveDate: normalize(document.effectiveDate), edition: document.edition,
    sections: document.sections.map(section => ({
      id: normalize(section.id), title: normalize(section.title), paragraphs: section.paragraphs.map(normalize),
    })),
  }) + '\n';
}

export function parseLegalDocument(canonical: string): LegalDocument {
  const bytes = Array.from(canonical).reduce((sum, character) => {
    const code = character.codePointAt(0)!;
    return sum + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
  }, 0);
  if (bytes > 128 * 1024) throw new Error('Invalid legal document.');
  const value = JSON.parse(canonical) as LegalDocument;
  if (!value || ![value.id, value.title, value.effectiveDate].every(item => typeof item === 'string' && item.length > 0)
    || !Number.isInteger(value.edition) || value.edition < 1 || !Array.isArray(value.sections) || !value.sections.length
    || value.sections.some(section => !section || typeof section.id !== 'string' || typeof section.title !== 'string'
      || !Array.isArray(section.paragraphs) || section.paragraphs.some((paragraph: unknown) => typeof paragraph !== 'string'))) {
    throw new Error('Invalid legal document.');
  }
  if (canonicalLegalDocument(value) !== canonical) throw new Error('Non-canonical legal document.');
  return value;
}
