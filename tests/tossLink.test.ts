import { bankCodeOf, tossTransferUrl } from '../src/lib/tossLink';

describe('bankCodeOf', () => {
  it('"은행" 과 공백을 떼고 찾는다', () => {
    expect(bankCodeOf('국민은행')).toBe('004');
    expect(bankCodeOf('KB국민 은행')).toBe('004');
    expect(bankCodeOf('카카오뱅크')).toBe('090');
  });

  it('군더더기가 붙어도 알아본다', () => {
    expect(bankCodeOf('신한(SOL)')).toBe('088');
  });

  it('모르는 은행은 null — 링크 대신 계좌를 보여 줘야 한다', () => {
    expect(bankCodeOf('없는은행')).toBeNull();
    expect(bankCodeOf('')).toBeNull();
    expect(bankCodeOf('   ')).toBeNull();
  });
});

describe('tossTransferUrl', () => {
  it('은행 코드와 계좌, 금액을 싣는다', () => {
    expect(
      tossTransferUrl({ bankName: '국민은행', accountNumber: '123456-78-901234', amount: 12000 }),
    ).toBe('supertoss://send?bankCode=004&accountNo=12345678901234&amount=12000');
  });

  it('금액이 0 이면 붙이지 않는다 — 토스에서 채우게 둔다', () => {
    expect(tossTransferUrl({ bankName: '토스뱅크', accountNumber: '1000-1234', amount: 0 })).toBe(
      'supertoss://send?bankCode=092&accountNo=10001234',
    );
  });

  it('원 단위 아래는 버린다', () => {
    expect(
      tossTransferUrl({ bankName: '우리', accountNumber: '1002', amount: 3333.7 }),
    ).toContain('amount=3333');
  });

  it('은행을 모르거나 계좌가 비면 null', () => {
    expect(tossTransferUrl({ bankName: '없는은행', accountNumber: '123', amount: 1 })).toBeNull();
    expect(tossTransferUrl({ bankName: '국민', accountNumber: '', amount: 1 })).toBeNull();
    expect(tossTransferUrl({ bankName: '국민', accountNumber: '---', amount: 1 })).toBeNull();
  });
});
