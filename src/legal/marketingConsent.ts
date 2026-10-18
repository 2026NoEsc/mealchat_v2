import type { LegalDocument } from './terms';

/** S1 선택 동의 문서안. 광고 발송 활성화에 대한 승인이 아니다. */
export const marketingConsent: LegalDocument = {
  id: 'marketing', title: '마케팅 정보 수신 동의', effectiveDate: '2026년 10월 17일', edition: 1,
  sections: [
    { id: 'choice', title: '선택 동의', paragraphs: ['마케팅 정보 수신은 선택 사항이며, 동의하지 않아도 회원가입과 기본 서비스를 이용할 수 있습니다.'] },
    { id: 'status', title: '기록과 재확인', paragraphs: ['동의 상태와 동의한 시각, 다음 재확인 시점을 기록합니다. 동의한 시각부터 달력 기준 2년마다 동의 여부를 다시 확인합니다. 앱 접속이나 설정 조회만으로 동의 시각과 다음 재확인 시점을 연장하지 않습니다.'] },
    { id: 'sending', title: '현재 발송 여부', paragraphs: ['안내 수단이 마련될 때까지 광고성 발송은 전부 비활성입니다. 현재는 동의 상태를 기록해도 광고성 정보를 발송하지 않습니다.'] },
    { id: 'withdrawal', title: '동의 철회', paragraphs: ['설정의 선택 동의에서 언제든 철회할 수 있습니다. 철회 후에는 광고성 정보를 보내지 않습니다.'] },
  ],
};
