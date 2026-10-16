import { hasStrictVoteMajority, pickLeadingVoteOption } from '../src/lib/votingLeader';

const option = (id: string, votes: number) => ({
  id,
  voters: Array.from({ length: votes }, () => ({})),
});

describe('pickLeadingVoteOption', () => {
  it('selects the only highest-vote option', () => {
    expect(pickLeadingVoteOption([option('first', 1), option('leader', 2)])?.id).toBe('leader');
  });

  it('keeps voting_items order when the vote count is tied', () => {
    expect(pickLeadingVoteOption([option('first', 2), option('second', 2)])?.id).toBe('first');
  });

  it('does not select a leader for an empty candidate list', () => {
    expect(pickLeadingVoteOption([])).toBeNull();
  });
});

describe('hasStrictVoteMajority', () => {
  it.each([
    [1, 1, true],
    [1, 2, false],
    [2, 2, true],
    [1, 3, false],
    [2, 3, true],
  ])('requires more than half of actual voting members: %i of %i', (votes, members, expected) => {
    expect(hasStrictVoteMajority(votes, members)).toBe(expected);
  });
});
