import {
  isSettled,
  pickActiveSettlement,
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

/* 최신순으로 들어온다고 본다 — fetchRoomSettlements 가 created_at desc 로 읽는다 */
const settlement = (name: string, members: [string | null, boolean][]) => ({
  name,
  members: members.map(([profileId, isCompleted]) => ({ profileId, isCompleted })),
});

describe('isSettled', () => {
  it('is true only when every member has sent', () => {
    expect(isSettled(settlement('a', [[ME, true], ['friend', true]]))).toBe(true);
    expect(isSettled(settlement('a', [[ME, true], ['friend', false]]))).toBe(false);
  });

  it('never calls an empty member list settled', () => {
    expect(isSettled(settlement('a', []))).toBe(false);
  });
});

describe('pickActiveSettlement', () => {
  it('returns null for a room with no settlement', () => {
    expect(pickActiveSettlement([], ME)).toBeNull();
  });

  /*
   * 예전에는 최신 한 건만 읽어서, 끝난 정산이 더 최근이면 아직 안 낸 정산에
   * 갈 방법이 없었다. 홈은 "진행 중" 이라고 세는데 눌러 들어가면 끝난 것이 보였다.
   */
  it('prefers the settlement I still owe over a newer finished one', () => {
    const newestDone = settlement('done', [[ME, true]]);
    const olderMine = settlement('mine', [[ME, false], ['friend', true]]);

    expect(pickActiveSettlement([newestDone, olderMine], ME)?.name).toBe('mine');
  });

  it('falls back to one somebody else still owes', () => {
    const newestDone = settlement('done', [[ME, true]]);
    const waitingOnFriend = settlement('friend', [[ME, true], ['friend', false]]);

    expect(pickActiveSettlement([newestDone, waitingOnFriend], ME)?.name).toBe('friend');
  });

  it('treats a settlement with no members as unfinished so it stays reachable', () => {
    const newestDone = settlement('done', [[ME, true]]);
    const unknown = settlement('unknown', []);

    expect(pickActiveSettlement([newestDone, unknown], ME)?.name).toBe('unknown');
  });

  it('shows the newest when everything is finished', () => {
    const newest = settlement('newest', [[ME, true]]);
    const older = settlement('older', [[ME, true]]);

    expect(pickActiveSettlement([newest, older], ME)?.name).toBe('newest');
  });

  it('keeps the incoming order within the same priority', () => {
    const newerOpen = settlement('newer', [[ME, false]]);
    const olderOpen = settlement('older', [[ME, false]]);

    expect(pickActiveSettlement([newerOpen, olderOpen], ME)?.name).toBe('newer');
  });

  it('does not claim a signed-out viewer owes anything', () => {
    const waiting = settlement('waiting', [[null, false]]);
    const done = settlement('done', [[ME, true]]);

    /* 내 것이 아니라 "누군가 안 냈다" 쪽으로 걸려야 한다 */
    expect(pickActiveSettlement([done, waiting], null)?.name).toBe('waiting');
  });
});
