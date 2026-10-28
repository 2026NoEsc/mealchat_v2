type VoteCountOption = {
  voters: readonly unknown[];
};

/**
 * 최다 득표를 고른다. 동률이면 전달받은 후보 배열의 앞선 항목을 유지한다.
 * 서버의 `confirm_room_vote`도 voting_items 배열 순서로 같은 규칙을 적용한다.
 */
export function pickLeadingVoteOption<T extends VoteCountOption>(options: readonly T[]): T | null {
  return options.reduce<T | null>(
    (best, option) => (best === null || option.voters.length > best.voters.length ? option : best),
    null,
  );
}

/** 서버 확정 규칙과 같은 strict majority. */
export function hasStrictVoteMajority(voteCount: number, memberCount: number): boolean {
  return memberCount > 0 && voteCount > memberCount / 2;
}
