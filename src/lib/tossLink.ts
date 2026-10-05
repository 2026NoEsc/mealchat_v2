/**
 * 토스 송금 딥링크.
 *
 * 정산 요청을 받은 사람이 계좌번호를 눈으로 옮겨 적지 않고 바로 보낼 수 있게
 * 한다. 링크에는 은행·계좌·금액만 싣고, 실제 송금은 토스 앱에서 사용자가
 * 확인하고 누른다 — 앱이 대신 돈을 보내지 않는다.
 *
 * 주의: 이 스킴은 토스가 공개한 규격이 아니다. 알려진 형태를 쓰는 것이라
 * 토스가 바꾸면 조용히 깨진다. 그래서 링크가 열리지 않는 경우를 반드시
 * 다뤄야 하고 (openTossTransfer 가 false 를 준다), 화면에는 계좌번호를
 * 그대로 보여 주는 길을 늘 남겨 둔다.
 *
 * react-native 를 import 하지 않는다 — URL 조립은 네이티브 모듈 없이
 * 테스트할 수 있어야 한다. 실제로 여는 것은 openTossTransfer 가 맡는다.
 */

/**
 * 은행 코드. 토스가 받는 값은 표준 금융기관 코드다.
 * 프로필에는 은행 이름이 글자로 저장돼 있어서 코드로 옮겨야 한다.
 */
const BANK_CODES: Record<string, string> = {
  국민: '004',
  KB국민: '004',
  신한: '088',
  우리: '020',
  하나: '081',
  KEB하나: '081',
  농협: '011',
  NH농협: '011',
  기업: '003',
  IBK기업: '003',
  카카오뱅크: '090',
  케이뱅크: '089',
  토스뱅크: '092',
  새마을금고: '045',
  부산: '032',
  대구: '031',
  경남: '039',
  광주: '034',
  전북: '037',
  제주: '035',
  수협: '007',
  우체국: '071',
  신협: '048',
  SC제일: '023',
  씨티: '027',
};

/** "KB국민은행", "국민 은행" 처럼 적힌 이름에서 코드를 찾는다 */
export function bankCodeOf(bankName: string): string | null {
  const cleaned = bankName.replace(/은행|\s/g, '').trim();
  if (!cleaned) return null;

  if (BANK_CODES[cleaned]) return BANK_CODES[cleaned];

  /* "국민(KB)" 처럼 군더더기가 붙는 경우까지 살린다 */
  const hit = Object.keys(BANK_CODES).find((name) => cleaned.includes(name));
  return hit ? BANK_CODES[hit] : null;
}

export type TossTransfer = {
  bankName: string;
  accountNumber: string;
  /** 1인당 금액. 0 이면 금액 없이 계좌만 채운 채로 연다 */
  amount: number;
};

/**
 * 딥링크 주소. 은행을 알아볼 수 없거나 계좌가 비면 null —
 * 그때는 링크 대신 계좌번호를 보여 주는 쪽으로 가야 한다.
 */
export function tossTransferUrl({
  bankName,
  accountNumber,
  amount,
}: TossTransfer): string | null {
  const account = accountNumber.replace(/[^0-9]/g, '');
  if (!account) return null;

  const bankCode = bankCodeOf(bankName);
  if (!bankCode) return null;

  const params = [`bankCode=${bankCode}`, `accountNo=${account}`];
  /* 금액이 0 이면 붙이지 않는다 — 토스에서 직접 채우게 둔다 */
  if (amount > 0) params.push(`amount=${Math.floor(amount)}`);

  return `supertoss://send?${params.join('&')}`;
}
