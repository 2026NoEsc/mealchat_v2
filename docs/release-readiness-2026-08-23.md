# MealChat 출시 준비 판정 — 2026-08-23

## 2026-09-06 통합 업데이트

현재 작업 트리에는 로컬 마이그레이션 29개가 있다. `rpc_hardening_cutover`는
구버전 클라이언트 호출을 차단하는 단계이므로 `supabase/deferred_migrations/`로
분리했고, 운영에는 적용하지 않았다. 2026-09-03과 2026-09-06의 후속 마이그레이션이
앞선 `toggle_vote`·`leave_room` 정의를 다시 만들면서 잠금을 잃었던 문제는
`20260906134305_rpc_concurrency_rehardening.sql`에서 방 advisory lock과 행 잠금,
확정 후 변경 차단을 복구했다. 이 보정은 로컬 검증 전용이며 운영 배포 승인을 포함하지 않는다.

따라서 아래의 2026-08-23 PASS 문구는 당시 스냅샷이고, 현재 판정은 여전히 NO-GO다.

## 현재 판정

**NO-GO.** 로컬 앱·DB hardening 후보는 통과했지만 운영 RPC는 아직 기존 권한을
유지한다. 실제 비밀번호 복구, 인증된 실기기 흐름, 최소 앱 버전 전환, 운영 단계 적용은
끝나지 않았다. 이 문서는 로컬 테스트 성공을 운영 준비 완료로 해석하지 않는다.

## 게이트

| 영역 | 상태 | 확인된 사실 | 출시 전 종료 조건 |
|---|---|---|---|
| 정밀 위치 RPC | **NO-GO / P0** | 운영 `meeting_midpoint`는 로그인 사용자가 실행할 수 있고, 입력·결과 조합으로 상대 정밀 좌표를 복원할 수 있다. 현재 데이터에는 활성 관계 노출이 없지만 제품 권한이 안전한 것은 아니다. | 독립 containment migration으로 `PUBLIC`·`anon`·`authenticated` 실행 권한을 철회하고 원격 권한과 Advisor를 재검증한다. |
| 실제 Auth 복구 | **진행 중** | 첫 시도는 PC에서 먼저 열린 일회용 링크를 에뮬레이터에서 다시 열어 코드 교환에 실패했다. 앱이 오류를 숨기던 결함은 로컬에서 안전한 안내와 중복 URL guard로 보완했다. | 첫 계정에서 새 메일을 앱에서 다시 요청해 에뮬레이터에서만 열고, 비밀번호 변경·재로그인을 완료한다. 두 번째 계정도 동일하게 검증한다. 비밀번호·토큰은 기록하지 않는다. |
| 복구 화면 디자인 | **HOLD** | 기능용 `NewPasswordScreen`과 라우팅은 존재하지만 `figma-specs.md`에는 해당 화면의 Figma 노드·좌표·렌더 검증 기록이 없다. | 기능 E2E와 별도로 디자인 원본을 확정하고 Figma 기준 렌더링을 검수한다. 원본이 없으면 제품 승인된 임시 UI임을 명시한다. |
| 위험 RPC 제품 권한 | **로컬 보정 검증 중 / 운영 BLOCKED** | 과거 19개 스냅샷의 통과 기록과 별개로, 후속 마이그레이션이 `toggle_vote`·`leave_room` 잠금을 덮어쓴 사실을 확인했다. 로컬 보정 migration이 추가됐고 deferred cutover는 일반 적용 경로에서 분리했다. | 실제 PostgreSQL에서 최신 29개 fresh/upgrade, 두 사용자 격리·동시성, 함수 grants와 Advisor를 다시 통과시키고 제품 권한을 승인한다. |
| 추천 결정적 경로 | **로컬 PASS** | 요청 검증 → 503 재시도 → Gemini JSON 파싱 → 후보 ID·rank 검증 → 서버 사실값 보정 → 앱 장소 렌더링·선택을 fixture로 검증했다. | 운영과 같은 ES256 사용자 세션·실제 장소 후보로 전체 경로를 한 번 성공시키고 provider/log에 비공개 원문이 남지 않는지 확인한다. |
| 추천 실제 경로 | **NO-GO** | 실제 JWT 호출은 Auth와 Gemini 요청까지 도달했지만 Gemini가 재시도 후에도 503을 반환했다. 로컬에는 Tmap 키가 없어 앱 장소 검색 E2E도 막혀 있다. | 장소 provider를 준비하고 Gemini 성공 응답의 파싱·서버 검증·화면 렌더링을 관찰한다. |
| Edge Function gateway JWT | **HOLD** | 운영 v7은 `verify_jwt=false`이고 `auth: "user"`가 서명·만료·subject를 검사한다. 즉시 무인증 우회는 재현되지 않았다. 로컬 함수는 추가로 project issuer, audience, role, 필수 exp, UUID subject, 비익명 사용자를 fail-closed 검증한다. ES256 gateway 문서는 상충한다. | 로컬 claim 보완을 독립 배포 후보로 검토하고, 동일 프로젝트의 무부작용 preview에서 `verify_jwt=true` ES256·CORS·잘못된 토큰 매트릭스를 통과한 뒤 별도 승인으로 운영 전환한다. |
| 유출 비밀번호 차단 | **HOLD** | Security Advisor 기준 비활성화 상태이며 현재 Free 플랜에서는 켤 수 없다. | Pro 변경을 별도 승인해 활성화하거나, 출시 위험 수용과 보완 통제를 명시한다. |
| 마이그레이션 이력 | **로컬 재검증 필요 / 원격 변경 전** | 현재 로컬 `supabase/migrations/`는 29개이며 cutover 1개는 `deferred_migrations/`에 있다. 원격 개수·identity는 linked CLI 조회 없이는 단정하지 않는다. | 최신 로컬 전체 초기화와 단계별 업그레이드를 통과시키고, 별도 승인 뒤 원격 migration identity·함수 권한·RLS·Advisor를 다시 확인한다. |
| 앱 품질 게이트 | **재검증 필요** | 충돌 통합과 RPC 보정 이후 quality를 다시 실행해야 한다. 이전 수치는 2026-08-23 스냅샷이다. | 현재 커밋에서 `npm run quality`, Deno check, 결정적 fixture를 다시 통과한다. |
| Android 안정성 | **에뮬레이터 PASS / 실기기 HOLD** | 현재 소스로 JS 번들 포함 release APK를 빌드했다. Pixel 7 Android 15 에뮬레이터에서 비행기 모드 콜드 스타트, 중첩 화면 hardware back, root back, background/resume의 같은 PID·route 유지, force-stop 뒤 로그인 복귀를 확인했고 fatal log는 없었다. 잘못된 `.png` 확장자의 JPEG 자산도 릴리스 빌드에서 발견해 `.jpg`로 수정했다. APK는 debug keystore 서명이므로 배포본이 아니다. | Android 실기기에 배포용 서명 후보를 설치하고 로그인 후 홈·방·채팅·일정·추천의 상태 복구와 네트워크 실패/재시도를 스모크 테스트한다. |

## 확정한 제품 권한

1. `meeting_midpoint`는 안전한 관계·정밀도 모델이 생길 때까지 일반 사용자 실행을
   닫는다.
2. 방 초대는 `pending → accepted/declined/expired` 상태를 가지며 피초대자만 수락하거나
   거절한다. 수락 전에는 참가자 행과 방 데이터 접근이 생기지 않는다.
3. 방 멤버는 열린 정산이 없을 때만 정산을 시작할 수 있다. 수취인은 생성 시점 참가자
   snapshot으로 고정하고, 이후 입장자는 과거 계좌·알림을 보지 못한다. 방을 나간 수취인은
   자기 정산을 계속 본다. 진행 정산의 본문·금액·계좌는 생성자만 수정하고, 빈 계좌 인자는
   기존 값을 지우지 않는다. 테이블 직접 쓰기는 닫는다.
4. 시스템 메시지는 임의 본문 RPC가 아니라 실제 상태 변경과 같은 트랜잭션의 고정 사건
   메시지만 허용한다. 초대 코드는 일반 사용자 메시지로 보낸다.
5. 투표 확정은 클라이언트 계산을 신뢰하지 않는다. 서버가 방 잠금 아래 득표 선두와 동률
   규칙을 계산하고, 현재 참가자의 strict majority가 있을 때만 어떤 멤버든 종류별로 한 번
   확정할 수 있다. 확정 뒤에는 같은 종류의 후보 추가와 투표 변경을 닫는다.

## 운영 변경 순서

1. `meeting_midpoint` 실행 권한 철회만 담은 P0 migration을 별도 승인·적용한다.
2. 원격 함수 권한과 Security Advisor를 재조회하고 인증 사용자 호출도 거부되는지 확인한다.
3. 수락형 초대·정산·사건 RPC의 로컬 SQL/RLS/동시성 검증은 완료했다. 운영 전에는 가장
   오래된 실제 지원 바이너리로 additive 호환을 한 번 더 확인한다.
4. migration은 containment·additive·cutover로 분리했다. 권고 순서는 containment →
   additive → 신버전 배포와 최소 지원 버전 전환 → 채택 확인 → cutover다. additive도 아주
   오래된 앱이 rooms 직접 UPDATE·bill DML·participant DELETE를 사용한다면 깨질 수 있으므로
   실제 최소 지원 바이너리 확인 전에는 적용하지 않는다.
5. 추천 함수는 결정적 테스트와 실제 provider E2E를 분리한다. `verify_jwt` 전환은 인증
   preview 검증과 별도 운영 승인을 거친다.
6. Auth 복구 두 계정과 추천 성공 경로를 마친 뒤 최종 Advisor·migration history·quality를
   다시 실행한다.

## 아직 실행하지 않은 변경

- 운영 migration 적용
- 운영 Edge Function 배포 또는 `verify_jwt` 변경
- Auth 플랜 변경 또는 유출 비밀번호 차단 활성화
- 운영 secret/provider 설정 변경
- 커밋·푸시

## 로컬 재현 명령과 증거

- `supabase/tests/20260823_rpc_hardening.sql`: cutover 권한·RLS·A/B/C 격리 62개
- `scripts/test-rpc-additive-compat.ps1`: additive v1/v2 양방향 호환
- `scripts/test-rpc-concurrency.ps1`: 별도 psql 트랜잭션의 accept·settlement 동시성
- `android/app/build/outputs/apk/release/app-release.apk`: 로컬 테스트용 debug-key release APK

추가 권고 범위는 실제 JWT→PostgREST, accept×decline, join/leave×settlement,
toggle×confirm 교차 동시성과 실패 주입 rollback이다. 현재 핵심 격리·idempotency gate는
통과했지만 이 교차 조합 전부를 증명한 것은 아니다.
