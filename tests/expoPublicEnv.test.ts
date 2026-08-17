import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/*
 * babel-preset-expo 는 `process.env.EXPO_PUBLIC_X` 같은 정적 접근만 번들에 인라인하고,
 * Metro 는 개발 모드에서만 런타임 `process.env` 를 채운다. 따라서 객체째로 넘기거나
 * 동적으로 읽으면 개발 서버에서는 멀쩡하고 릴리스 빌드에서만 undefined 가 된다.
 * 이 회귀는 스토어 빌드에서야 드러나므로 소스 레벨에서 막는다.
 */

const SRC = join(__dirname, '..', 'src');

function sourceFiles() {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.tsx?$/.test(entry))
    .map((entry) => join(SRC, entry));
}

/** 주석 제거 — 설명문에 등장하는 process.env 는 검사 대상이 아니다 */
function withoutComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

describe('환경 변수 접근 형태', () => {
  it('릴리스 빌드에서 인라인되는 정적 EXPO_PUBLIC_ 접근만 사용한다', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const code = withoutComments(readFileSync(file, 'utf8'));
      const pattern = /process\.env\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([^'"]+)['"]\s*\])?/g;

      for (const match of code.matchAll(pattern)) {
        const key = match[1] ?? match[2];
        if (!key?.startsWith('EXPO_PUBLIC_')) {
          offenders.push(`${file}: ${match[0].trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
