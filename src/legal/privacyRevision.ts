import { privacy } from './privacy';
import releaseArtifact from './privacy-release.generated.json';
import type { LegalDocument } from './terms';

// Release input (Korea calendar date): edit only this line, then regenerate legal hashes.
export const privacyRevisionReleaseDate: string | null = null;

export type PrivacyRevisionPublication = {
  announce: boolean; edition: number | null; effectiveDate: string | null;
  version: string | null; contentHash: string | null;
};
function parsedDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
/** Decision A: effective date = actual build release date + 7 calendar days (Asia/Seoul). */
export function resolvePrivacyRevisionPublication(releaseDate: string | null): PrivacyRevisionPublication {
  if (releaseDate === null) return { announce: false, edition: null, effectiveDate: null, version: null, contentHash: null };
  const date = parsedDate(releaseDate);
  if (!date) throw new Error('Privacy release date must be a valid YYYY-MM-DD date.');
  date.setUTCDate(date.getUTCDate() + 7);
  const effectiveDate = date.toISOString().slice(0, 10);
  const version = `privacy-${effectiveDate}-v2`;
  const generated = (releaseArtifact as { privacy: { version: string; content_hash: string } | null }).privacy;
  return { announce: true, edition: 2, effectiveDate, version, contentHash: generated?.version === version ? generated.content_hash : null };
}
/** All UI consumes this one source. Hash is generated, never manually copied into application code.
 * Published v1/hash stay immutable; an undated draft is not a published consent document.
 */
export const privacyRevisionPublication = resolvePrivacyRevisionPublication(privacyRevisionReleaseDate);

export function privacyNoticeDate(publication = privacyRevisionPublication): string | null {
  const match = publication.effectiveDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match && parsedDate(publication.effectiveDate!) ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : null;
}
export function shouldShowPrivacyNotice(mode: string, publication = privacyRevisionPublication): boolean {
  return mode === 'legacy' && publication.announce && privacyNoticeDate(publication) !== null;
}

export const privacyRevisionSummary = [
  '정산을 요청한 계좌는 정산이 끝날 때까지만 참여자에게 보여요. 프로필 계좌 공개는 별도 설정을 따라요.',
  '현재 같은 밥약에 참여 중인 메이트에게만 공개 설정을 적용해요. 친구 추가만으로는 보이지 않아요.',
  '건강정보는 동의한 날부터 1년 동안 이용하고, 만료 즉시 이용을 멈춘 뒤 하루 안에 지워요. 철회하면 즉시 지워요.',
  '마케팅 수신 동의는 2년마다 다시 확인해요. 현재 광고성 정보는 보내지 않아요.',
];

const replacements: Record<string, string[]> = {
  collection: privacy.sections[0].paragraphs.map(paragraph => paragraph.startsWith('[선택] 송금 계좌')
    ? '[선택] 송금 계좌 — 정산을 요청하면 그 정산이 끝날 때까지 정산 참여자에게 보여요. 프로필에서는 정보 공개 범위에서 켠 경우에만 같은 밥약 메이트에게 보여요.' : paragraph),
  retention: [
    '· 회원 정보: 탈퇴할 때까지 — 탈퇴하면 바로 지워요.',
    '· 알레르기 · 식단 정보: 동의한 날부터 1년 동안 이용해요. 1년이 지나면 바로 이용을 멈추고 하루 안에 지워요. 동의하지 않거나 동의를 거두면 즉시 지워요.',
    '· 광고성 정보 수신 동의: 동의한 날부터 2년마다 동의 여부를 다시 확인하고, 거두면 바로 보내지 않아요.',
    privacy.sections[1].paragraphs[3],
    '· 탈퇴한 회원: 다른 메이트의 밥약 기록 · 정산에서는 이름을 "탈퇴한 메이트"로 바꾸고 금액만 남겨요.',
    privacy.sections[1].paragraphs[5],
  ],
  visibility: ['지금 같은 밥약에 함께 참여 중인 메이트에게는 닉네임 · 프로필 사진과 정보 공개 범위에서 켜 둔 항목만 보여요. 친구 추가만으로는 보이지 않아요. 알레르기 · 식단 정보는 다른 회원에게 보이지 않아요.'],
  'third-party': ['운영자는 회원의 개인정보를 다른 회사에 팔거나 제공하지 않아요. 법령에 따른 요청이 있을 때만 예외로 해요.'],
  processors: privacy.sections[4].paragraphs.map(paragraph => paragraph.replace('정보를 보내지 않습니다.', '정보를 보내지 않아요.')),
  rights: ['회원은 언제든 앱의 프로필 · 설정에서 자기 정보를 보고, 고치고, 지우고, 동의를 거둘 수 있어요. 앱에서 할 수 없는 요청은 문의하기로 보내 주세요.'],
  deletion: ['보관 기간이 끝나거나 탈퇴하면 데이터베이스에서 지워요. 알레르기 · 식단 정보는 기간이 끝난 뒤 하루 안에 지워요. 백업에 남은 정보도 다음 백업 주기에 지워요.'],
  children: ['만 14세 미만은 가입할 수 없어요.'],
  changes: ['이 방침이 바뀌면 시행 7일 전부터 앱 안에 알려요.'],
};
export function privacyRevisionDocument(publication = privacyRevisionPublication) {
  const effectiveDate = privacyNoticeDate(publication);
  return {
    id: privacy.id, title: privacy.title,
    sections: privacy.sections.map(section => ({ ...section,
      paragraphs: section.id === 'changes' ? [...replacements.changes, `시행일: ${effectiveDate ?? '미정'}`]
        : [...(replacements[section.id] ?? section.paragraphs)],
    })),
  };
}

/** Canonical publication includes both metadata and the section 11 effective-date paragraph. */
export function finalizedPrivacyRevisionDocument(publication: PrivacyRevisionPublication): LegalDocument | null {
  const effectiveDate = privacyNoticeDate(publication);
  if (!effectiveDate || publication.edition === null || publication.version === null) return null;
  return { ...privacyRevisionDocument(publication), effectiveDate, edition: publication.edition };
}
