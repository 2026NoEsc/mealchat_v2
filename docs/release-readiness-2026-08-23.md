# MealChat 출시 준비 판정 — 2026-08-23

## 2026-09-07 통합 업데이트

현재 로컬 `supabase/migrations/`에는 29개 파일이 있고 `rpc_hardening_cutover`는
구버전 클라이언트 호출을 차단하는 단계이므로 `supabase/deferred_migrations/`로
분리되어 있다. 운영 migration 목록은 2026-09-07 read-only 확인에서 28개이며,
최신 identity는 `20260907120000_update_settlement_amount`다. 이 remote-only
migration의 SQL 원본은 현재 저장소에 없고, 로컬에는 `20260823072701`·
`20260906134305`가 있지만 원격에는 없다. 따라서 원격과 로컬의 migration history는
서로 다른 상태이며, 원격 최신 migration의 권한·제품 계약을 source 없이 추정해
적용하지 않는다. 2026-09-03과 2026-09-06의 후속 마이그레이션이 앞선
`toggle_vote`·`leave_room` 정의를 다시 만들면서 잠금을 잃었던 문제는
`20260906134305_rpc_concurrency_rehardening.sql`에 보정되어 있지만 아직 로컬
PostgreSQL 검증 전용이며 운영에 적용하지 않았다. 원격에는 별도로
`settle_room_when_all_paid`의 `PUBLIC EXECUTE`와 `update_settlement_amount`의
`authenticated EXECUTE`가 확인되어 운영 권한 상태는 추가 검토가 필요하다.

따라서 아래의 2026-08-23 PASS 문구는 당시 스냅샷이다. 로컬에서는 최신 29개
fresh·27개 baseline에서 29개로의 upgrade·pgTAP·additive·동시성 검증을 다시
통과했지만, 운영은 28개이며 local-only/remote-only migration이 함께 존재한다. 실제 Auth·실기기·provider 경로와 최소 지원
버전 전환이 남아 있어 전체 판정은 NO-GO다.

## 현재 판정

**NO-GO.** `meeting_midpoint` P0 실행 권한은 회수됐지만, 운영에는 additive·
rehardening이 아직 적용되지 않아 직접 DML과 레거시 호환 경로가 남아 있다. 원격에는
저장소에 없는 `20260907120000_update_settlement_amount`도 있어 migration source
reconciliation이 필요하다. 로컬 PostgreSQL 29개 fresh, 27→29 out-of-order upgrade, pgTAP 70/70, additive 호환,
두 세션 동시성은 통과했다. 실제 비밀번호 복구·실기기·provider 경로와 운영 최소
지원 버전 전환은 아직 확인하지 않았다. 로컬 성공을 운영 준비 완료로 해석하지 않는다.

## 게이트

| 영역 | 상태 | 확인된 사실 | 출시 전 종료 조건 |
|---|---|---|---|
| 정밀 위치 RPC | **P0 차단 PASS / 제품 기능 NO-GO** | `20260906141801_contain_meeting_midpoint` 적용 후 `public`·`anon`·`authenticated` 실행 권한은 false, `postgres`·`service_role`만 true로 확인했다. | 안전한 관계·정밀도 모델이 생길 때까지 일반 사용자 실행을 닫고, 이 권한 상태를 유지한다. |
| 실제 Auth 복구 | **진행 중** | 첫 시도는 PC에서 먼저 열린 일회용 링크를 에뮬레이터에서 다시 열어 코드 교환에 실패했다. 앱이 오류를 숨기던 결함은 로컬에서 안전한 안내와 중복 URL guard로 보완했다. | 첫 계정에서 새 메일을 앱에서 다시 요청해 에뮬레이터에서만 열고, 비밀번호 변경·재로그인을 완료한다. 두 번째 계정도 동일하게 검증한다. 비밀번호·토큰은 기록하지 않는다. |
| 복구 화면 디자인 | **HOLD** | 기능용 `NewPasswordScreen`과 라우팅은 존재하지만 `figma-specs.md`에는 해당 화면의 Figma 노드·좌표·렌더 검증 기록이 없다. | 기능 E2E와 별도로 디자인 원본을 확정하고 Figma 기준 렌더링을 검수한다. 원본이 없으면 제품 승인된 임시 UI임을 명시한다. |
| 위험 RPC 제품 권한 | **로컬 PASS / 운영 BLOCKED** | 원격 주요 `SECURITY DEFINER` 함수는 `search_path=""`가 고정되어 있지만, `rooms` 직접 INSERT/UPDATE, `dutch_pay_bills` 직접 INSERT/UPDATE, `notifications` 직접 INSERT, `dutch_pay_members.is_completed` 직접 UPDATE가 아직 열려 있다. 또한 `settle_room_when_all_paid`는 `PUBLIC EXECUTE`, `update_settlement_amount`는 `authenticated EXECUTE`다. 로컬 29개에서는 additive·rehardening이 이 경계를 닫고 owner-only close와 미완료 수취인 차단을 검증했다. | remote-only migration source와 최소 지원 버전, owner-only close/self-leave 제품 계약을 확정한 뒤 정확한 migration 집합을 별도 승인·적용하고, remote grants/RLS와 두 사용자 검증을 다시 실행한다. |
| 추천 결정적 경로 | **로컬 PASS** | 요청 검증 → 503 재시도 → Gemini JSON 파싱 → 후보 ID·rank 검증 → 서버 사실값 보정 → 앱 장소 렌더링·선택을 fixture로 검증했다. | 운영과 같은 ES256 사용자 세션·실제 장소 후보로 전체 경로를 한 번 성공시키고 provider/log에 비공개 원문이 남지 않는지 확인한다. |
| 추천 실제 경로 | **NO-GO** | 실제 JWT 호출은 Auth와 Gemini 요청까지 도달했지만 Gemini가 재시도 후에도 503을 반환했다. 로컬에는 Tmap 키가 없어 앱 장소 검색 E2E도 막혀 있다. | 장소 provider를 준비하고 Gemini 성공 응답의 파싱·서버 검증·화면 렌더링을 관찰한다. |
| Edge Function gateway JWT | **HOLD** | 운영 v7은 `verify_jwt=false`이고 `auth: "user"`가 서명·만료·subject를 검사한다. 즉시 무인증 우회는 재현되지 않았다. 로컬 함수는 추가로 project issuer, audience, role, 필수 exp, UUID subject, 비익명 사용자를 fail-closed 검증한다. ES256 gateway 문서는 상충한다. | 로컬 claim 보완을 독립 배포 후보로 검토하고, 동일 프로젝트의 무부작용 preview에서 `verify_jwt=true` ES256·CORS·잘못된 토큰 매트릭스를 통과한 뒤 별도 승인으로 운영 전환한다. |
| 유출 비밀번호 차단 | **HOLD** | Security Advisor 기준 비활성화 상태이며 현재 Free 플랜에서는 켤 수 없다. | Pro 변경을 별도 승인해 활성화하거나, 출시 위험 수용과 보완 통제를 명시한다. |
| 마이그레이션 이력 | **로컬 PASS / 원격 DRIFT** | 원격은 28개이며 최신 identity는 `20260907120000_update_settlement_amount`다. 이 migration은 로컬에 없고, 로컬의 `20260823072701`·`20260906134305`는 원격에 없다. 로컬 29개 fresh와 27개 baseline→29개 `include-all` upgrade는 통과했다. | remote-only migration SQL을 먼저 확보·검토해 canonical history를 정한 뒤, 필요한 migration만 별도 승인·적용하고 최신 identity·grants·RLS를 재확인한다. |
| 앱 품질 게이트 | **PASS (로컬)** | 2026-09-07 임시 리허설 디렉터리 제거 후 `npm run quality`를 재실행해 자산 보안, TypeScript, lint, Jest 30 suites/267 tests, Expo 의존성 확인, 의존성 보안 감사를 모두 통과했다. | 원격 migration 적용 및 Android 실기기 스모크 테스트와 별도로 유지한다. |
| Android 안정성 | **에뮬레이터 PASS / 실기기 HOLD** | 현재 소스로 JS 번들 포함 release APK를 빌드했다. Pixel 7 Android 15 에뮬레이터에서 비행기 모드 콜드 스타트, 중첩 화면 hardware back, root back, background/resume의 같은 PID·route 유지, force-stop 뒤 로그인 복귀를 확인했고 fatal log는 없었다. 잘못된 `.png` 확장자의 JPEG 자산도 릴리스 빌드에서 발견해 `.jpg`로 수정했다. APK는 debug keystore 서명이므로 배포본이 아니다. | Android 실기기에 배포용 서명 후보를 설치하고 로그인 후 홈·방·채팅·일정·추천의 상태 복구와 네트워크 실패/재시도를 스모크 테스트한다. |

## 확정한 제품 권한

1. `meeting_midpoint`는 안전한 관계·정밀도 모델이 생길 때까지 일반 사용자 실행을
   닫는다.
2. 방 초대는 `pending → accepted/declined/expired` 상태를 가지며 피초대자만 수락하거나
   거절한다. 수락 전에는 참가자 행과 방 데이터 접근이 생기지 않는다.
3. 방 멤버는 열린 정산이 없을 때만 정산을 시작할 수 있다. 수취인은 생성 시점 참가자
   snapshot으로 고정하고, 이후 입장자는 과거 계좌·알림을 보지 못한다. 현재 `leave_room`은
   방장 전용 방 닫기이며, 미완료 정산 수취인이 있으면 방장도 닫을 수 없다. 방장 외 멤버의
   자기 탈퇴를 별도 `leave` RPC로 제공할지는 제품 결정으로 남겨 둔다. 진행 정산의 본문·금액·
   계좌는 생성자만 수정하고, 빈 계좌 인자는 기존 값을 지우지 않는다. 테이블 직접 쓰기는 닫는다.
4. 시스템 메시지는 임의 본문 RPC가 아니라 실제 상태 변경과 같은 트랜잭션의 고정 사건
   메시지만 허용한다. 초대 코드는 일반 사용자 메시지로 보낸다.
5. 투표 확정은 클라이언트 계산을 신뢰하지 않는다. 서버가 방 잠금 아래 득표 선두와 동률
   규칙을 계산하고, 현재 참가자의 strict majority가 있을 때만 어떤 멤버든 종류별로 한 번
   확정할 수 있다. 확정 뒤에는 같은 종류의 후보 추가와 투표 변경을 닫는다.

## 운영 변경 순서

1. `meeting_midpoint` 실행 권한 철회가 적용된 상태이며, 2026-09-07 확인 시 원격
   migration identity의 최신 항목은 `20260907120000_update_settlement_amount`다.
2. 원격 `meeting_midpoint` 권한은 `public`·`anon`·`authenticated` 실행이 false임을
   재확인했다. 다른 `SECURITY DEFINER` 함수에는 authenticated 실행 경로가 남아 있고,
   `settle_room_when_all_paid`는 anon에도 노출되어 있다. Security Advisor에는 이 권한
   경고들과 유출 비밀번호 차단 비활성 경고가 남아 있다.
3. 수락형 초대·정산·사건 RPC의 로컬 SQL/RLS/동시성 검증은 29개 fresh와 27→29
   `include-all` upgrade에서 완료했다. pgTAP 70/70, additive v1/v2 호환, 두 세션
   초대 수락·정산 생성 동시성이 모두 통과했다. 운영 전에는 가장 오래된 실제 지원
   바이너리로 additive 호환을 한 번 더 확인한다.
4. migration은 containment·additive·cutover로 분리했다. 운영 이력에는 저장소에 없는
   remote-only 항목과 local-only additive·rehardening이 섞여 있으므로 source
   reconciliation이 먼저다. 권고 순서는 containment →
   additive → 신버전 배포와 최소 지원 버전 전환 → 채택 확인 → cutover다. additive도 아주
   오래된 앱이 rooms 직접 UPDATE·bill DML·participant DELETE를 사용한다면 깨질 수 있으므로
   실제 최소 지원 바이너리 확인 전에는 적용하지 않는다.
5. 추천 함수는 결정적 테스트와 실제 provider E2E를 분리한다. `verify_jwt` 전환은 인증
   preview 검증과 별도 운영 승인을 거친다.
6. Auth 복구 두 계정과 추천 성공 경로를 마친 뒤 최종 Advisor·migration history·quality를
   다시 실행한다.

## 아직 실행하지 않은 변경

- 운영 migration: `migration list`에는 `20260907120000_update_settlement_amount`까지 보이지만,
  그 SQL 원본은 저장소에 없으므로 source reconciliation 전에는 정합 상태로 간주하지 않음
- 운영 additive·rehardening·cutover migration 적용
- 운영 Edge Function 배포 또는 `verify_jwt` 변경
- Auth 플랜 변경 또는 유출 비밀번호 차단 활성화
- 운영 secret/provider 설정 변경
- 위 운영 차단을 해소하기 위한 추가 커밋·푸시

## 로컬 재현 명령과 증거

- `supabase/tests/20260823_rpc_hardening.sql`: 현재 권한·RLS·A/B/C 격리와 owner close 70개
- `supabase/deferred_tests/20260823091028_rpc_hardening_cutover.sql`: cutover 전용 5개 gate
- `scripts/test-rpc-additive-compat.ps1`: additive v1/v2 양방향 호환
- `scripts/test-rpc-concurrency.ps1`: 별도 psql 트랜잭션의 accept·settlement 동시성
- 로컬 upgrade rehearsal: 27개 baseline → `include-all`로 `20260823072701`·`20260906134305` 적용
- `android/app/build/outputs/apk/release/app-release.apk`: 로컬 테스트용 debug-key release APK

추가 권고 범위는 실제 JWT→PostgREST, accept×decline, join/leave×settlement,
toggle×confirm 교차 동시성과 실패 주입 rollback이다. 현재 핵심 격리·idempotency gate는
통과했지만 이 교차 조합 전부를 증명한 것은 아니다.
