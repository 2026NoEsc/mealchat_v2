export type BirthInput = { year: string; month: string; day: string };

/**
 * 세 칸으로 나뉜 생년월일 입력을 date 컬럼이 받는 문자열로 바꾼다.
 * 비었거나 실제로 없는 날짜(2월 31일 등)면 null 을 준다 — 저장하지 않는 편이
 * 틀린 날짜를 넣는 것보다 낫고, DB 의 CHECK 도 같은 범위를 다시 확인한다.
 *
 * supabase 클라이언트를 import 하지 않는다. 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */
export function toBirthDate(birth: BirthInput): string | null {
  const year = Number(birth.year.trim());
  const month = Number(birth.month.trim());
  const day = Number(birth.day.trim());

  if (![year, month, day].every(Number.isInteger)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // 2002-02-31 같은 값은 Date 가 다음 달로 넘겨 버리므로 되돌려 확인한다
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return iso;
}
