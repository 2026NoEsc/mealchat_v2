jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { addFriend, searchProfilesByTag } from '../src/lib/friends';
import { supabase } from '../src/lib/supabase';

const mockFrom = supabase.from as jest.Mock;

function searchQuery(data: unknown[]) {
  const query = {
    select: jest.fn(),
    ilike: jest.fn(),
    neq: jest.fn(),
    returns: jest.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  mockFrom.mockReturnValue(query);
  return query;
}

describe('유저 코드로 친구 추가', () => {
  beforeEach(() => mockFrom.mockReset());

  it('프로필에 표시된 @ 코드를 정확한 태그로 검색한다', async () => {
    const person = { id: 'friend-id', name: '친구', tag: 'user-abcdef12', avatar_color: '#fff' };
    const query = searchQuery([person]);

    await expect(searchProfilesByTag(' @user-abcdef12 ', 'my-id')).resolves.toEqual({
      data: [person], error: null,
    });
    expect(mockFrom).toHaveBeenCalledWith('public_profiles');
    expect(query.ilike).toHaveBeenCalledWith('tag', 'user-abcdef12');
    expect(query.neq).toHaveBeenCalledWith('id', 'my-id');
  });

  it('찾은 사람을 mate 관계로 추가하고 자기 자신은 거부한다', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });

    await expect(addFriend('my-id', 'friend-id')).resolves.toBeNull();
    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(insert).toHaveBeenCalledWith({
      follower_id: 'my-id', following_id: 'friend-id', role: 'mate',
    });

    mockFrom.mockClear();
    await expect(addFriend('my-id', 'my-id')).resolves.toBeInstanceOf(Error);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
