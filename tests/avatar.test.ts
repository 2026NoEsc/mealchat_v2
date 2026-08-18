import { avatarPath, avatarPathFromUrl, isSupportedAvatarType } from '../src/lib/avatarPath';

const UID = '11111111-1111-1111-1111-111111111111';

describe('avatarPath', () => {
  it('첫 칸이 uid 여야 Storage 정책을 통과한다', () => {
    expect(avatarPath(UID, 'image/png', 1700000000000)).toBe(`${UID}/1700000000000.png`);
  });

  it('MIME 에 맞는 확장자를 붙인다', () => {
    expect(avatarPath(UID, 'image/jpeg', 1)).toBe(`${UID}/1.jpg`);
    expect(avatarPath(UID, 'image/webp', 1)).toBe(`${UID}/1.webp`);
  });

  it('모르는 MIME 은 jpg 로 떨어뜨린다', () => {
    expect(avatarPath(UID, 'image/heic', 1)).toBe(`${UID}/1.jpg`);
  });

  it('올릴 때마다 경로가 달라진다', () => {
    // 같은 이름을 덮어쓰면 CDN·기기 캐시에 옛 사진이 남는다
    expect(avatarPath(UID, 'image/png', 1)).not.toBe(avatarPath(UID, 'image/png', 2));
  });
});

describe('isSupportedAvatarType', () => {
  it('버킷이 허용하는 형식만 통과시킨다', () => {
    expect(isSupportedAvatarType('image/png')).toBe(true);
    expect(isSupportedAvatarType('image/jpeg')).toBe(true);
    expect(isSupportedAvatarType('image/webp')).toBe(true);
  });

  it('그 밖은 거절한다', () => {
    expect(isSupportedAvatarType('image/heic')).toBe(false);
    expect(isSupportedAvatarType('application/pdf')).toBe(false);
    expect(isSupportedAvatarType(null)).toBe(false);
    expect(isSupportedAvatarType(undefined)).toBe(false);
  });
});

describe('avatarPathFromUrl', () => {
  const url = `https://x.supabase.co/storage/v1/object/public/avatars/${UID}/1700000000000.png`;

  it('공개 URL 에서 경로를 되찾는다', () => {
    expect(avatarPathFromUrl(url, UID)).toBe(`${UID}/1700000000000.png`);
  });

  it('쿼리스트링을 떼어 낸다', () => {
    expect(avatarPathFromUrl(`${url}?t=123`, UID)).toBe(`${UID}/1700000000000.png`);
  });

  it('남의 폴더면 건드리지 않는다', () => {
    // 삭제에 쓰이는 값이라, 남의 경로를 그대로 돌려주면 지우려 시도하게 된다
    const other = '22222222-2222-2222-2222-222222222222';
    expect(avatarPathFromUrl(url, other)).toBeNull();
  });

  it('아바타 URL 이 아니면 null', () => {
    expect(avatarPathFromUrl('https://example.com/photo.png', UID)).toBeNull();
    expect(avatarPathFromUrl(null, UID)).toBeNull();
  });
});
