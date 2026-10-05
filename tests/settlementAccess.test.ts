import { canEditSettlement, settlementMutationErrorMessage } from '../src/lib/settlementAccess';

describe('settlement edit access', () => {
  it('lets a room member start a settlement only when there is no active bill', () => {
    expect(canEditSettlement(null, 'member-a')).toBe(true);
  });

  it('does not expose the edit action to a non-creator', () => {
    expect(canEditSettlement({ creatorId: 'creator-a' }, 'member-b')).toBe(false);
    expect(canEditSettlement({ creatorId: 'creator-a' }, 'creator-a')).toBe(true);
  });

  it('maps authorization failures to a clear edit message', () => {
    const error = Object.assign(new Error('permission denied'), { code: '42501' });
    expect(settlementMutationErrorMessage(error)).toBe('정산 내용은 만든 사람만 수정할 수 있어요.');
  });
});
