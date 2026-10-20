# S4 DB·Edge 인계 (2026-10-20)

기준: Develop / ca88baf. 직접 작업했으며 재위임·stage·커밋·원격 변경은 하지 않았다. 컨테이너는 supabase_db_mealchat_s1_a_20261017/55322만 사용했다. src/**·루트 tests/**·앱 미리보기의 다른 작업자 변경은 보존했다.

## 2026-10-20 최종 승인 보강 — 금액 RPC 회수 및 R3

새 마이그레이션은 **20261020030000_s4_revoke_update_settlement_amount.sql 1개**다. 금액 우회 차단과 R3를 함께 넣었으며 기존 S4 7개 migration 본문·앱·Edge·scripts/test-rpc-additive-compat.ps1의 다른 작업자 변경은 건드리지 않았다. 모든 DB 검증은 supabase_db_mealchat_s1_a_20261017/55322만 사용했다. 커밋·푸시·원격·기본 스택·.env 접근은 없다.

### 변경과 근거

- **미사용 RPC 회수**: `supabase/migrations/20261020030000_s4_revoke_update_settlement_amount.sql:4`. public.update_settlement_amount(uuid,integer)의 PUBLIC/anon/authenticated EXECUTE를 회수했다. 함수 정의는 보존한다. 현재 src/ 및 supabase/functions/ 참조가 없음을 rg로 확인했다. 새 앱 계약/대체 RPC는 없으며 정상 생성·수정은 기존 guarded create_room_settlement_v2/core를 사용한다. 수동 구호출은 42501이다.
- **폐쇄 금액 심층 방어**: 같은 파일 `:8-21`. 기존 private.s1_bill_revision의 공개 종료 불변 검사에 total_amount IS DISTINCT FROM old.total_amount를 추가했다. closed bill 금액 변경은 내부/특권 writer도 S1005다. 기존 timestamp·계좌 종료 검사·event_revision 계산은 유지했다. 실제 solo 1,000원 v2 즉시 폐쇄 사례, retained RPC의 특권 실행, NULL/사후 금액 변경 차단, 동일 금액 no-op, 정상 open bill 수정·새 재정산·leave_room·프로필 삭제 FK 정리를 `s4_amount_revocation.sql:36-70`에서 확인했다.
- **R3 초대 정리**: 같은 파일 `:27-45`. 기존 상태 제약은 pending/accepted/declined/expired다(`20260823072701_harden_settlement_invitation_events.sql:26-30`). private 트리거를 rooms.stage 변경에 연결하여 mark_room_settling과 settle_room_when_all_paid가 settling/done으로 바꾸는 **같은 트랜잭션**에서 pending만 expired/responded_at으로 바꾼다. accepted/declined/expired는 그대로다. 신규 public endpoint나 grant는 없다. 기존 신원·멤버십/방장·room advisory 검사는 해당 room writer가 담당하며 새 내부 트리거는 클라이언트/worker EXECUTE가 없다.
- **기존 방 정리**: 같은 파일 `:43-45`에서 이미 settling/done인 방의 pending도 정리한다. CREATE TRIGGER의 room table lock이 단계 쓰기를 막는 동안 일괄 처리하며, DDL을 기다리는 기존 writer가 room advisory를 보유할 수 있으므로 backfill에서 별도 advisory를 추가로 잡지 않는다. 원래 초대 시각·내용·accepted 상태는 바꾸지 않고 기존 responded_at은 coalesce로 보존한다. 실제 migration 본문을 반복 실행해도 초대 데이터·응답 시각은 무변경이다.
- **수락 계약 유지**: `s4_invitation_cleanup.sql:27,42`. expired로 정리돼도 settling/done 수락은 기존 S4003/hint=operation=membership다. 상태 조회 목록의 pending 조건에서 제외돼 반복 노출이 끝난다. 앱 수정은 없다.

### 이번 변경 파일

1. 신규 `supabase/migrations/20261020030000_s4_revoke_update_settlement_amount.sql`.
2. 신규 `supabase/tests/s4_amount_revocation.sql`, `s4_invitation_cleanup.sql` 및 실행 목록/실제 migration body 복사를 추가한 `s4_sql.ps1`.
3. 기존 `s4_final_review.sql`, `s4_concurrency.ps1`의 pending 유지 기대를 expired로 정정. `s4_upgrade_fixture.sql`, `s4_upgrade.sql`에 기존 settling/done pending 정리·accepted/place pending 무변경·RPC ACL/실제 호출 차단을 추가.
4. `docs/S1-release.md:192`와 `docs/S4-design.md:256-271`의 S4 묶음을 8개로 갱신. 이 보고서 상단의 과거 quality 실패 메모도 해결된 상태로 정정했다.

### 이번 지정 검증 결과

| 실행 | 통과 수 / 결과 |
|---|---|
| s1_local.ps1 -Reset | 새 migration을 포함한 전체 reset + seed 성공 |
| supabase/tests/s4_sql.ps1 | **448/448** (금액 회수 26, 초대 정리 16 포함) |
| supabase/tests/s5_sql.ps1 | **677/677**, 기존 S1 528 + S5 149 |
| supabase/tests/s4_upgrade.ps1 | **43/43**, S4 이전 SQL 677도 통과, 최종 전체 reset 성공 |
| supabase/tests/s1_upgrade.ps1 | **42/42**, 최종 전체 reset 성공. 기존 스크립트의 과거 70개 suite/폐기된 forced-invite grant 차이 검증 유지 |
| scripts/test-rpc-additive-compat.ps1 | **29/29**, fixture rollback, 원본 스크립트 무수정 |
| supabase/tests/s4_http.test.mjs | **52/52**, 실제 PostgREST/JWT, 정리 reset 성공 |
| 추가 s4_concurrency.ps1 | **41/41**, 실제 대기 관측 31·비차단 10. R3의 정산 시작/초대 수락·생성 양방향 경쟁 포함. 최종 전체 reset 성공 |

최종 로컬 catalog: S4 migration 8개, deprecated 금액 RPC authenticated/anon/PUBLIC EXECUTE 모두 false, 폐쇄 금액 보호·초대 정리 트리거 설치. rooms/room_invitations/private.s4_requests는 각각 0건으로 정리됐다. 범위 내 미해결은 없다. 아래 R1·R2는 요청대로 후속 과제로만 남긴다.

최신 앱 quality는 메인이 전달한 **74 suites / 1,354 tests 통과**다. tests/chatE.test.js:290의 과거 실패는 해결됐으며 이번 DB 보강의 미해결 사항이 아니다. 이번에는 위 지정 검증을 실행했고 quality를 다시 실행한 것으로 주장하지 않는다. 실제 Auth 발급/Kong/운영/provider 호출은 검증하지 않았다.

### 후속 과제 — 이번에 변경하지 않음

- **R1**: public.post_room_system_message를 통한 시스템 메시지 위장 경로. S4 회귀가 아닌 별도 권한/메시지 계약 보강 과제로 남긴다.
- **R2**: 방 생성 시 클라이언트 지정 rooms.expires_at의 서버 상한 부재. S4 회귀가 아닌 별도 방 수명 정책 과제로 남긴다.

## 2026-10-20 이전 서버 재검토 기록 — 당시 quality 실패는 해결됨

서버 요청 4건은 반영했다. 당시 앱 quality 실패 1건은 이후 앱 작업자가 해결했으며, 메인이 후속 검증한 최신 결과는 **quality 74 suites / 1,354 tests 통과**다(이 수치는 메인 전달 결과이며 이번 DB 보강에서 quality를 재실행한 결과는 아니다). 중단 시점에는 S4 migration 7개·이전 서버 테스트와 앱 작업자 B의 변경이 같은 작업 트리에 있었다. 기존 재정산 구현은 infinity와 만료 방 복구를 사용했다. src/** 및 루트 tests/**는 수정하지 않았고 커밋·원격 변경·실제 provider 호출도 하지 않았다.

### 수정 근거 / 앱 전달 사항

1. **유한 재정산**: `20261020020000_s4_settlement_restart_lifecycle.sql:4,12,33`. 새 재정산은 min(bill.created_at+7일, 최초 appointment_confirmed_at+30일), 완료는 min(완료+24시간, 최초 확정+30일). 7일은 송금 처리 기간이고, 최초 확정에 고정한 30일은 연속 재정산의 보관 연장을 제한한다. 첫 confirmed 정산의 기존 기한도 절대 상한을 넘기지 않는다. 기존 bill 재시도·완료 true 재시도는 기한을 연장하지 않는다. `20261019022110_s4_confirmed_settlement_boundary.sql:70`은 과거의 긴 expiry가 있어도 최초 확정+30일 뒤 생성을 기존 만료 코드 P0002로 거절한다.
2. **참가 차단**: `20261019022010_s4_activate_atomic_decisions.sql:163,242,328`. 코드 참가·초대 생성·수락은 기존 신원/약관/멤버·초대 대상 권한을 확인하고 방 잠금 뒤 settling/done을 거절한다. **S4003 / hint=operation=membership**, symbol ROOM_MEMBERSHIP_CLOSED. accepted 초대 재수락도 동일하다. 앱은 해당 단계에서 코드 참가·초대 동작을 닫고 이 오류에서 상태를 새로 읽는다. confirmed 이전/해당 단계의 정상 참가 계약은 유지한다.
3. **만료 방 복구 제외**: 같은 lifecycle `:43,52,60`. 대상 조회와 잠금 뒤 모두 expires_at>clock_timestamp()를 확인한다. done의 복구 기한은 가장 오래된 열린 bill 생성+7일과 최초 확정+30일 중 빠른 시각이며, 이미 지났으면 복구하지 않는다. 과거 무기한 settling은 원래 상한으로 기한만 단축하며 상한이 지났으면 즉시 만료 대상으로 둔다. `s4_legacy_place_inventory.sql:34,40`에 만료된 확정 done+열린 bill 및 비유한 expiry 집계를 추가했고 S1-release S4 실행 항목에 기록했다.
4. **만료 중 열린 정산**: `s4_final_review.sql:94`. 방 삭제는 기존 FK ON DELETE SET NULL로 bill을 분리한다. bill·수취인·미완료 상태·S1 송금 정보 권한은 보존한다. 원 수취인이 방 삭제 뒤에도 송금을 완료할 수 있고 전원 완료하면 기존 계좌 공개 종료가 작동한다. 임의 정산 취소/완료 처리는 없다. 명세 §5.6에 기록했다.
5. **이름 / 멱등성**: `20261019022005_s4_decision_core.sql:63,183`. U+3164/115F/1160/2800/00AD/034F 및 공백/ZWJ만 섞인 이름은 S4002. 눈에 보이는 ZWJ 이모지는 허용한다. 기존 나머지 서식·제어문자 차단은 유지한다. 방장 select/confirm의 같은 payload는 현재 권한·core·CAS 검사 후 revision이 그대로이면 ledger를 추가하지 않는다. 무변경 request ID는 저장되지 않으며 outcome=applied, 현재 revision을 반환한다. 저장된 변경 request의 replay/S1007 계약은 유지한다.
6. **infinity 잔존**: Edge `s4Availability.ts:4`, `index.ts:893`의 무기한 허용을 제거했다. migrations/functions/src 실행 소스에 infinity 리터럴은 0개다. 테스트의 과거 데이터 fixture·거절 검증 및 아래 과거 보고서에만 남는다. 새 expires_at은 유한 ISO 시각으로 앱 날짜 파싱 형식 변경은 없다. settling의 expiry는 보관 상한, done은 완료 후 정리 기한이다. 로컬 데이터의 비유한 값은 최종 집계에서 다시 확인했다. 과거 초대의 expires_at 값은 재작성하지 않으므로 기존 무기한 초대 값은 데이터에 남을 수 있으나, settling/done 수락은 기한과 무관하게 거절되고 방 삭제 시 초대도 정리된다. 최종 로컬 초대의 비유한 기한도 0건이다. 운영 데이터는 조회하지 않았다.

### 이번 변경 파일

- migration: `20261019022005_s4_decision_core.sql`, `20261019022010_s4_activate_atomic_decisions.sql`, `20261019022110_s4_confirmed_settlement_boundary.sql`, `20261020020000_s4_settlement_restart_lifecycle.sql` (기존 미커밋 S4 파일 수정; 과거 배포 migration/M7 원본 무변경).
- Edge: `supabase/functions/schedule-recommend/index.ts`, `s4Availability.ts`. issuer 구현은 이번 재검토에서 추가 변경하지 않았다.
- tests: 신규 `s4_final_review.sql`, `s4_restart.sql`, `s4_followup.sql`, `s4_legacy_place_inventory.sql`, `s4_sql.ps1`, `s4_concurrency.ps1`, `s4_upgrade.ps1`, `s4_edge.test.mjs`, `s4_http.test.mjs`, `s1_fixture.sql`, `s1_legacy_rpc_regression.sql`, 이 보고서. S1 fixture는 정산 시작 전 초대를 만들고, 역사적 초대/투표 테스트의 준비 단계를 명시적으로 조정했다. 거절 계약은 새 적대·경쟁 테스트로 검증했다.
- docs: `docs/S4-design.md` §4.2/5.5/5.6/6.1/7, `docs/S1-release.md` S4 항목.

### 검증

| 실행 | 결과 |
|---|---|
| 로컬 db reset / seed | S1+S5+S4 전체 성공, 대상은 55322만. upgrade의 finally 및 HTTP finally 전체 reset도 성공 |
| S4 SQL | **406/406**; restart 29, 신규 final review 40 포함 |
| S1+S5 SQL | **677/677** = S1 528 + S5 149. S4 이전 baseline과 최종 전체 schema에서 각각 통과 |
| S4 upgrade | **37/37**; 실제 inventory 파일을 전/후 실행하고 동일 집계 및 ACL/단계별 활성화 확인 |
| S4 concurrent | **41/41**; 실제 대기 관측 31, 비차단 읽기/쓰기 10. 참가·초대·수락과 정산 시작 양방향 6개 추가 |
| Node Edge / release | **118/118**, skip/기대 실패 없음, 기본 fetch 차단 유지 |
| Deno | 전체 index/import graph check 통과, pipeline **8/8** |
| S4 HTTP | **52/52**; 실제 PostgREST가 settling/유한 7일 기한 및 재완료 기한을 직렬화함을 확인 |
| npm run quality | 당시 실패는 이후 해결. 최신 메인 검증 **exit0, 74 suites / 1,354 tests 통과**. 이번 DB 보강은 아래 별도 지정 검증 결과 참조 |
| quality 나머지 | Jest 실패 뒤 미실행된 Expo 의존성 확인·security:audit는 별도 실행 exit0. 기존 감사 예외 3개 유지 |

**해결된 과거 메모**: 당시 tests/chatE.test.js의 재조회 실패 기대값과 useRoom의 기존 데이터 유지 정책 불일치는 앱 작업자가 해결했다. 더 이상 미해결 차단 사항으로 취급하지 않는다. 최신 quality 결과는 메인 전달의 74 suites/1,354 tests 통과다. 실제 Auth 발급/Kong/provider/운영 데이터는 이번 로컬 테스트 대상이 아니다. 원격 적용 여부는 주장하지 않는다.

아래는 이전 검증 기록이다. **infinity 및 만료 방 복구에 관한 이전 설명은 위 최신 유한 상한 정책으로 대체됐다.**

## 2026-10-20 실제 연결 후속: issuer와 재정산 lifecycle (이전 기록)

진단 근거는 tmp/s4-e2e/REPORT.md의 공개/내부 URL 관찰 및 done+열린 bill 기록과 현재 함수 정의다. 기본 54321/54322 스택은 접근·시작·중지·초기화하지 않았고, 이번 DB 검증은 55322만 사용했다.

### 원인·수정·운영 영향

1. **issuer**: pipeline.ts:100,120은 원래 SUPABASE_URL+/auth/v1을 기대했다. CLI runtime의 http://kong:8000은 통신용 내부 주소이고, Auth가 발급하는 공개 loopback issuer와 달라 401이 재현된다. 기본 호스팅은 https://<project-ref>.supabase.co/auth/v1이므로 플랫폼 SUPABASE_URL이 같은 프로젝트 주소인 표준 구성에서는 이 불일치가 없다. API alias/proxy/self-host처럼 URL을 분리하면 같은 가정이 운영에서도 깨질 수 있으며, custom domain이라고 Auth issuer를 그 도메인으로 바꾸면 안 된다. 실제 운영 환경은 조회하지 않았다.
2. **로컬 수정**: pipeline.ts:86,100 및 index.ts:134. MEALCHAT_LOCAL_AUTH_ISSUER를 서버 운영자가 명시할 때만 기대 issuer를 대체한다. 내부 주소가 정확히 http://kong:8000이고 값이 정확한 localhost/127.0.0.1의 명시적 포트 /auth/v1인 경우에만 허용한다. 다른 호스트/경로/query/fragment/인증정보/범위 밖 포트는 500, 다른 issuer의 토큰은 401. 호스팅 HTTPS에 이 로컬 설정이 주입되면 500으로 닫힌다. 토큰/요청 헤더로 기대 issuer를 만들지 않는다. 기본 호스팅의 기존 정확 일치·withSupabase auth:user 서명 검증·sub/exp/aud/role/비익명·사용자 ID 대조·S1/방 권한을 유지한다. 내부 RPC 주소도 Kong 그대로다.
3. **재정산 원인**: 이전 mark_room_settling은 confirmed INSERT만 옮겨서 done의 새 bill은 done/첫 settled_at/첫 24시간 expiry에 남았다. 이전 완료 트리거도 현재 bill만 검사하고 coalesce(settled_at,now())를 써서 새 lifecycle을 표현하지 못했다.
4. **DB 수정**: 신규 20261020020000_s4_settlement_restart_lifecycle.sql:4,16. owner-confirmed done의 새 bill INSERT만 settling/settled_at=NULL/expires_at=infinity로 재개한다. expires_at은 NOT NULL이므로 PostgreSQL infinity가 기한 해제를 뜻한다. 기존 active bill 수정·동일 요청 재시도는 기한을 연장하지 않는다. 첫 confirmed 정산의 기존 방 기한은 유지한다. 방의 열린 bill 전체에 미완료/빈 수취인 bill이 없어지면 clock_timestamp()와 정확히 +24시간으로 done을 새로 기록한다. 옛 완료 bill의 trigger가 새 진행 bill을 끝내지 못하고, solo INSERT 완료도 유지한다. S1 계좌 종료·고정 수취인은 유지한다.
5. **데이터 보정**: 같은 migration :34. 실제 방장 확정 증거 + done + 공개 종료 전 미완료/빈 수취인 bill인 방만 방 advisory lock 후 다시 검사해 복구한다. 이미 지난 기한이더라도 방이 남은 해당 결함 사례는 복구한다. 미확인 레거시 done·실제 완료 방·계좌·정산 내역은 보존하고 재실행은 무변경이다. 운영에는 새 migration과 이 좁은 보정의 별도 적용 승인이 필요하며 이번에 실행하지 않았다.
6. **Edge/앱 전달**: s4Availability.ts:4 및 index.ts:893에서 PostgreSQL infinity를 무기한으로 해석하고 다른 잘못된 expiry는 계속 거절한다. 앱은 stage=settling에서 완료 카운트다운을 표시하지 않고 expires_at='infinity'를 날짜로 추정하지 않아야 한다. done 완료 뒤에는 새 유한 expires_at이 온다. src는 수정하지 않았다. 로컬 Edge 재연결은 docs/LOCAL-RUN.md의 공개 issuer 설정 절차를 사용하며 provider 키는 넣지 않는다.

공식 근거: [JWT issuer 정의](https://supabase.com/docs/guides/auth/jwt-fields), [SDK 인증 경계](https://supabase.com/docs/guides/functions/auth), [CLI 공개 origin과 내부 Kong 구분](https://supabase.com/docs/guides/ai-tools/byo-mcp), [custom domain과 Auth issuer](https://supabase.com/docs/guides/platform/custom-domains). URL 동일성에 관한 운영 설명은 이 문서와 코드의 비교 조건에 근거하며, 현재 운영 배포 상태 확인을 뜻하지 않는다.

### 이번 변경 파일

- supabase/functions/schedule-recommend/: pipeline.ts, pipeline_test.ts, index.ts, s4Availability.ts.
- 신규 migration 20261020020000_s4_settlement_restart_lifecycle.sql. 이전 migration·M7/release·seed 원문은 수정하지 않았다.
- supabase/tests/: s4_edge.test.mjs, 신규 s4_restart.sql, s4_sql.ps1, s4_http.test.mjs, 이 보고서.
- docs/LOCAL-RUN.md(비밀 없는 공개 설정 파일과 로컬/운영 구분), docs/S4-design.md(상태/expiry/보정 계약), docs/S1-release.md(S4 운영 점검).

### 이번 검증

| 실행 | 결과 |
|---|---|
| s1_local.ps1 -Reset | 전체 S1/S5/S4 7개 migration + seed 성공 |
| s4_sql.ps1 | **365/365**, 신규 restart **26/26**. 실제 cleanup·이전 기한 이후 생존 predicate·새 완료 후 삭제·이전 계좌 종료·solo·다른 열린 bill·동일 완료 재시도·실제 migration 본문 보정/재실행 검사 |
| s5_sql.ps1 | **677/677** = S1 528 + S5 149 |
| Node S4/S5/S1 Edge + release gate | **118/118** (S4 39 + S5 55 + S1 gate 9 + release 15). VM 기본 실네트워크 차단 유지 |
| deno check index 전체 / pipeline_test.ts | exit0 / **8/8**, local issuer 허용·정확 일치·위험한 설정/claim 거절 |
| S4 HTTP | **52/52**. 실제 PostgREST의 settling/infinity 직렬화, 재완료 done/새 유한 기한과 이전 계좌 종료 확인. finally 전체 reset 성공 |
| EXPO_NO_DOTENV=1 EXPO_NO_CACHE=1 npm run quality | **exit0, 72 suites/1,323 tests**, TS/lint/Expo/자산/감사 gate 통과. 기존 감사 예외3개 유지 |

최종 catalog: auth.users/profiles/rooms/s4_requests 각각0, S4 migration7/M7 이력0. 재정산 infinity/방 전체 열린 bill 검사와 두 trigger의 anon/authenticated/service_role EXECUTE 차단을 실제 함수 정의·catalog에서 재확인했다. Git index·release/seed diff는0이고 HEAD는 ca88baf 그대로다. 공백 검사·PowerShell parse도 통과했다.

SQL 초기 실행의 실패는 테스트에서 DB pg_read_file 권한을 가정한 데서 발생했다. 앱/DB 권한을 늘리지 않고 psql client가 실제 migration의 BEGIN/COMMIT만 제거한 본문을 읽도록 바꿨으며, wrapper 제거 확인·rollback을 유지했다. 위 수치는 수정 뒤 전체 재실행 기준이다.

미검증: 54321 실제 Auth/Edge/앱의 재연결과 새 UI 캡처, 실제 공급자 응답/추천 렌더, 변경 후 독립 보안 재검토, 운영 환경/적용/advisors. SDK wrapper는 VM에서 검증된 context를 주입하므로 이 테스트만으로 실제 서명 검증 왕복을 완료했다고 주장하지 않는다. 이번 issuer 재현은 같은 두 URL 입력에서 401→명시 설정 후 S1 gate→키 미설정 500까지, 실제 provider 호출 없이 확인한 것이다. 원격·배포·cron·src 변경·stage/커밋·푸시는 하지 않았다. 아래는 이전 작업 당시의 기록이다.

## 2026-10-20 직접 선택 구간 참석률 추가

별도 `preview_room_meeting_time_v1(p_room_id uuid,p_starts_at text,p_ends_at text,p_time_zone text)`를 추가했다. 기존 others_slots는 합집합이라 같은 사람의 연속 참석수를 복원할 수 없고, 모든 구간을 상태 응답에 싣는 비용을 피하기 위해 선택 구간만 조회한다.

- 구현: supabase/migrations/20261020010000_s4_meeting_time_preview.sql:28. S1 gate·현재 멤버십·만료는 기존 무잠금 read helper(:32)를 사용한다. STABLE/SECURITY DEFINER, 고정 search_path/UTC, authenticated만 EXECUTE(:39). 방장 외 실제 멤버도 조회 가능. 비멤버·탈퇴자·만료·신원 없음은 42501, 미동의 멤버는 S1001이다.
- 공유 검증: 같은 migration :3,18. writer의 시간 검증을 STABLE private.s4_time_keys로 추출하고 preview도 동일 parser/validator를 사용한다. KST 같은 날 11~21시 정각·최소1시간·미래·방 만료 이내. 이름·슬롯·식별자는 반환하지 않는다.
- 앱 전달: 반환은 정확히 `{eligible_count,available_count,all_available,revision}`. revision은 10진 문자열이다. 분모는 NULL-profile/초대 대기자를 제외한 현재 실제 멤버, 분자는 구간 전체에 가능한 같은 멤버 수다. 0명은 정상 preview, writer는 S4006으로 거절한다. all_available은 분모>0이며 분자=분모일 때만 true다. **참석 가능자/전체 인원을 표시한 뒤 방장이 결정하고, 표시한 revision과 같은 구간을 저장한다.** S4005이면 재조회·재확인하고 이전 응답/집계를 새 revision에 자동 연결하지 않는다. 미리보기는 선택 권한/성공 보장이 아니다.
- 명세: docs/S4-design.md §5.1 RPC 계약표·직접 선택 구간 단락·§5.5 오류·§7 migration 목록. docs/S1-release.md S4 점검 항목도 새 migration/preview 흐름으로 갱신했다.
- 변경 파일: 위 신규 migration, docs/S4-design.md, docs/S1-release.md, 신규 supabase/tests/s4_preview.sql, s4_sql.ps1, s4_concurrency.ps1, 이 보고서. src/**·루트 tests/**·이전 migration·Edge는 수정하지 않았다.

| 이번 실행 | 결과 |
|---|---|
| s1_local.ps1 -Reset | 전체 S1/S5/S4 6개 migration + seed 성공 |
| s4_sql.ps1 | **339/339**, 새 preview **48/48** 포함. 다중 사용자, 정확한 4필드, 0/1/2명, 합집합 오류, 초대/NULL 제외, ISO/경계/만료, ACL catalog, 읽기 무변경 |
| s5_sql.ps1 | **677/677** (S1 528 + S5 149) |
| s4_concurrency.ps1 | **35/35** (25 blocker + 10 비차단). 새 4건: preview/동의 쓰기 양방향, held preview→방장 쓰기, room/profile/advisory lock writer→preview의 기존 snapshot. 500ms lock_timeout으로 실제 비차단 확인. finally 전체 reset 성공 |
| EXPO_NO_DOTENV=1 EXPO_NO_CACHE=1 npm run quality | **exit0, 72 suites/1,323 tests**. TS/lint/Expo/자산/감사 gate 통과, 기존 감사 예외3개 유지 |

최종 catalog에서 preview의 STABLE/SECURITY DEFINER/고정 search_path·UTC, authenticated EXECUTE=true 및 PUBLIC/anon/service_role EXECUTE=false를 확인했다. local auth.users/profiles/rooms/s4_requests는 모두0, S4 migration6/M7 이력0이다. Git index·release/seed diff는0, HEAD=ca88baf이며 공백/PowerShell parse 검사도 통과했다.

DB 지정 범위 미해결은 없다. 앱 연결·실제 화면 참석률 표시·변경 후 독립 보안 재검토는 별도 확인 범위다. 원격·배포·cron·커밋·src 변경은 하지 않았다. 아래는 이전 요청 당시의 검증 기록이며 이번 재실행 수치와 구별한다.

## 2026-10-19 재검토 기록

## 재개 시점

기존 미커밋 S4 migration 3개, 별도 NULL 수취인 수정·정산 경계 migration 2개, Edge/SQL/경쟁/업그레이드/HTTP 테스트와 명세가 남아 있었다. 읽기 잠금 제거·시간 없는 place 복구·확정 전 정산 차단은 구현돼 있었다. 이번 요청의 단계만 보는 재정산 조건, 고정 5,000행 상한, 서식 문자 통과, S4008 hint 부재를 확인하고 같은 파일에서 바로잡았다. 과거 S1/S5 migration·M7 release·seed 원문은 수정하지 않았다.

## 이번 변경과 근거

마이그레이션 경로는 supabase/migrations/ 아래다.

| 요청 | 구현 근거 | 검증 근거 |
|---|---|---|
| 1 재정산 | 20261019022110_s4_confirmed_settlement_boundary.sql:5,76. confirmed 또는 appointment_confirmed_at이 있는 settling/done에서 새 bill 허용. 증거 없는 이후 단계는 기존 열린 미완료 bill 재시도만 유지. 트리거의 confirmed→settling 제한은 유지 | s4_review.sql:59: 실제 확정·완료 후 v2/legacy 새 bill 생성과 옛 계좌 종료 유지. s4_followup.sql:45: 증거 없는 settling/done 거절, confirmed_by가 NULL이어도 시각이 있으면 허용. s1_http.test.mjs:86: 레거시 거절과 증거 있는 방 허용 분리 |
| 2 ledger | 20261019022005_s4_decision_core.sql:166. 동일 일정은 기존 stage/시간/CAS 검증 뒤 ledger 무추가. :173: submit만 actor1,000/room1,000×max(5,실제 참가자 수). 참가자 최대 수 제한이 없어 현재 인원으로 동적 확장. 방장 select/confirm은 두 상한에서 제외, 성공 이력 보존 | s4_request_limits.sql:22,39,45,58,63. 새 ID로 같은 일정 20회에도 행/revision 무증가. actor/room 상한을 동시에 채워도 방장 선택·확정 성공. 6인 방 5,000행 이후 제출 성공/6,000행에서 변경 거절 |
| 3 서식 문자 | 20261019022005_s4_decision_core.sql:63. U+200B–200F/202A–202E/2060–2064/FEFF 원문 거절(S4002). 기존 POSIX 공백 trim/제어문자 거절 유지. 추가와 확정이 같은 helper 사용 | s4_followup.sql:10: 16개 전부 단독/중간 총32개 검사. :25: 레거시 bidi 후보의 두 확정 경로 거절과 이벤트/증거 무변경. 실제 HTTP의 각 범위 경계 검사 |
| 4 S4008 hint | 20261019022110_s4_confirmed_settlement_boundary.sql:77은 operation=settlement. M2 :147 및 20261019022010_s4_activate_atomic_decisions.sql:73은 operation=vote_confirmation. 입력 원문은 hint에 포함하지 않음 | s4_followup.sql:13,20: 정확한 code/hint. s4_http.test.mjs: 실제 PostgREST 응답의 두 hint 구분 |
| 5 극단적 레거시 | s4_legacy_place_inventory.sql:29: 미확정 scheduling/place에 공개 종료 전 미완료 bill이 있는 방 수 추가. 만료 방도 포함, 빈 수취인 bill도 포함. 기존 정산 생성 RPC의 수정/재시도 거절 유지 | s4_followup.sql:32: 기존 bill 금액/계좌 무변경. s4_upgrade_fixture.sql:23: 빈/미완료 수취인 각 사례. s4_upgrade.ps1:29: 실제 집계 파일을 이전/이후 스키마에서 실행해 두 방 모두 집계 |
| 6 경쟁·회귀 | s4_concurrency.ps1:204: 시간 미선택 place에서 B 재제출→방장 시간 선택과 반대 순서를 실제 두 세션으로 실행. 변경 승자는 보존, 대기자는 S4005, 새 revision의 legacy 재시도도 선택 뒤 S4003 | 아래 전체 로컬 재현·회귀 결과 |

기존 보강도 유지한다: 읽기 3개 RPC는 STABLE snapshot·무잠금, 시간 미선택 place만 본인 일정 편집 가능, NULL-profile 표시행은 새 정산 수취인·정족수에서 제외. 모든 공개 쓰기는 S1 gate·신원·멤버십·행위별 방장 권한·기존 잠금 순서·고정 search_path·좁은 grant를 유지한다.

## 앱 전달 사항

1. 새 bill 진입: confirmed 또는 **settling/done이면서 confirmation_status=owner_confirmed**. 레거시 미확인 settling/done은 새 bill 불가, 기존 열린 bill 재시도는 유지한다. 이전 bill의 닫힌 계좌는 다시 공개하지 않는다. 초기 확인 시 stage만 검사하던 src/lib/roomSettlementPolicy.ts:6은 최종 읽기 확인에서 B가 ownerConfirmed 인자를 받도록 갱신했다. ChatRoomSheets.tsx:69,99도 확정 증거를 전달한다. 앱 수정은 B의 작업이며 이 작업자가 변경하지 않았다.
2. S4008 분기는 **hint=operation=settlement / operation=vote_confirmation** 사용. message 문자열에 의존하지 않는다. 기존 미확인 정산 enum과 place의 permissions.can_submit도 계속 필요하다.
3. 동일 일정 새 ID 제출은 applied/현재 revision을 반환하지만 ledger 행/ID를 저장하지 않는다. retained ID의 replay/S1007은 유지한다. 무변경 요청 이후 방 revision이 바뀌면 기존 expected revision의 재시도는 S4005다. DTO 모양·RPC 시그니처·반환 타입은 바꾸지 않았다.
4. S4011은 일정 변경 이력에만 적용한다. 사용자 전체1,000/방1,000×max(5,실제 인원). 방장 시간 선택·확정은 제외하며 그 결정 이력은 유지한다. 동일 일정 재제출도 공간을 소비하지 않는다. cron·기간 삭제는 추가하지 않았다.
5. 후보 이름의 위 Unicode 서식 문자는 S4002. 원문을 삭제·변조해 다른 이름으로 자동 확정하지 않는다.

명세 docs/S4-design.md:100,193,199,203,242 및 운영 점검 docs/S1-release.md:188을 갱신했다. 집계 출력은 다섯 건수뿐이며 사용자/방 식별자·일정·계좌 원문을 출력하지 않는다. 운영에서는 실행하지 않았다.

## 이번에 변경한 파일

- docs/S4-design.md, docs/S1-release.md.
- 기존 미커밋 migration: 20261019022005_s4_decision_core.sql, 20261019022010_s4_activate_atomic_decisions.sql, 20261019022110_s4_confirmed_settlement_boundary.sql. 새로운 migration 번호는 추가하지 않았다.
- supabase/tests/: s1_http.test.mjs; s4_fixture.sql, s4_sql.ps1, s4_review.sql, s4_request_limits.sql, **s4_followup.sql(신규)**, s4_concurrency.ps1, s4_upgrade_fixture.sql, s4_upgrade.sql, s4_upgrade.ps1, s4_http.test.mjs, s4_legacy_place_inventory.sql, 이 보고서.
- 앞선 S4 저장소/Edge 및 다른 S1/S5 회귀 보강 파일은 그대로 유지했다.

## 이번 실행 검증

HTTP는 로컬 임시 PostgREST와 실행마다 생성한 합성 RSA/JWT를 사용한다. Auth 발급·실 사용자 토큰·외부 provider 호출 없이 수행했다. Edge VM의 기본 실네트워크 차단을 유지했다. DB fixture는 rollback 또는 전체 reset으로 정리한다. skip/기대 실패는 없다.

| 실행 | 결과 |
|---|---|
| s1_local.ps1 -Reset | 전체 migration + S1/S5/S4 + guarded seed 성공 |
| s4_sql.ps1 | **291/291** = 16+84+40+42+12+30+20+47 |
| s5_sql.ps1 | **677/677** = S1 528 + S5 149 |
| s4_concurrency.ps1 | **31/31**: 실제 blocker25 + 비차단 읽기/쓰기6. 기존 수기 요약의 1건 과다 집계를 바로잡음 |
| s4_upgrade.ps1 / s4_http.test.mjs | **37/37 + 50/50**. 업그레이드 전 S1/S5 SQL677도 통과 |
| S1/S5 경쟁 / HTTP | **8/8 + 13/13**, **35/35 + 38/38** |
| S1/S5 upgrade | **42/42 + 13/13** |
| M7 활성화 / 보류 guard / seed | SQL **38/38** + hash **3/3** + 실제 경합 **3/3**, 보류 guard **4/4**, seed guard **19/19**, generator 일치 |
| node --test S4/S5/S1 Edge·release gate | **106/106** |
| deno check index 전체 import graph / pipeline_test.ts | exit0 / **6/6** |
| EXPO_NO_DOTENV=1 EXPO_NO_CACHE=1 npm run quality | **exit0**, **72 suites/1,272 tests**, TS/lint/Expo/자산/감사 gate 통과. 기존 감사 예외3개 유지. B 동시 변경 후 최종 재실행 기준 |

추가 HTTP 검증의 초기 실패는 void RPC의 성공 상태를 200으로 가정한 테스트 오류였다. 실제 204를 확인하도록 수정했고, 완료된 수취인은 반복 호출하지 않고 미완료 수취인만 완료시킨 뒤 재정산/기존 계좌 종료까지 재검증했다. 아래 미해결 사항과 구분한다.

최종 로컬 catalog: auth.users/profiles/rooms/private.s4_requests 모두0, S4 migration5/M7 이력0, current 문서4/bundle=mealchat-local-dev-r2. stable read graph·인원 비례 상한·방장 확정 증거 predicate·private helper EXECUTE 차단을 실제 함수 catalog에서 재확인했다. 운영용 집계 SQL은 로컬 0/0/0/0/0을 반환했다. M7/release/seed 원문과 Git index의 diff는0, HEAD는 ca88baf 그대로다. tracked/untracked 공백 검사·PowerShell parse도 통과했다.

## 미해결·검증 경계

DB·Edge 지정 범위의 미해결 사항은 없다. 앱 재정산 진입 코드는 B의 반영을 읽기 확인했으며, hint 소비·실제 DB 통합은 B의 확인 범위다. src/**는 읽기만 했다. quality 통과는 새 DB 계약의 실제 앱 왕복·렌더링 성공 증거가 아니다. 변경 후 독립 보안 재검토, 실제 Auth/Kong/배포 Edge/Tmap/Gemini, 운영 집계·advisors는 수행하지 않았다. 원격·배포·cron·커밋은 하지 않았다.
