import {
  toSettlementSummary,
  type SettlementBillRow,
  type SettlementMemberRow,
} from '../src/lib/settlementSummary';

const ME = 'me-uuid';

const bill = (members: SettlementMemberRow[] | null): SettlementBillRow => ({
  id: 'bill-1',
  room_id: 'room-1',
  title: '식사 정산',
  total_amount: 48000,
  dutch_pay_members: members,
});

describe('toSettlementSummary', () => {
  it('counts everyone who has not sent yet', () => {
    const summary = toSettlementSummary(
      bill([
        { profile_id: 'owner', is_completed: true },
        { profile_id: ME, is_completed: false },
        { profile_id: 'friend', is_completed: false },
      ]),
      ME,
    );

    expect(summary.pendingCount).toBe(2);
    expect(summary.settled).toBe(false);
  });

  it('flags the settlement when my own share is still open', () => {
    const members: SettlementMemberRow[] = [
      { profile_id: 'owner', is_completed: true },
      { profile_id: ME, is_completed: false },
    ];

    expect(toSettlementSummary(bill(members), ME).waitingOnMe).toBe(true);
  });

  it('does not flag me once I have sent', () => {
    const members: SettlementMemberRow[] = [
      { profile_id: ME, is_completed: true },
      { profile_id: 'friend', is_completed: false },
    ];

    const summary = toSettlementSummary(bill(members), ME);

    expect(summary.waitingOnMe).toBe(false);
    expect(summary.pendingCount).toBe(1);
  });

  it('does not flag me when I am not on the list at all', () => {
    const members: SettlementMemberRow[] = [{ profile_id: 'friend', is_completed: false }];

    expect(toSettlementSummary(bill(members), ME).waitingOnMe).toBe(false);
    expect(toSettlementSummary(bill(members), null).waitingOnMe).toBe(false);
  });

  it('marks the settlement done only when every member has sent', () => {
    const members: SettlementMemberRow[] = [
      { profile_id: 'owner', is_completed: true },
      { profile_id: ME, is_completed: true },
    ];

    const summary = toSettlementSummary(bill(members), ME);

    expect(summary.settled).toBe(true);
    expect(summary.pendingCount).toBe(0);
  });

  /*
   * 정책에 막혔거나 RPC 이전에 만들어진 정산은 명단이 비어서 온다.
   * 이걸 완료로 처리하면 홈 화면에서 정산이 조용히 사라진다.
   */
  it('never calls an unreadable member list settled', () => {
    expect(toSettlementSummary(bill([]), ME).settled).toBe(false);
    expect(toSettlementSummary(bill(null), ME).settled).toBe(false);
    expect(toSettlementSummary(bill(null), ME).pendingCount).toBe(0);
  });

  it('carries the bill fields through', () => {
    const summary = toSettlementSummary(bill([]), ME);

    expect(summary).toMatchObject({
      id: 'bill-1',
      roomId: 'room-1',
      title: '식사 정산',
      totalAmount: 48000,
    });
  });
});
