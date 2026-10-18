import type { LegalDocument } from './terms';

/** S1 선택 동의 문서안. 필수 개인정보 처리방침과 별도로 표시한다. */
export const healthConsent: LegalDocument = {
  id: 'health', title: '건강 관련 정보 수집·이용 동의', effectiveDate: '2026년 10월 17일', edition: 1,
  sections: [
    { id: 'items', title: '수집 항목과 이용 목적', paragraphs: ['알레르기와 식단 제한 정보를 수집하며, 메뉴 추천에서 맞지 않는 메뉴를 제외하는 데만 사용합니다. 다른 회원에게 공개하지 않습니다.'] },
    { id: 'choice', title: '선택 동의', paragraphs: ['동의하지 않아도 회원가입과 기본 서비스를 이용할 수 있습니다. 건강정보 입력과 이를 이용한 메뉴 제외 기능은 유효한 별도 동의가 있을 때만 사용할 수 있습니다.'] },
    { id: 'retention', title: '이용·보관 기간', paragraphs: ['동의한 시각부터 달력 기준 1년 동안 이용합니다. 만료 시각부터 조회·저장·추천 사용을 즉시 차단하고, 만료된 데이터는 하루 1회 배치에서 삭제합니다. 계속 이용하려면 다시 동의하고 필요한 정보를 새로 입력해야 합니다.'] },
    { id: 'withdrawal', title: '동의 철회', paragraphs: ['설정의 선택 동의에서 언제든 철회할 수 있습니다. 거절하거나 철회하면 상태 변경과 건강정보 삭제를 함께 처리하며, 이후 건강정보를 이용하지 않습니다. 만료 후 다시 동의해도 이전 건강정보를 복구하지 않습니다.'] },
  ],
};
