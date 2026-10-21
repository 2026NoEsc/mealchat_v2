# 2026-10-05 braces 신규 보안 권고 대응

## 실패 원인과 범위

GitHub PR 검사 로그에서 테스트 357개·타입·린트·Expo 정합성은 통과했으나 마지막 감사가 `GHSA-VFJ7-8CJW-P6XM`으로 실패했다. 메인도 로컬에서 같은 감사 실패를 재현했다.

[공식 권고](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)는 `braces <=3.0.3`의 깊게 중첩된 패턴에 대한 AST 순회가 스택을 고갈시킬 수 있다고 설명한다. 2026-10-05 레지스트리 조회에서 최신 버전은 3.0.3이며, 공식 권고에 수정 버전이 없다. 같은 버전 범위의 업데이트로 해결되지 않으며 자체 암호·파서 패치를 만들지 않았다.

현재 기준 커밋은 `6574202`다(기존 `d2f6434`의 메시지만 한국어로 변경). 이전 안정성 커밋 `3041d74` 이후 별도 RPC 작업이 포함돼 있지만 이번 변경에서는 수정하지 않는다. 변경 대상은 감사 예외 파일·의존성 경계 테스트·이 기록뿐이다. 의존성과 잠금 파일, 감사 스크립트 및 quality 명령은 유지한다.

## 사용 경로와 기한부 위험 수용

잠금 파일에 선언된 `braces` 소비자는 `micromatch@4.0.8` 한 개다. `micromatch` 소비자는 다음 여섯 Node 도구로 제한된다. 일부는 lock에서 prod 의존성으로 분류되므로 dev-only라는 의미는 아니다.

- `@jest/core`, `@jest/transform`, `jest-config`, `jest-haste-map`, `jest-message-util`: 29.7.0.
- `metro-file-map`: 0.83.8.

현재 소비 코드에서 사용하는 매칭 경로는 `micromatch` 기본 함수·`some`·`isMatch`·`any`이며 `picomatch`로 위임한다. 메인이 확인한 근거는 다음과 같다.

- `node_modules/micromatch/index.js:49,128,268`: 매칭은 picomatch 호출.
- 같은 파일 424,451,463줄: `parse`, `braces`, `braceExpand`는 취약한 braces 실행으로 이어지는 별도 API.
- `node_modules/metro-file-map/src/watchers/common.js:25,27`: 파일 경로를 입력 문자열로, watcher의 glob 설정을 매칭 패턴으로 전달하는 `some` 호출.
- Jest 소비 코드: `@jest/core/build/SearchSource.js:358`, `@jest/transform/build/shouldInstrument.js:107`, `jest-config/build/normalize.js:1140`, `jest-haste-map/build/watchers/common.js:61`, `jest-message-util/build/index.js:318`.
- 앱 `src/`, `App.tsx`, `index.js` 검색에서 braces·micromatch·picomatch 직접 import는 발견되지 않았다. 정적 검색은 동적·간접 사용의 완전한 부재 증명은 아니다.

독립 리뷰가 `resolve-workspace-root@2.0.1`의 ncc 번들 안에 추가 braces 사본을 발견했다. 이 사본의 정확한 braces 버전 메타데이터는 없어 UNKNOWN으로 남긴다. 메인은 `resolveWorkspaceRoot/Async` → 상위 로컬 `package.json`의 workspaces 또는 `pnpm-workspace.yaml` → `pathMatchesWorkspaceGlobs` → 번들된 micromatch 기본 매칭 함수 → picomatch 경로를 확인했다. 앱 API 입력을 받는 경로가 아니라 로컬 설정을 읽는 경로다. 이 번들 사본은 감사 DB와 lock의 명시적 소비자 검사만으로 포착되지 않으므로 별도 보호 검사를 추가했다.

권고 하나에 **2026-10-09 UTC 만료 예외**를 추가했다. 한국 시간 만료는 **2026-10-09 09:00 KST**다. 기존 node-forge 예외와 만료일은 변경하지 않는다. 이는 패키지 취약점을 제거한 것이 아니라, 현재 확인한 호출 경로에 한정한 임시 위험 수용이다. 새 앱·플러그인·빌드 스크립트가 취약 API를 사용하거나 개발 도구 버전이 바뀌면 재검토해야 한다. 기한은 자동 연장하지 않는다.

## 보호 테스트

`tests/dependencyTooling.test.js`에 다섯 검사를 추가했다.

1. 예외 기한과 braces/micromatch의 검토 버전, 설치 경로 한 벌을 확인한다.
2. 소비 패키지·버전 및 직접 의존성 확대를 차단한다.
3. 앱 소스·루트 설정 파일·빌드 스크립트에서 glob 패키지 직접 import를 차단한다.
4. 별도 Node 프로세스에서 braces 내보내기를 호출하면 실패하는 Proxy로 대체한다. 실제 `nocase/windows/dot` 옵션으로 정상 glob 및 Metro `includedByGlob` 매칭이 braces 호출 0회로 성공하고, `braceExpand`를 호출한 대조군은 차단되는 것을 확인한다.
5. resolve-workspace-root 번들의 버전·SHA256·단일 설치와 소비자인 `@expo/config@12.0.14`, `@expo/package-manager@1.13.1`을 고정해 변경 시 재검토한다. 디스크 파일을 변경하지 않고 별도 VM 안에서 번들된 braces 모듈을 차단한다. 가상 로컬 workspaces 글롭을 읽는 동기·비동기 탐색이 성공하고, 불일치 경로는 null인지 확인한다. 계측 모듈 로드 1회·매칭 호출 0회·직접 실행 대조군의 차단 1회를 단언한다. 외부 micromatch가 해석한 picomatch 2.3.2 버전도 고정한다.

이 테스트는 조사한 호출 경로의 회귀 검증이다. 개발 도구의 모든 입력·확장·동적 import를 검증했다고 주장하지 않는다.

import 검사는 따옴표·백틱 문자열을 다루지만 동적으로 조합한 패키지 이름이나 임의 플러그인을 완전히 차단하지 않는다. 또한 lock에 선언되지 않은 새 require를 설치 트리 전체에서 자동 검출하는 검사는 포함하지 않는다. 별도 빌드 확장이나 패키지 추가 시 재검토가 필요하다.

## 검증 및 독립 리뷰

- 추가 검사와 기존 의존성 테스트 15개 통과.
- 감사 게이트: 종료 코드 0. 취약점 기록 44건은 **braces·node-forge 두 권고의 전파**이며, 예외 2개로 처리했다. 취약점 0건이 아니다.
- 최종 `npm run quality`: 종료 코드 0. **41개 모음·364개 테스트**, 타입·린트·에셋·Expo 정합성 및 감사 게이트 통과. 검토 후 계측·단일 설치·picomatch 가드 보완까지 반영한 상태로 다시 실행했다.
- 독립 리뷰: Paseo **Claude Opus 설계·심층 리뷰** 프로필이 최종 감사·테스트 diff를 확인하고, focused 테스트 15/15 통과를 직접 재현했다. 차단 결함 없음으로 수용했으며, 조건인 전체 quality 성공을 메인이 확인했다. 리뷰어는 승인된 의존성·감사·테스트 파일과 공개 패키지 코드만 검토했다. 앱 소스·설정·감사 스크립트 원문과 번들 모듈 정체는 메인의 직접 확인 및 기능 시험에 근거하며, 리뷰어가 해당 원문까지 검토했다고 주장하지 않는다.
- `git diff --check` 통과. `package.json`, `package-lock.json`, 감사 스크립트는 변경되지 않았으며 기존 `node-forge` 예외도 그대로다.
- 실제 감사 스크립트에 별도 프로세스의 Date만 `2026-10-09T00:00:00Z`로 고정해 실행했다. `Expired audit exceptions: GHSA-86W9-CPQP-85RV (2026-10-09), GHSA-VFJ7-8CJW-P6XM (2026-10-09)`와 종료 코드 1을 확인했다. 시스템 시간·감사 스크립트는 변경하지 않았다.
- 사용자가 이 세 파일의 Develop 커밋·푸시를 승인했다. 원격 CI 결과는 푸시 이후 해당 커밋의 체크로 확인하며, 기존 커밋의 실패 기록은 유지된다. 배포나 PR 병합은 이번 범위에 포함하지 않는다.

첫 리뷰 요청은 승인 범위 밖 Jest·Metro 설정 및 앱 소스 접근 때문에 자동 승인 검토가 거부했다. 이후 기존 사용자가 승인한 `package.json`, `package-lock.json`, 감사 예외 파일, 추가 테스트와 공개 패키지 코드로 범위를 줄여 Claude Opus 설계·심층 리뷰 에이전트를 생성했다. 앱 소스 원문은 리뷰어에게 전달하지 않는다.
