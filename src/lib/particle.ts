/**
 * 한글 조사를 앞말에 맞춘다.
 *
 * 방에 남는 안내 문구에 가게 이름이 들어가는데, `소노 으로` 처럼 어긋나면
 * 바로 눈에 띈다. 이름은 사용자·가게마다 달라서 문구를 고정해 둘 수 없다.
 */

/** 마지막 글자에 받침이 있는지. 한글이 아니면 null (판단하지 않는다) */
export function hasFinalConsonant(word: string): boolean | null {
  const last = [...word.trim()].pop();
  if (!last) return null;

  const code = last.charCodeAt(0);
  /* 가(0xAC00) ~ 힣(0xD7A3) 만 받침을 셀 수 있다 */
  if (code < 0xac00 || code > 0xd7a3) return null;

  return (code - 0xac00) % 28 !== 0;
}

/**
 * `으로` / `로`.
 *
 * 받침이 없으면 `로`, 있으면 `으로`다. 다만 ㄹ 받침은 `로` 를 쓴다 —
 * "서울로" 이지 "서울으로" 가 아니다.
 */
export function ro(word: string): string {
  const last = [...word.trim()].pop();
  if (!last) return '로';

  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '로';

  const jong = (code - 0xac00) % 28;
  /* 8 = ㄹ */
  return jong === 0 || jong === 8 ? '로' : '으로';
}

/** `은` / `는` */
export function eun(word: string): string {
  const final = hasFinalConsonant(word);
  return final ? '은' : '는';
}

/** `이` / `가` */
export function i(word: string): string {
  const final = hasFinalConsonant(word);
  return final ? '이' : '가';
}
