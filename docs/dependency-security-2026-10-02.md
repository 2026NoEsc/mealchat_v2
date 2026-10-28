# 2026-10-02 의존성 보안 권고 수정

## 변경

Expo SDK 54.0.37·React Native 0.81.5·React 19.1.0을 사용하는 앱의 보안 감사 실패를 해결하기 위한 로컬 의존성 변경이다. 직접 의존성 버전과 `quality` 및 감사 검사 스크립트는 유지했다.

| 의존성 | 기존 | 수정 |
|---|---|---|
| `@xmldom/xmldom` | 0.8.14 / 0.9.11 | 0.8.15 / 0.9.12 |
| `brace-expansion` | 1.1.18 / 2.1.4 / 5.0.9 | 1.1.21 / 2.1.7 / 5.0.12 |
| `js-yaml` | 3.15.1 / 4.3.1 | 3.15.2 / 4.3.2 |
| `undici` | 6.28.0 | 6.29.0 |
| Metro 패키지군 | 0.83.3 | 0.83.8로 일치 |
| `image-size` | 1.2.1 | 의존성 트리에서 제거 |
| `xcode`의 `uuid` | 7.0.3 | 11.1.1 |

첫 네 패키지는 기존 의존성 범위 내에서 잠금 파일을 갱신했다. Expo의 `@expo/metro` meta-package가 고정한 Metro 관련 14개 패키지는 `overrides`로 같은 0.83.8을 선택한다. `uuid` override는 `xcode`에만 적용한다. 기존 `postcss` override는 유지한다.

[Metro 0.83.8 공식 릴리스](https://github.com/react/metro/releases/tag/v0.83.8)는 `image-size`를 자체 파서로 교체한 보안 패치다. [해당 구현](https://github.com/react/metro/pull/1860)은 크기 조회에 이미 읽은 이미지 버퍼를 사용한다. `image-size` 2.x를 강제로 넣는 방법은 기존 Metro가 경로 문자열을 넘기는 API와 맞지 않아 사용하지 않았다.

[uuid 11.1.1 공식 릴리스](https://github.com/uuidjs/uuid/releases/tag/v11.1.1)는 버퍼 경계 검사의 보안 수정을 포함하고 CommonJS export를 제공한다. `xcode`의 `require('uuid').v4()` 호출과 호환되는지 직접 검증한다.

기존 취약점 제거 후 `security/audit-allowlist.json`의 만료 예외 4개를 삭제했다. 기존 예외는 연장하지 않았다. 이후 독립 리뷰에서 별도의 `node-forge` 권고가 발견되어 아래 조건으로 7일 임시 예외 1개를 추가했다.

## 검증

- `npm ci`: 새로 설치 성공, 취약점 0건. 잠금 파일 SHA256은 설치 전후 동일하다.
- `npm run security:audit`: 최종 종료 코드 0. `node-forge` 권고 1개가 전파된 취약점 기록 4건을 임시 예외 1개로 처리한다. 취약점 0건이라는 의미는 아니다.
- `tests/dependencyTooling.test.js`: Expo Metro wrapper의 이미지 버퍼·파일 경로 처리, 잘못된 입력의 종료, Xcode ID 생성, UUID 출력 버퍼 경계 거절, 두 plist 구현의 XML 왕복 변환 5개 테스트와 임시 예외의 경계 조건을 보호하는 4개 테스트가 모두 통과했다.
- `npm run quality`: 최종 종료 코드 0. 41개 모음의 356개 테스트, 타입·린트·에셋 검사, Expo 버전 정합성 및 감사 게이트 모두 통과했다. `.env` 자동 로드를 꺼서 실행했다.
- 앞서 `expo export --platform all --clear --max-workers 2`도 종료 코드 0으로 Android·iOS·Web 번들을 생성했다. 산출물: `dist/dependency-security-2026-10-02/`. 이후 변경은 감사 예외·테스트·문서뿐이며 앱 코드와 잠금 파일은 동일하다.

검증 환경은 Windows, Node 24.14.1, npm 11.11.0이다. export는 `.env` 자동 로드를 끄고 가상 Supabase 설정으로 수행한다. 번들 생성 결과는 실제 기기 실행이나 네이티브 iOS 빌드 성공을 의미하지 않는다.

## 독립 리뷰와 재검증

사용자의 전달 승인 및 사용량 재설정 후 Paseo 설계·심층 리뷰 프로필(Claude Opus 5.5)의 기존 에이전트 `f2dbdbf1-031e-4c2b-bfd2-0a2d6091304b`로 읽기 전용 독립 리뷰를 완료했다. 리뷰어는 잠금 파일과 설치 버전의 일치, 기존 예외 4건의 해소, 추가 테스트 5개 통과, 감사 스크립트가 변경되지 않은 것을 확인했다.

리뷰 시점에 `node-forge@1.4.0`의 [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)가 감사에 나타나 실패를 재현했다. 레지스트리 최신 버전은 1.4.0이고 [수정 PR](https://github.com/digitalbazaar/forge/pull/1152)은 아직 병합되지 않았다. 이 권고는 낮은 RSA 공개 지수에서 중첩 DigestAlgorithm의 추가 데이터를 허용해 서명 검증을 우회할 수 있는 문제다.

후속 독립 리뷰로 Expo CLI 사용 경로를 추적했고 다음 근거를 메인도 직접 확인했다.

- 설치 트리에서 소비자는 `@expo/cli`와 `@expo/code-signing-certificates`뿐이다.
- `@expo/cli/build/src/utils/codesigning.js:230-232,273-277`: EAS projectId 또는 서명 인증서 설정이 없으면 서명 경로가 종료된다. 현재 `app.json`에는 둘 다 없다.
- `@expo/code-signing-certificates/build/main.js:176,202-203`: 로컬 인증서의 자체 서명 또는 방금 로컬 개인키로 생성한 서명을 검증한다. 기본 키 생성은 인자 없는 `generateKeyPair()`이고 `node-forge/lib/rsa.js:925`의 기본 지수는 65537이다.
- 세 플랫폼 번들에서 `node-forge`와 `DigestInfo` 문자열이 모두 없음을 직접 확인했다. 문자열 검사는 모든 형태의 코드 내장을 배제하는 증거는 아니다.

이에 권고 `GHSA-86W9-CPQP-85RV`만 `2026-10-09` 만료로 허용했다. 보호 테스트는 소비 패키지 확대, `expo-updates` 설치, 서명 인증서·메타데이터·EAS projectId 설정, 동적 app config 도입, 앱 소스의 직접 forge import 및 예외 기한 연장을 차단한다. 감사 스크립트는 그대로이며 **2026-10-09 UTC 당일부터 실패한다**. 그 전에 패치판 및 새 Expo CLI의 의존성, 현재 노출 조건을 재확인해야 한다. 자동 연장하지 않는다.

최종 독립 리뷰는 예외 항목과 보호 테스트의 실제 diff를 확인하고 Jest 9/9 및 감사 게이트 성공을 재현해 차단 결함이 없다고 결론냈다. 메인은 전체 `quality` 356개 테스트 성공을 직접 확인했다. 자체 암호 패치를 만들거나 검증 기준을 낮추지 않았다.

Metro override는 Expo 54용 임시 호환 조치다. Expo SDK 또는 `@expo/metro`를 올릴 때 14개 override를 함께 제거하고, 새 SDK가 선언한 Metro 조합으로 감사·전체 quality·세 플랫폼 export를 재검증해야 한다. override를 남긴 채 SDK를 업데이트하면 SDK가 기대하는 버전을 가릴 수 있다.

`@expo/metro`의 래퍼 218개 중 아래 3개는 Metro 0.83.8에서 대상 파일이 사라져 require가 실패한다. 현재 저장소와 설치된 Expo·RN·Metro·jest-expo의 소비 경로에는 사용처가 없다는 리뷰 결과다. 이 내부 API를 사용하는 확장 도입 시 재검증해야 한다.

- `metro/node-haste/Package.js`
- `metro-file-map/lib/dependencyExtractor.js`
- `metro-resolver/utils/toPosixPath.js`

앱 번들에 포함되는 `metro-runtime`도 0.83.8로 변경됐다. 번들 생성은 성공했지만 실기기 실행 검증은 하지 않았다.

커밋·푸시·원격 Supabase 변경·배포는 실행하지 않았다. 이전 앱 및 RPC 작업의 수정은 보존했다.
