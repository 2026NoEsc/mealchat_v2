import { settlementCompletionRpcInput } from '../src/lib/settlementCompletionContract';

describe('settlement completion RPC contract', () => {
  it('uses the narrow RPC and its stable PostgREST argument names', () => {
    expect(settlementCompletionRpcInput('member-42', true)).toEqual({
      functionName: 'set_settlement_completed',
      args: { target_member: 'member-42', completed: true },
    });
  });

  it('preserves an explicit false completion state', () => {
    expect(settlementCompletionRpcInput('member-42', false).args).toEqual({
      target_member: 'member-42',
      completed: false,
    });
  });
});
