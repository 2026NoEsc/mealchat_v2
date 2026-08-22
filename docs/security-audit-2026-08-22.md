# MealChat 운영 보안 감사 — 2026-08-22

## 범위와 판정 기준

프로젝트 `akrfaiwgqoxtpgdbgads`의 운영 상태를 읽기 전용으로 확인했다. 원격 SQL은
함수 정의·권한·RLS·인덱스를 조회하거나 `ROLLBACK`되는 검증 트랜잭션만 실행했다.
운영 스키마와 Edge Function은 변경하지 않았다. 읽기 전용 감사 뒤 승인된 Auth 후속
작업으로 standalone Redirect URL 두 개를 Dashboard에 등록했다. 2026-08-23에는 사용자가
지정한 전용 메일함으로 실제 Auth 테스트 계정 두 개를 만들고, 임시 방·메시지로 RLS를
검증한 뒤 `leave_room`으로 임시 방을 정리했다. 두 Auth 테스트 계정과 자동 생성된
프로필은 이후 비밀번호 재설정 검증을 위해 남겨 두었다.

`SECURITY DEFINER` 경고를 개수만 줄이는 방식으로 판단하지 않았다. 각 RPC마다 다음을
확인했다.

- 호출자 식별: `auth.uid()` 확인 여부
- 객체 권한: 방 멤버십·소유권·관계 조건
- 실행 환경: `SET search_path TO ''`
- 실행 권한: `PUBLIC`·`anon` 차단, `authenticated` 명시 허용
- 의미 권한: 기술적으로 호출 가능하더라도 제품 역할상 그 변경을 해도 되는지

## 원격 상태

- 로컬 `supabase/migrations/`의 16개 버전과 원격 migration history가 일치한다.
- 보안 Advisor는 `SECURITY DEFINER` RPC 10개와 유출 비밀번호 차단 비활성화를 경고한다.
- 10개 RPC 모두 고정 `search_path`를 사용한다.
- 10개 RPC 모두 `PUBLIC`과 `anon`의 실행 권한이 없고, `authenticated`에만 사용자 호출
  권한이 있다. `service_role`과 소유자 `postgres` 권한은 유지돼 있다.

## RPC별 결과

| RPC | 기술적 통제 | 판정 | 남은 위험 또는 결정 |
|---|---|---|---|
| `add_voting_item` | 로그인 + 방 멤버, 종류·빈 값·중복 검사 | 적합 | 라벨 길이·호출 빈도 제한은 별도 품질 과제 |
| `create_room_settlement` | 로그인 + 방 멤버 | **보류** | 방 멤버 누구나 진행 중 정산의 금액과 수취 계좌를 덮어쓸 수 있다. 생성자 또는 명시된 정산 관리자만 수정하게 할지 결정 필요 |
| `current_terms_consent_status` | 호출자 `auth.uid()`의 동의만 조회 | 적합 | `authenticated` 실행 권한이 로그인 경계를 담당 |
| `invite_friend_to_room` | 방 멤버 + 호출자의 `follows` 관계 | **제품 결정 필요** | 상대 수락 없이 즉시 참가자로 삽입한다. "초대"인지 "강제 참가"인지 의미를 확정해야 함 |
| `join_room_by_code` | 로그인 + 정확한 코드 + 만료 검사 | 적합 | 코드는 대소문자를 구분함 |
| `leave_room` | 로그인 + 본인 참가 여부 | 적합 | 마지막 참가자가 나가면 방을 삭제하는 현재 정책과 일치 |
| `meeting_midpoint` | 로그인 + 호출자가 팔로우한 대상 + `origin != private` | **보류** | 팔로우는 상대 승인 없이 만들 수 있고 `origin` 미설정은 공개로 처리한다. 정확한 좌표·취향 접근 기준을 상호 관계 또는 방 멤버십으로 강화할지 결정 필요 |
| `post_room_system_message` | 로그인 + 방 멤버 | **보류** | 모든 방 멤버가 임의 문장을 시스템 메시지로 위장할 수 있다. 사건별 서버 RPC 또는 구조화된 event kind가 필요 |
| `record_terms_consent` | 로그인 + 자기 프로필 + 서버의 현재 약관 버전 | 적합 | 반복 호출은 새 감사 행을 남기는 현재 모델과 일치 |
| `toggle_vote` | 로그인 + 방 참가 행 + 실제 후보 존재 | 적합 | 레거시 비 UUID 후보는 투표 대상에서 제외됨 |

Advisor의 10개 경고 중 6개는 현재 호출 목적과 내부 검사를 함께 보면 허용 가능한 경고다.
나머지 4개는 RLS 우회 자체보다 제품 역할·개인정보·표시 무결성의 결정이 부족하다.

## 두 사용자 격리 검증

운영에 존재하는 사용자 4명 중 두 명을 식별자 출력 없이 선택해 `authenticated` 역할과
각 사용자의 JWT claim을 모의했다. 트랜잭션은 읽기 전용 또는 마지막에 `ROLLBACK`했다.

통과한 검증:

- 다른 사용자의 `profiles`, `profile_private`, `profile_consents` 행이 보이지 않음
- 멤버가 아닌 방·참가자·메시지 행이 보이지 않음
- 본인과 관계없는 `follows` 행이 보이지 않음
- 비회원이 다른 방에 대해 `add_voting_item`, `create_room_settlement`,
  `invite_friend_to_room`, `leave_room`, `post_room_system_message`, `toggle_vote`를 호출하면
  모두 `42501`로 거부됨
- `PUBLIC`과 `anon`은 10개 RPC 모두 실행 불가

이 검증은 RLS와 RPC의 데이터베이스 경계만 확인한다. 실제 이메일 가입·확인·재설정과
모바일 딥링크를 대신하지 않는다.

### 실제 두 계정 E2E — 2026-08-23

사용자가 지정한 수신 가능한 메일함 두 개로 운영 Auth 가입을 실행했다. 두 확인 메일의
링크를 열어 계정을 확인했고, 두 계정 모두 실제 비밀번호 로그인이 성공했다. 가입
트리거가 각 계정의 `profiles`와 `profile_private` 행을 한 개씩 만든 것도 확인했다.

각 세션으로 임시 방과 메시지를 한 개씩 만들고 Data API를 양방향으로 호출했다.

- 각 사용자는 자기 방만 조회할 수 있었고 상대 방은 조회되지 않았다.
- 상대 방의 메시지와 참가자도 조회되지 않았다.
- 상대 방에 직접 메시지를 넣는 시도는 양방향 모두 `42501`로 거부됐다.
- 일반 `.delete()`는 오류 없이 영향 행이 0개일 수 있었다. `rooms`에 DELETE 정책이 없기
  때문이다. 성공 여부를 오류 유무만으로 판단하지 않고 영향 행을 다시 조회했다.
- 방장 한 명만 남은 각 임시 방에서 `leave_room`을 호출하자 결과가 `deleted`였고, 관리자
  재조회에서 임시 방 0개를 확인했다.

따라서 실제 세션 기반 방·메시지·참가자 격리는 통과했다. 비밀번호 재설정과 앱 딥링크는
아래와 같이 아직 별도 검증이 필요하다.

## Edge Function 인증 경계

운영 `schedule-recommend`는 version 7, `verify_jwt = false`다. 배포 소스는
`withSupabase({ auth: "user" })`와 `ctx.userClaims`를 사용한다. publishable key 시대에는
플랫폼의 레거시 JWT 검사를 끄고 `@supabase/server`가 사용자 자격을 검증하는 공식 패턴과
일치한다.

인증 헤더가 없는 POST 요청은 운영에서 `401 INVALID_CREDENTIALS`로 거부됐다.

2026-08-22 감사 당시 배포된 `index.ts`와 로컬 파일은 일치하지 않았다.

- 운영 version 7: 1,793줄
- 당시 로컬: 1,553줄
- 첫 차이: 운영에는 `MAX_PLACE_CANDIDATES = 20`이 있으나 로컬에는 없음

따라서 인증 없는 요청 차단은 확인됐지만, 당시 로컬 커밋으로 운영 version 7을 재현할 수
없었다. 아래 후속 작업으로 소스는 복원했지만 Auth → Function → provider → 구조화 파싱 →
앱 렌더링의 실제 성공 경로는 아직 끝까지 통과하지 못했다.

### 2026-08-23 계약 후속 확인

운영 version 7과 현재 앱 사이에 단순 소스 차이를 넘어선 데이터 계약 불일치를 확인했다.

| 구분 | 저장소 레거시 함수·기존 앱 | 운영 version 7 |
|---|---|---|
| 장소 요청 | `place` 한 건 | `placeCandidates` 배열 |
| 시간 추천 응답 | `recommendations` | `slotRecommendations` |
| 장소 추천 응답 | 없음 | `placeRecommendations` |

기존 앱 그대로라면 인증에 성공해도 운영 함수가 `placeCandidates is required`로 요청을
거부한다. 이를 배포 변경 없이 줄이기 위해 로컬 클라이언트에 다음 호환 계층을 추가했다.

- Tmap POI의 `id`를 일정 장소 모델에 보존
- `place`와 `placeCandidates`를 같은 요청에 함께 전송
- `recommendations`와 `slotRecommendations`를 모두 읽음
- 운영 응답에 없는 `averageTravelMinutes`를 `null`로 정규화해 `undefined분` 표시를 차단
- 계약 단위 테스트 5개 추가 및 통과

호환 계층 뒤에는 운영 version 7의 `index.ts`와 `deno.json`을 로컬 작업 트리에 복원했다.
복원 직후 공백을 제외한 내용이 운영 파일과 일치함을 확인했다. `deno check`에서는 검증 전
타입이 `unknown`인 `body`를 다시 참조한 네 곳 때문에 오류 5개가 나왔다. 네 참조를 이미
검증된 `requestBody`로 바꾼 뒤 Deno 타입 검사가 통과했다. 따라서 현재 로컬 함수는 운영
v7을 기준으로 하되 이 네 줄의 타입 안전성 수정이 더해진 상태다. 아직 커밋·재배포하지
않았다.

실제 확인된 두 세션 중 하나의 JWT로 운영 함수를 두 차례 호출했다. 두 호출 모두 Auth와
함수 요청 검증을 통과해 Gemini 요청까지 도달했지만, Gemini가 각 호출에서 `503
UNAVAILABLE`을 반환했다. 서버는 매번 최대 세 차례 재시도한 뒤 클라이언트에 `502 Gemini
API request failed`를 돌려줬다. 로그의 제공자 메시지는 모델의 일시적 수요 급증이었다.
따라서 Auth → Function → Gemini 요청·재시도까지는 확인됐지만 실제 Gemini 응답 파싱과
앱 렌더링은 확인하지 못했다. 같은 장애에서 추가 반복 호출하거나 함수·모델을 변경하지
않았다.

현재 로컬 `.env`에는 `EXPO_PUBLIC_TMAP_APP_KEY`도 없다. 실제 앱 UI에서 장소 검색부터
이어 가는 E2E는 Tmap 키를 로컬에 설정하거나 예정된 카카오 장소 검색 전환을 마친 뒤
가능하다. 수동으로 만든 장소 후보를 사용한 함수 E2E와는 별개의 선행 조건이다.

## Auth 설정과 E2E 상태

- 유출 비밀번호 차단: Security Advisor 기준 **비활성화**. 현재 Free 플랜에서는 사용할 수
  없고 Pro 이상이 필요하다. 이번 작업에서 결제·플랜 변경은 하지 않았다.
- Redirect URL: 2026-08-22 운영 Dashboard에 아래 두 standalone URL을 등록·저장했다.
  - `mealchat://auth/callback`
  - `mealchat://auth/reset`
- Expo Go 개발 URL은 실행할 호스트가 정해진 뒤 실제 `exp://...` 값을 별도로 등록해야 한다.
- 가입·이메일 확인·로그인: 실제 테스트 계정 두 개에서 통과
- 비밀번호 재설정: 실제 앱에서 `resetPasswordForEmail`을 시작하고 같은 앱의 PKCE
  verifier로 딥링크 코드를 교환하는 검증이 남음
- 전체 추천 성공 경로: 실제 JWT로 Gemini 요청까지 통과했으나 제공자 503으로 파싱·렌더링
  미검증

Node 같은 별도 실행 환경에서 재설정 메일을 만들면 PKCE verifier가 모바일 앱의
AsyncStorage에 없으므로, 그 링크를 앱에서 열어도 올바른 E2E가 아니다. 두 테스트 계정의
비밀번호 재설정은 실제 MealChat 앱에서 시작하고 완료해야 한다. 비밀번호·토큰·사용자
식별자는 기록하지 않았다.

## 최종 재검증

- Security Advisor 재실행: `SECURITY DEFINER` RPC 10개와 유출 비밀번호 차단 1개가 유지됨
- 원격 migration history 재실행: 16개, 로컬 16개와 일치
- `deno check --config supabase/functions/schedule-recommend/deno.json .../index.ts`: 성공
- `npm run quality` (2026-08-23 재실행): 성공
  - 테스트 스위트 16개, 테스트 186개 통과
  - TypeScript·ESLint·Expo 의존성 검사 통과
  - 자산 검사 통과
  - 의존성 감사는 2026-09-30 만료되는 임시 예외 3개 안에서 통과
- 실제 Auth 두 계정: 가입·이메일 확인·로그인·프로필 자동 생성 통과
- 실제 두 세션 RLS: 방·메시지·참가자 격리와 교차 쓰기 차단 통과, 임시 방 0개로 정리
- 실제 추천 호출: Auth·함수·Gemini 요청까지 통과, Gemini 503으로 파싱·렌더링 중단

## 다음 결정

1. 정산 계좌를 수정할 수 있는 역할을 정한다.
2. 시스템 메시지를 사건별 서버 생성으로 제한할지 정한다.
3. 중간 지점 계산에 정밀 좌표를 제공하는 관계를 정한다.
4. 친구 초대를 수락형 invitation으로 바꿀지 정한다.
5. 실제 앱에서 두 테스트 계정의 비밀번호 재설정·딥링크를 완료한다.
6. Gemini 503이 해소된 뒤 한 번 재검증하고, 반복된다면 대체 모델·사용자 오류 처리를
   별도 설계한다.
7. 운영 version 7에서 고친 `requestBody` 네 줄을 독립 검토한 뒤 재배포할지 결정한다.
8. Pro 플랜 변경을 승인할지 결정하고, 승인하면 유출 비밀번호 차단을 활성화한다.
