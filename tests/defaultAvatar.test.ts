import { characterIndexOf } from '../src/lib/defaultAvatar';

describe('characterIndexOf', () => {
  it('같은 사람은 늘 같은 캐릭터를 받는다', () => {
    const seed = '3ddf314d-27a5-49ce-b703-4f4fd209e69f';
    expect(characterIndexOf(seed, 4)).toBe(characterIndexOf(seed, 4));
  });

  it('범위를 벗어나지 않는다', () => {
    for (const seed of ['', 'a', '밀챗', '3ddf314d-27a5-49ce', 'x'.repeat(200)]) {
      const index = characterIndexOf(seed, 4);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
    }
  });

  it('여러 사람이면 네 캐릭터가 두루 나온다', () => {
    const seeds = Array.from({ length: 200 }, (_, i) => `user-${i}`);
    const used = new Set(seeds.map((seed) => characterIndexOf(seed, 4)));
    expect(used.size).toBe(4);
  });

  it('목록이 비면 0 을 준다 — 쓰는 쪽이 터지지 않게', () => {
    expect(characterIndexOf('아무개', 0)).toBe(0);
  });
});
