## Claude 권장 사항 후속 반영 결과

- **문서 마무리:** 사용자 전달상 후속 재검토도 차단 없이 통과했다. `docs/S1-release.md`에 S1→S5→S4 다음 S3 migration5개·보류3단계 조건, PG 버전 읽기 전용 확인(PG15 분기 미검증), cleanup 시작 전 삭제 공백, 시간 민감 Q1/불일치 재집계, 가입 남용·실패율 알람, REST 본문 제한 확인을 추가했다. D9 짧은/자세한 문구 초안은 각각2문장·해요체이며 **사용자 승인 필요**다. 이번 문서 마무리는 이 보고서와 운영 절차 두 파일만 변경했고 코드·migration·법률 원문은 변경하지 않았다. 문서 확인·diff 검사만 수행하며 DB/테스트를 재실행하거나 운영 반영·커밋하지 않는다.

- **M1/M2/M3 완료:** 최초 limiter FK 검사를 commit까지 지연. room 참조 인덱스4개·message actor 선두 인덱스. room/actor가 포함된 event_key. 반복 안내10건/방/actor/분 이후 억제하며 실제 멤버·위임 상태/멱등 영수증은 계속 저장. accepted/declined/expired 사실은 억제하지 않는다. PREVIEW_STALE·보관 중인 actor-bound 만료 preview는 추측 실패에서 제외하고 분/일 요청 수에는 포함한다.
- **M4 완료:** 방별 subtransaction 예외 격리, 실패 건수·시간·SQLSTATE만 누적. raw error/방 ID/이름 기록 없음. 단일 `private.run_s3_job_v1(text)`은 NOLOGIN worker 소유, 임의 SQL 실행 불가. worker는 private schema USAGE와 고정 core3개 EXECUTE만 가진다. app/anon/service/PUBLIC의 진입점 EXECUTE를 회수했다.
- **M5/release 완료:** Q1 전체9개 기대 건수 JSON을 입력받아 table lock 후 불일치 시 전체 중단. legacy INSERT가 누락되지 않도록 rooms SHARE ROW EXCLUSIVE를 loop 앞에서 획득한다. advisory는 try-lock 실패 시 전체 중단하여 table→advisory 대기 역전을 피한다. capability/권한 활성화는 cleanup OFF로 끝나고, 별도 `s3_start_cleanup.sql`에서 정확한 activated_at 승인 영수증이 있어야 ON이 된다. 정산 진입 hook은 cleanup ON 여부와 독립적으로 작동한다.
- **재검증 완료:** S3 SQL136(lifecycle14/transfer13/invite28/ACL19/upgrade13/settlement14/hardening35), S3 HTTP29, S3 앱36, 실제 scheduler3, 기존 S4 SQL503/경합41/HTTP52, S1/S5 SQL677, additive29, S4 upgrade44, S1 upgrade exit0. release gate6 + 활성화 전 S4 503 + 활성화 후495/정확한 구 계약 예상 실패8 통과. S3 경합29상태/26경합(실제 blocker22, worker 비차단3, busy D8 즉시 중단1)/병렬20 통과. 전체 quality는 아래 UI B 오류로 미통과다.
- 최종 quality 재실행도 병행 UI B의 같은 타입 오류8개(`ScheduleHomeScreen.useEffect`, renderer 선언, UI 테스트 RoomParticipant.roomId)로 중단했다. 별도 lint도 OwnerTransferCard/Sheet의 미사용 import5개로 실패했다. 전체 Jest는 **78 suite/1465 test 통과, 4 suite/7 test 실패(전체82/1472)**다. 실패: chatE의 legacy 공유 `7일` 비노출1, scheduleV3의 useEffect 미정의4, homeC의 닫힌 코드 입력값1, chatRoom의 renderItem 참조 안정성1. 완료 후 open-handle 경고로 종료되지 않아 해당 테스트 세션을 중단했다. A 소유 파일 오류는 발견되지 않았으며 UI B는 수정하지 않았다.
- 아래 검증 표는 후속 실행 결과로 갱신했다. 반복 실행을 누적하지 않는다.

### 이번 후속 변경 위치

| 파일:줄 | 변경 |
|---|---|
| `supabase/migrations/20261021010000_s3_lifecycle_storage.sql:88`, `:101`, `:109` | deferred limiter FK, worker_stats RLS/ACL, 참조 인덱스5개 |
| `supabase/migrations/20261021010100_s3_membership_owner_core.sql:16` | scoped 이벤트 key·반복 안내 억제·joined 공유 |
| `supabase/migrations/20261021010200_s3_invite_core.sql:52`, `:130` | FK defer 강제, stale/expired preview 무벌점·join 이벤트 |
| `supabase/migrations/20261021010300_s3_cleanup_core.sql:17`, `:83` | 방별 실패 격리·계수, NOLOGIN worker-owned 고정 dispatch |
| `supabase/migrations/20261021010400_s3_activate_lifecycle.sql:6`, `:72`, `:96` | Q1 집계, 불명 앵커 hard cap, activation 기준 정산 hook |
| `supabase/release/s3_schedule_cleanup.sql:12` | postgres 자신의 cron.schedule 등록 |
| `supabase/release/s3_activate_lifecycle.sql:40`, `:250` | table lock·기대9건수·try-lock·cleanup OFF 유지 |
| `supabase/release/s3_start_cleanup.sql:1` | 별도 cleanup 시작·activation 승인 영수증 |
| `src/lib/rooms.ts:524` | 새/과거 key 및 삭제된 actor parser, 시그니처 유지 |
| `supabase/tests/s3_hardening.sql:1`, `s3_fixture.sql:9`, `s3_lifecycle.sql:13`, `s3_sql.ps1:19` | 추가 SQL35 및 fixture/check 갱신 |
| `supabase/tests/s3_concurrency.ps1:248`, `s3_http.test.mjs:85` | FK/D8 실제 경합, HTTP 무벌점·새 key |
| `supabase/tests/s3_release_gate.ps1:1`, `:61`, `s3_scheduler.ps1:1` | gate6·전후 S4·정확한 예상8, 실제 background deletion |
| `tests/s3MessageNamespace.test.ts:1` | parser 회귀3개 |

### 호스티드 scheduler 선택 근거

[Supabase superuser 제한](https://supabase.com/docs/guides/database/postgres/roles-superuser)은 hosted postgres에 superuser를 제공하지 않는다고 명시한다. [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)는 `cron.schedule`로 DB 함수를 호출하는 방식을 제공한다. 따라서 `schedule_in_database`의 타 사용자 지정 대신 postgres가 자신으로 등록하고, 고정 command가 제한된 worker 소유 definer 하나로 들어가게 했다. Edge 대안은 외부 HTTP·인증·재시도 의존성이 더해져 채택하지 않았다. 권한 변경·소유자 이전·예약 등록을 **rolsuper=false postgres**로 실제 로컬 검증했다. supabase_admin 세션은 사용하지 않았다. hosted 원격 검증/등록은 미실행이다.

### 운영 절차와 남은 위험

1. `s3_inventory.sql` §15 Q1을 사전 실행하고 9개 건수를 저장한다. `private.s3_inventory_counts()`는 같은 Q1 집계의 JSON 표현이며 관리자 읽기 전용이다. 기대 건수를 `mealchat.s3.expected_inventory`에 명시한다. 자연 만료/결제/방 생성으로 건수가 달라지면 다시 집계·검토해야 한다. `{}`/누락/키 일부만 전달은 거절한다. 테스트에서만 현재 값을 자동 입력한다.
2. 승인한 유지보수 창에서 구 앱 쓰기를 정지하고, beta/scheduler 증거와 Q1 기대 건수를 넣어 held activation을 실행한다. D8+권한+capability는 atomic이며 정리는 OFF다. 활성화 후 S4 gate의 정확한 구 계약 실패8개를 검토한 다음 별도 held cleanup start를 승인한다. 실패 항목이 추가되거나 예상 항목이 사라지거나 스위트 건수가 줄면 gate 실패다.
3. **대규모 방 수에 대한 제한:** D8는 한 transaction이라 방별 advisory lock이 commit까지 누적된다. [PostgreSQL lock 설정 문서](https://www.postgresql.org/docs/current/runtime-config-locks.html)의 `max_locks_per_transaction`은 세션별 강제 상한이 아니라 공유 lock table 크기의 산정값이며, 다른 세션/관계 잠금도 같은 자원을 쓴다. 운영자가 Q1 total_rooms, `max_locks_per_transaction`, `max_connections`, `max_prepared_transactions`와 동시 부하를 확인해야 한다. 방 수가 여유 공유 잠금 용량에 근접하면 이 atomic 파일을 실행하지 말고 별도 승인한 배치 D8/재집계 절차를 먼저 설계한다. 이 구현이 무제한 대규모 실행을 보증하지 않는다. 잠금 부족/try-lock 실패는 전부 rollback하고 부분 capability를 남기지 않는다.
4. **다계정 추측 잔여 위험:** 코드 공간32^6=1,073,741,824, 한 계정200요청/24h의 한도는 여러 계정 합산을 제한하지 못한다. 운영 반영 전 가입 남용 제한(이메일/기기/IP 등 DB 밖 계층), 다계정·분산 추측과 실패/lock 비율 알람이 필요하다. 현재 DB 로직이 IP 제한을 제공한다고 주장하지 않는다. worker_stats 증가·반복 실패 및 cron 실패/실행 지연도 모니터링해야 한다. 삭제 실패는 다음 주기에 재시도하므로 장기 실패 방은 운영 알람으로 확인한다.
5. 함수 시그니처·UI용 기존 export는 변경하지 않았다. rooms의 parser는 새 scoped key와 과거 key 둘을 읽고 room/현재 actor가 다른 scoped key를 승격하지 않는다. profile 삭제로 FK가 NULL이면 과거 UUID key의 이벤트는 `탈퇴한 메이트`로 읽는다. S2는 lifecycle_actor_id뿐 아니라 새 key의 actor UUID도 익명화 대상으로 다뤄야 한다. joined는 서버 안내로 유지하며 UI의 typed lifecycle event에는 새 분기를 요구하지 않는다.

# S3 주 구현 A 인계 보고

2026-10-21 KST / Develop / HEAD 2a99831. 정본: `docs/S3-design.md` §12·14·15. 주 구현 A가 직접 구현·검증했으며 재위임하지 않았다. 최초 기존 변경인 untracked `docs/S3-design.md`는 수정하지 않았다.

## 결과와 남은 경계

- M1~M4 및 M5 준비, 서버/앱 계약 구현. **사용자 추가 결정에 따라 M5 전체 활성화를 별도 보류**했다. DB 앞단 REST body 제한의 상한·적용 계층은 명세 미확정으로 아래 미해결에 남긴다.
- 기본 migration은 새 capability/RPC 실행권한을 공개하거나 D10/D11을 회수하지 않는다. 보류 활성화 파일 하나에서 D8 보정·legacy 교체·직접 쓰기/R1 회수·새 grant·capability를 원자 처리한다. worker ON은 별도 held start 단계다.
- UI B·법률 문서·과거 migration·기존 설계 문서·원격 상태를 변경하지 않았다. stage/commit/push/배포하지 않았다.

## 단위별 완료

| 단위 | 파일 | 내용·증거 |
|---|---|---|
| M1 | `20261021010000_s3_lifecycle_storage.sql` | nullable 수명 열, 코드 digest/generation, limiter/preview/위임/request/tombstone, 시스템 actor/type, private RLS/ACL. 실제 설치·업그레이드·ACL 통과 |
| M2 | `20261021010100_s3_membership_owner_core.sql` | 생성·나가기·종료·동의 위임, 미완료/빈 snapshot guard, 멱등성·revision·scoped 이벤트·반복 안내 억제. lifecycle14, transfer13, settlement14 통과 |
| M3 | `20261021010200_s3_invite_core.sql` | 32기호 CSPRNG 6자, TTL/generation, 5/15분·30/분·200/일, 재발급1/분·10/일, 최소 preview→명시 join, legacy NULL. invite28·HTTP29 및 실제 최초 FK 잠금 검증 통과 |
| M4 | `20261021010300_s3_cleanup_core.sql` | 최대100개 try-advisory→room 재검사, 방별 실패 격리·계수, NOLOGIN worker entry·OFF gate. postgres cron 등록·실제 성공 검증 |
| M5 준비 | `20261021010400_s3_activate_lifecycle.sql` | Q1 집계, 불명 앵커 hard cap, expiry/display/stage guard와 cleanup ON에 독립적인 pre-bill hook. paid core는 hook 외 원본 유지 |
| M5 보류 | `supabase/release/s3_activate_lifecycle.sql` | D8·권한·capability atomic, Q1 기대9건수/SRE/try-lock. gate6 + post S4 495/예상8 통과, 모두 rollback |
| 정리 시작 보류 | `supabase/release/s3_start_cleanup.sql` | activated_at 승인 영수증을 받아 별도 ON. 누락 거절/명시 ON/rollback 검증 |

## 실행한 검증

| 실행 | 결과 | 확인 범위 |
|---|---:|---|
| `s3_sql.ps1` | **136 passed** | lifecycle14 / transfer13 / invite28 / ACL19 / upgrade13 / settlement14 / hardening35. 보류 활성화 본문은 fixture rollback 내 실행 |
| `s3_concurrency.ps1` | **29 상태 검사 / 26 경합 / 20 병렬 요청** | 실제 blocker22, worker 비차단3, busy D8 즉시 중단1. 최초 limiter FK profile 선행 잠금 부재·SRE 대 legacy INSERT 포함 |
| `s3_http.test.mjs` | **29 passed** | 합성 JWT·임시 PostgREST, counter 별도 transaction commit, stale/expired preview 무벌점, role ACL, 최소 preview/actor binding/replay/나가기 후 차단 |
| `s3_release_gate.ps1` | **6 + 전 S4 503 + 후 S4 495 / 예상8** | beta 누락·Q1 불일치·cleanup 승인 누락 거절, 실제 local cron 성공으로 활성화 진입, OFF/명시 ON/rollback 복원. beta 참조는 합성값 |
| `s3_scheduler.ps1` | **3 passed** | 비-superuser postgres 설치, app cleanup 호출 없이 실제 pg_cron이 worker entry를 거쳐 만료 방 삭제, 최종 reset으로 held/OFF/구 grant·예약 부재 복구 |
| `s4_sql.ps1` | **503 passed** | 기본 비활성 S3 상태의 기존 회귀 |
| `s5_sql.ps1` | **677 passed** | S1/S5 회귀 |
| `test-rpc-additive-compat.ps1` | **29 passed** | 활성화 전 기존 API/grant 보존 |
| `s1_upgrade.ps1` | **exit 0** | 역사 RPC70/70, 의도된 회수 후69/70 구분, S1/M7 업그레이드 및 최종 복구. 스크립트 전체 count는 미제공 |
| `s4_upgrade.ps1` | **44 passed** | 실제 S1/S5→S4→비활성 S3 upgrade와 readonly inventory 보존 |
| `s4_concurrency.ps1` | **41 passed** | 31 blocker, 10 lock_timeout 비차단 |
| `s4_http.test.mjs` | **52 passed** | 기존 PostgREST 회귀 |
| S3 앱 계약 세 파일 | **36 passed** | 기존33 + namespace3(새/과거 key, 삭제된 actor, room/actor/status 불일치). rooms 단독 lint 통과 |
| `npm run quality` | **실패: UI B 타입 오류** | UTC, EXPO_NO_DOTENV=1, EXPO_NO_CACHE=1. license·release 개발 gate15·asset까지 통과, tsc에서 중단 |
| 별도 전체 Jest / lint | **1465 통과 / 7 실패**, lint 경고5로 실패 | 78 suites 통과/4 실패. 상세는 맨 위 후속 기록. UI B 수정하지 않음. 완료 후 열린 handle로 남은 세션 중단 |
| `git diff --check` | passed | 작업 트리 검사 |

반복 실행 수를 누적하지 않았다. 기존 compatibility 검사의 R1/직접 INSERT 보존은 활성화 전 계약이다. 활성화 후 회수는 S3 ACL/HTTP/full-gate에서 별도 검증했다.

## 구현 중 수정한 경계

- 실제 DB에서 M3 composite INTO/변수 충돌을 찾아 수정했다.
- 위임·대상자 초대의 생성 시각과 TTL을 동일한 서버 시각으로 고정했다. 별도 clock 평가의 1µs 상한 초과를 제거했다.
- generation1 최초 발급은 재발급 횟수에서 제외한다. 실제 재발급 1/분·10/일을 검사한다.
- 만료 후 늦은 송금은 snapshot을 완료하되 room/chat 접근을 되살리지 못한다. live room의 S4 수명과 송금 후 금액 잠금은 보존했다.
- title/code 변경도 표시 revision에 반영한다. pending은 서버 can_transfer=false다. join은 참가행·서버 이벤트·revision·request를 원자 저장한다.
- S4 upgrade의 기존 필드 전부 보존 검사를 유지하고, 새 nullable S3 열 NULL 및 capability 부재 검사를 추가했다.

## UI B용 export 계약

| 파일 | export 및 연결 |
|---|---|
| `src/lib/roomLifecycle.ts` | 타입: S3Mode, OwnerTransferState, OwnerTransfer, RoomInviteCode, RoomLifecycleState, S3Mutation, InvitePreview, InviteRejection, InviteJoin, LifecycleInvalidation. API: fetchS3Capabilities/invalidateS3Capabilities, fetchRoomLifecycle, createLifecycleRoom, leaveRoomMember, closeRoom, requestRoomOwnerTransfer, respondRoomOwnerTransfer, cancelRoomOwnerTransfer, rotateRoomInviteCode, roomLifecycleErrorMessage |
| 같은 파일 | cache/구독: subscribeRoomLifecycle, registerRoomLifecycleResources, invalidateRoomLifecycle, roomLifecycleSession, roomLifecycleReadToken. revision은 문자열. 지원 확인 후 writer 부재/오류는 legacy로 우회하지 않음 |
| `src/lib/roomLifecycleController.ts` | createRoomLifecycleController(roomId): getState/subscribe/refresh/leave/close/requestTransfer/respondTransfer/cancelTransfer/rotateInvite/dispose. RoomLifecycleView: state, pending, error, departed, canLeave/canClose/canTransfer, reason, transferState |
| 같은 파일 | confirmedLeaveMessage, doneLeaveMessage, settlementRecipientNotice, SettlementRecipients, prepareRoomSettlement, createRoomSettlementWithSnapshot. 제안 revision/현재 non-NULL 명단을 재확인하고 성공 후 실제 bill을 재조회. 읽기 실패를 제안 명단으로 대체하지 않음 |
| `src/lib/roomInviteController.ts` | createRoomInviteController(): getState/subscribe/setCode/preview/join/tick/dispose. RoomInviteView: code, pending, preview, roomId, inviteRetryAt, retrySeconds, error. 6자 뒤 명시 preview→join, 서버 retry_at과 단조 경과/suspension 기준 countdown |
| `src/lib/rooms.ts` | 기존 createRoom은 S3 서버 생성 / 확인된 legacy만 INSERT. S3 joinRoomByCode는 PREVIEW_REQUIRED이므로 새 UI는 invite controller 사용. RoomMessage.lifecycleEvent: actorId/허용 projection의 actorName/type/transferId. 과거 system 행은 검증 이벤트로 승격하지 않음 |

- cache·추천 ticket invalidate와 realtime unsubscribe를 registry에 등록한다. `departed`는 확인된 성공, `uncertain`은 목록/권한 재조회, `session_ended`는 계정 정리이며 성공 토스트가 아니다.
- 기존 `src/rooms/useMyRooms.ts`와 화면 파일은 이번 A 소유 범위 밖이라 수정하지 않았다. B 또는 메인이 단일 작성자를 정해 홈·일정·채팅 reload, 방 구독 해제, ticket 폐기를 위 계약에 연결해야 한다.
- transferState는 null 및 pending/accepted/declined/cancelled/expired다. 서버 성공 전 배지/접근을 바꾸지 않는다. 실패 뒤 새 revision으로 옛 의사를 자동 재실행하지 않는다.
- SQLSTATE: S3001 미완료, S3002 방장 일반 나가기, S3003 위임 불가, S3004 pending, S3005 재발급 제한. S1/S4 코드 재사용. 초대 예상 거절은 INVITE_UNAVAILABLE/INVITE_RATE_LIMITED/PREVIEW_STALE. raw DB message를 표시하지 않는다.
- configureRoomLifecycle/parser/low-level request export는 테스트·adapter용이며 UI 정책 재구현에 사용하지 않는다.

## 변경 파일

- 앱: `src/lib/roomLifecycle.ts`, `roomLifecycleController.ts`, `roomInviteController.ts` 신규; `src/lib/rooms.ts` 수정.
- migration: 위 표의 신규5개. 기존 migration 수정 없음.
- 보류 정의: `supabase/release/s3_activate_lifecycle.sql`, `s3_schedule_cleanup.sql`, `s3_start_cleanup.sql` 신규.
- DB 검증: `supabase/tests/s3_lifecycle.sql`, `s3_transfer.sql`, `s3_invite_limits.sql`, `s3_acl.sql`, `s3_upgrade.sql`, `s3_settlement.sql`, `s3_hardening.sql`, `s3_inventory.sql`, `s3_fixture.sql`, `s3_sql.ps1`, `s3_concurrency.ps1`, `s3_http.test.mjs`, `s3_release_gate.ps1`, `s3_scheduler.ps1`, 본 보고서 신규; `s4_upgrade.sql` 수정.
- 앱 검증: `tests/roomLifecycle.test.ts`, `roomInviteController.test.ts`, `s3MessageNamespace.test.ts` 신규; `tests/s4RoomProjection.test.js`의 S3 legacy 명시 fixture 추가.

## 환경과 최종 로컬 상태

- 지정 `supabase_db_mealchat_s1_a_20261017` /55322만 사용. 기본54321/54322·원격 Supabase 금지 준수. .env/키/토큰 파일을 열지 않았다.
- Docker 부재 추정은 샌드박스 접근 제한이었다. 권한 상승 후 DockerDesktop 실행 파일과 healthy 컨테이너를 확인했다.
- 첫 S1 upgrade는 자동 검토가 기본 스택 reset 위험으로 거부했다. 실제 Temp 작업 폴더의 project_id=mealchat_s1_a_20261017/API55321/DB55322를 입증하고 실행 전 강제 검사한 재요청은 승인돼 완료됐다. 우회하지 않았다.
- 과거 타 역할 cron 등록의 superuser 의존은 제거했다. 이번 후속에서는 supabase_admin을 사용하지 않고 postgres(rolsuper=false)가 자기 cron을 등록했다. worker는 NOLOGIN·비상속이며 schema CREATE도 설치 중 소유권 이전 직후 회수한다.
- 검증 예약: s3-room-expiry-v1/매분, s3-transfer-expiry-v1/매분, s3-ephemeral-purge-v1/5분. postgres가 실행하고 worker 소유 단일 진입점만 호출한다. 세 작업 실제 succeeded 뒤 full held gate를 rollback 검증했다. 추가 합성 activation에서는 실제 background cron 삭제도 통과했다. 마지막 reset 후 **cleanup OFF, activated_at NULL, get_s3_capabilities 없음, 구 R1/INSERT grant 유지, S3 job 없음**을 확인했다. 운영 예약은 등록하지 않았다.
- 마지막 read-only 확인: 컨테이너 healthy, `cleanup_enabled=false`, `activation_absent=true`, `capability_absent=true`, `legacy_insert=true`, `legacy_r1=true`, `s3_jobs=0`.

## 미해결·운영 전 확인

1. **§5.2 DB 앞단 REST payload 제한의 적용 계층/허용 byte 수가 미정이다.** SQL의 코드 입력64byte·앱 제한은 구현했지만 gateway의 DB 도달 전 body 제한은 구성/검증하지 않았다. 상한·적용 위치·direct bypass 검증이 필요하며 임의 수치/외부 설정 변경은 하지 않았다.
2. UI B 연결, 실제 Auth 발급→HTTP→앱·실기기·접근성·back/foreground·추천 ticket teardown은 별도다. 합성 JWT 통과를 Auth 발급이나 화면 성공으로 주장하지 않는다. UI 캡처는 만들지 않았다.
3. 사용자가 전달한 기존 구현 Claude Sonnet 검토와 후속 재검토 결과는 모두 차단 없음이다. 원격 identity/advisors, 실제 베타 artifact/최소 versionCode·D8 고정 전환일·운영 cron 관측·D9 최종 법률 문안 승인은 미실행이다. 합성 beta 테스트 참조를 운영 증거로 쓰지 않는다.
4. S2 삭제/익명화는 구현하지 않았다. profile FK NULL 시 위임 읽기는 effective expired, worker/후속 mutation이 물리 만료를 처리한다. S2는 room→profile 잠금과 참조/캐시 익명화를 별도 검증해야 한다.
5. `s3_inventory.sql`은 §15 건수 집계만 제공한다. pg_stat_statements 부재/스키마 미확인은 UNKNOWN이며 0회 미사용/안전 승인으로 바꾸지 않는다. 운영 통계/원문을 읽거나 reset하지 않았다.
6. 전체 quality/UI 회귀 실패7건과 lint5개·타입 오류8개는 앞선 실행의 기록이다. A는 해당 화면·UI 테스트·타입 선언·의존성을 수정하지 않았으며 이번 문서 마무리에서 재실행하지 않았다. 독립 재검토는 사용자 전달상 차단 없이 완료됐고, 운영 PG 버전/PG15 분기 검증·최종 법률 문안 승인은 별도 확인이 필요하다.
