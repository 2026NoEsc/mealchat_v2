export type BirthInput = { year: string; month: string; day: string };

export type BirthField = keyof BirthInput;

/** 칸마다 받는 자릿수 — 2003 / 10 / 29 */
export const BIRTH_LENGTH: Record<BirthField, number> = { year: 4, month: 2, day: 2 };

/**
 * 생년월일 칸에 들어온 글자를 다듬는다.
 *
 * 숫자만 남기고 칸에 맞는 자릿수까지만 받는다. 키보드를 숫자판으로 띄워도 붙여넣기나
 * 외장 키보드로는 글자가 들어오고, 자릿수를 막지 않으면 `20031` 같은 값이 그대로
 * 저장 단계까지 간다.
 */
export function formatBirthInput(field: BirthField, text: string): string {
  return text.replace(/\D/g, '').slice(0, BIRTH_LENGTH[field]);
}

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

/** date 컬럼 값을 세 칸 입력으로 되돌린다. 값이 없으면 빈 칸을 준다. */
export function fromBirthDate(value: string | null | undefined): BirthInput {
  const empty = { year: '', month: '', day: '' };
  if (!value) return empty;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return empty;

  // 앞의 0 은 입력 칸에서 지운다 (03 월 -> 3)
  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}
