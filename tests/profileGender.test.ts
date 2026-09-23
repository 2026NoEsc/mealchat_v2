jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { saveMyGender } from '../src/lib/profile';
import { supabase } from '../src/lib/supabase';

const mockFrom = supabase.from as jest.Mock;

describe('프로필 성별 저장', () => {
  beforeEach(() => mockFrom.mockReset());

  it('최신 데이터를 읽고 다른 키를 유지하며 성별을 저장한다', async () => {
    const read = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    read.select.mockReturnValue(read);
    read.eq.mockReturnValue(read);
    read.single.mockResolvedValue({ data: { personal_data: { custom: 'kept', gender: 'male' }, updated_at: '2026-09-24T00:00:00Z' }, error: null });
    const write = { update: jest.fn(), eq: jest.fn(), select: jest.fn(), maybeSingle: jest.fn() };
    write.update.mockReturnValue(write);
    write.eq.mockReturnValue(write);
    write.select.mockReturnValue(write);
    write.maybeSingle.mockResolvedValue({ data: { id: 'my-id' }, error: null });
    mockFrom.mockReturnValueOnce(read).mockReturnValueOnce(write);

    await expect(saveMyGender('my-id', 'female', 'male')).resolves.toBeNull();
    expect(mockFrom).toHaveBeenCalledWith('profile_private');
    expect(write.update).toHaveBeenCalledWith({ personal_data: { custom: 'kept', gender: 'female' } });
    expect(write.eq).toHaveBeenCalledWith('updated_at', '2026-09-24T00:00:00Z');
  });

  it('읽은 뒤 다른 기기에서 바뀌었으면 저장 실패를 알린다', async () => {
    const read = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    read.select.mockReturnValue(read);
    read.eq.mockReturnValue(read);
    read.single.mockResolvedValue({ data: { personal_data: { gender: 'male' }, updated_at: '2026-09-24T00:00:00Z' }, error: null });
    const write = { update: jest.fn(), eq: jest.fn(), select: jest.fn(), maybeSingle: jest.fn() };
    write.update.mockReturnValue(write);
    write.eq.mockReturnValue(write);
    write.select.mockReturnValue(write);
    write.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValueOnce(read).mockReturnValueOnce(write);

    await expect(saveMyGender('my-id', 'female', 'male')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining('다른 곳에서 프로필이 변경됐어요') }),
    );
  });

  it('폼을 연 뒤 성별 자체가 바뀌었으면 덮어쓰지 않는다', async () => {
    const read = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    read.select.mockReturnValue(read);
    read.eq.mockReturnValue(read);
    read.single.mockResolvedValue({ data: { personal_data: { gender: 'female' }, updated_at: '2026-09-24T00:00:00Z' }, error: null });
    mockFrom.mockReturnValue(read);

    await expect(saveMyGender('my-id', 'none', 'male')).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining('다른 곳에서 성별이 변경됐어요') }),
    );
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
