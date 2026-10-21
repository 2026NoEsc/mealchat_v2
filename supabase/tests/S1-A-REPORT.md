# S1 작업자 A: 로컬 seed / 배포 M7 분리 인계 (2026-10-17)

## seed 운영 오실행 방어·M7 시행일 검토 권장 반영 (최신)

변경 파일: supabase/seed.sql, supabase/tests/s1_seed.mjs, 신규 supabase/tests/s1_seed_guard.test.mjs, supabase/release/check.mjs, supabase/tests/s1_release_gate.test.mjs, 이 보고서, docs/S1-release.md(요청된 금지 문장 한 줄만). 앱·migration/M7 원문·.env·원격·커밋은 다루지 않았다.

- seed.sql:6~14의 초입 preflight와 :96~104의 게시 잠금 뒤 재검사에서 **55000 / S1_LOCAL_SEED_NONLOCAL_STATE**로 중단한다. 알려진 local-dev 문서 4개와 mealchat-local-dev-r2 외의 버전은 거절한다. 기존 사용자·프로필·동의 사건이 하나라도 있어도 거절하므로, 데이터가 있는 로컬 DB에 seed만 재실행하는 용도가 아니다.
- 예외는 **2026-08-17 레거시 bootstrap 번들 한 행**이다. 20260817144252_terms_consent_records.sql:32~34가 새 로컬 reset에도 만들며, M1:34~37은 문서 연결·게시 열만 추가하고 행을 보존한다. 실제 전용 로컬에서 service_document_id/privacy_document_id/published_at=NULL, change_summary=''를 확인했다. 이 원형이 유지되고 auth.users/profiles/profile_consents가 모두 비어 있을 때만 허용한다. published/linked legacy 또는 사용자 데이터가 있는 상태는 거절 테스트로 확인했다. 로컬 bootstrap의 effective_from은 구 migration의 now() 기본값이므로 고정 날짜로 판별하지 않는다.
- check.mjs:9~10,41~43은 개인정보 2판 시행 시각이 1판(2026-10-01 00:00 KST = 2026-09-30T15:00:00Z)보다 **엄격히 뒤**인지 검사한다. 알려진 s1_m7_test_values.json의 version/hash/원문 및 명시적 Synthetic/NEVER publish 원문 제목은 거절한다. version의 날짜도 KST 시행일과 일치해야 한다. 이 검사는 migrations에 M7이 있을 때 개발 검사에도 적용한다. 별도 로컬 M7 테스트 주입 경로는 유지했다.
- docs/S1-release.md에 **운영에는 db push만, --include-seed·db reset --linked 금지**를 추가했다.

이번 검증:

| 명령/검사 | 결과 |
|---|---|
| s1_local.ps1 -Reset | npipe Docker의 전용 55322에서 M1~M6 + guarded seed 전체 db reset --local 성공 |
| node supabase/tests/s1_seed_guard.test.mjs | **19/19**: 운영 draft/current 문서·번들, 위장 local-dev, 변형 legacy, 사용자 존재, 게시 잠금 후 재검사; 거절 후 row/current flag 동일, 전체 테스트 롤백 확인 |
| node --test supabase/tests/s1_release_gate.test.mjs | **15/15**: 1판 이전·당일 거절/다음 날 통과, 2020 fixture 거절, fixture 날짜만 바꾼 원문 거절, 날짜/version 일치 |
| 관련 SQL 8개 | **528/528**: seed 12, 행동 160 + plain 160, 보안 31, ACL 66, legacy RPC 70, Realtime 16, 닫힌 정산 13 |
| npm run release:check | exit 1 / S1_RELEASE_M7_REQUIRED — 미확정 M7 보류 상태에서 의도한 실패 |
| node supabase/release/check.mjs --development | exit 0 — 로컬 개발 계속 가능 |
| seed generator --check / node --check / git diff --check | 통과 |

보호 한계: seed guard는 데이터 상태를 검사하며 원격 대상 여부를 증명하는 장치가 아니다. 원격 reset이 이미 데이터를 지워 로컬 초기 상태와 같아진 뒤에는 데이터 검사만으로 구분할 수 없고, seed는 reset의 선행 삭제도 취소할 수 없다. 따라서 해당 원격 reset 자체는 금지한다. 이번에는 원격 명령을 실행하지 않았다. 전체 npm run quality는 이번 요청의 완료 기준에 없어 재실행하지 않았으며 아래 이전 실행 기록은 당시 결과다.


## M3 취향게임 답 삭제 결정 반영 (추가 인계)

**데이터 삭제: profile_private.tastes(취향게임 답) 전량, 이전 없음**. M3의 6개 boolean backfill을 제거했다. 모든 기존 tastes는 '{}'로 지우며 빈값 제약·직접 UPDATE 권한 회수는 유지한다. 새 음식 저장소 행도 migration에서 만들지 않는다. 기존 답을 다른 저장소·로그·archive로 복제하지 않는다. 운영 적용은 하지 않았다.

backfill 제거만 하면 기존 사용자의 saveTastes가 조회 단계에서 23503으로 막히므로 M3의 get/save RPC도 함께 보완했다. 필수 약관 gate 뒤 음식 행이 없으면 기존 응답 형식의 빈 preferences/revision='0'을 읽기만 하고, save는 프로필 잠금·입력 검증 뒤에만 빈 행을 생성하고 revision CAS로 새 답을 저장한다. 잘못된 입력·stale 첫 저장은 행 생성까지 롤백한다. 앱 RPC 이름/인자/응답 형식은 그대로이며 앱 파일은 수정하지 않았다.

변경 파일: M3 SQL, s1_upgrade_assertions.sql, s1_m7_upgrade_assertions.sql, 이 보고서, docs/S1-release.md 운영 삭제 항목, docs/S1-design.md 11장 2번 문단. 배포 M7은 release/에 그대로 보류한다.

이번 검증(기존 기록과 구분):

- 연결 대상은 Docker npipe의 supabase_db_mealchat_s1_a_20261017/55322로 확인했다. 기존 mealchat_v2/54322와 원격은 접근하지 않았다.
- powershell -NoProfile -ExecutionPolicy Bypass -File supabase/tests/s1_local.ps1 -Reset: 저장소 migration+local-dev seed 전체 reset 성공.
- powershell -NoProfile -ExecutionPolicy Bypass -File supabase/tests/s1_upgrade.ps1: **42/42**(기존 34 + 첫 입력 회귀 8). 기존 tastes가 있던 행에서도 새 음식 행 없음·tastes='{}'; 실제 authenticated JWT 재동의 뒤 빈 조회/실패 시 무변경/6키 첫 저장 통과. 마지막 기본 seed reset도 성공.
- 로컬 psql에서 s1_local_seed 12, s1_consent_visibility 160, plain 160, s1_security_regressions 31, s1_acl_inventory 66, s1_legacy_rpc_regression 70, s1_realtime_payload 16, s1_closed_settlement 13: **합계 528/528**. 각 SQL은 롤백하며 최종 auth.users=0, profile_food_preferences=0, current 문서 4개 모두 local-dev.
- npm run quality(EXPO_NO_DOTENV=1): 라이선스 24·게이트 회귀 11·assets·TypeScript 통과 뒤 앱 src/auth/pendingSignupProfile.ts:18의 import/first 경고 1건으로 lint exit 1. 앱 파일은 수정하지 않았다. 전체 quality 통과로 보고하지 않는다.
- 별도 npm test -- --ci --runInBand: **58/60 suites, 1,052/1,054 tests 통과; 2건 실패**. tests/passwordReauthentication.test.js:187은 legacy marketing_opt_in metadata 기대값 불일치, tests/s1Screens.test.js:90은 LegalDocumentSheet 1개 기대/2개 조회다. 모두 앱/앱 테스트 경계이며 이번 수정 파일이 아니다. 원인 수정은 B/메인 범위로 남긴다.
- 별도 npx expo install --check(EXPO_NO_DOTENV=1, EXPO_NO_CACHE=1) exit 0; npm run security:audit exit 0(기존 임시 예외 3개 유지). 이번에는 Expo EPERM 없이 통과했다.
- git diff --check 및 node supabase/tests/s1_seed.mjs --check 통과.

수정 근거: M3:26~29(이전 삭제·빈값/권한 유지), M3:52~74(빈 조회·명시적 첫 저장), s1_upgrade_assertions.sql:4~5(기존 답 삭제), s1_m7_upgrade_assertions.sql:17~24(JWT 첫 저장), docs/S1-release.md:48(운영 삭제 고지), docs/S1-design.md:573(11장 결정).

문서 범위: 11장 문단만 추가 허용되어 5장 M3 표와 6.3절의 예전 취향 이전/빈 행 보충 서술은 수정하지 않았다. 해당 두 곳은 확정 결정과 맞지 않으므로 메인 문서 정리가 남아 있다. 이번 M3 변경의 독립 검토는 메인에서 이어서 수행해야 한다.


## 현재 구조와 소유 범위

M7은 **supabase/release/20261017100000_s1_activate_terms.sql**로 이동했다. migrations에는 085900+M1~M6만 남는다. M7 상단 7~17행 PRIVACY RELEASE CONSTANTS의 version/edition/effective_from/content_hash/canonical_content 한 블록과 자리 표시/미래 시행일 거절 guard는 보존했다. 이전 로컬 seed/M7 분리 작업은 M1~M6 SQL과 앱 src/**를 변경하지 않았다. 이번 M3 수정은 위 추가 인계를 따른다. 추가 허용된 package.json의 quality/release:check 연결 및 docs/S1-release.md, docs/LOCAL-RUN.md의 해당 절차만 수정했다. 재위임·원격·.env 읽기·cron 등록·배포·커밋 없음.

## 새 실행·배포 절차

- **로컬:** npx supabase db reset --local. root config.toml은 원래부터 [db.seed] enabled=true, sql_paths=["./seed.sql"]였으며 의미는 유지하고 설명만 추가했다. 기존 seed.sql은 없어서 새로 만들었다. M1~M6 뒤 seed가 네 local-dev 문서와 mealchat-local-dev-r2 번들을 게시한다. 사용자/동의 사건은 만들지 않는다. 새 로컬 계정은 S1 약관 화면에서 명시적으로 동의한다.
- **보류:** production M7은 release/에 두며 null 값을 그대로 실행하면 22023/S1_ACTIVATION_CONFIGURATION_REQUIRED. 시행 전은 S1006이다. 일반 로컬 reset에는 이 파일이 들어가지 않는다. --no-seed reset은 현재 개발 상태에서 S1006을 남기므로 앱 확인용이 아니다.
- **quality(정정 지시 반영):** M7 존재를 강제하지 않는다. migrations에 M7이 있을 때 미확정 상수/깨진 hash 등을 거절한다. 배포일까지 도달하거나 승인 생성 문서가 있어야 한다는 조건도 개발 검사에는 적용하지 않는다. 로컬 seed 일치 검사와 배포 게이트 회귀를 함께 실행한다.
- **운영 첫 단계:** npm run release:check. M6이 있으면 migrations에 확정 M7이 반드시 있어야 하고, local-dev/자리 표시/미래 시행일/앱 생성 원문·hash 불일치/중복 보류 사본이면 실패한다. 현재는 M7 미승격으로 S1_RELEASE_M7_REQUIRED 실패가 정상이다. 값 확정(실제 앱 배포일+7일 KST, 개인정보 2판)→template 상단 갱신→시행 시각 이후 migrations로 이동→release:check 성공→독립 검토·개별 승인→M1~M7 연속 적용 순서다. 실패하면 M1~M6만 먼저 반영하지 않는다.
- 엄격 검사는 읽기 전용이며 원격 CLI를 가로채지 않는다. 따라서 수동 SQL/CLI도 문서화한 배포 게이트와 개별 승인 경로를 따라야 한다. 개발 quality 통과를 배포 허가로 간주하지 않는다. 일반 push는 seed를 포함하지 않지만 --include-seed는 포함할 수 있으므로 운영에서 금지한다.

## 테스트 경로와 검증

55322의 전용 로컬 Docker npipe 컨테이너를 확인했다. 기존 mealchat_v2/54322는 reset하지 않았다. TEMP 격리 프로젝트에는 저장소 migration과 **seed.sql 원문을 그대로 복사**하고 포트/서비스 구성만 격리했다. 별도 M7TestValues 플래그 없이 CLI db reset --local이 성공했다. seed는 node supabase/tests/s1_seed.mjs로 생성하고 --check로 drift를 검사한다. 배포 M7 주입본은 TEMP/supabase/tests/m7-test.sql에만 두며 migration 입력에는 넣지 않는다.

| 이번 구조 변경의 검증 | 결과 |
|---|---|
| s1_local.ps1 -Reset | 기본 M1~M6 + seed 전체 재구성 성공 |
| s1_local_seed.sql | 12/12: anon S1 manifest, local-dev 4문서, 신규 계정 pending→가입→데이터 접근, 자동 동의 없음 |
| s1_m7_activation.test.mjs | SQL 38/38 + hash 일치 3/3 + 실제 게시/철회 경쟁 3/3, cleanup은 기본 local-dev seed reset |
| 전체 SQL | 행동 160, 동일 plain 160, 보안 31, ACL 66, S1 legacy RPC 70, Realtime 16, 닫힌 정산 13 모두 통과 |
| s1_release_gate.test.mjs | 11/11: 개발 M7 생략 허용, 존재 시 자리 표시 차단, 별도 배포 M7 필수, 승인 원문/시간/hash/seed 혼입 차단 |
| npm run release:check | exit 1 / S1_RELEASE_M7_REQUIRED: 현재 개발 저장소의 의도한 배포 차단 |
| s1_m7_guard.ps1 | 4/4: 기본 reset 성공 + 미확정 보류 M7 거절·무변경 |
| s1_upgrade.ps1 | 34/34: preflight/085900 단독 전후/M7 레거시 보존·무 backfill |
| s1_concurrency.ps1 | 8/8: 철회·save·정산 완료/되돌림·계좌 읽기 경쟁 |
| s1_http.test.mjs | 33/33: 실제 로컬 PostgREST/JWT, S1 가입·재동의 경로 |
| s1_edge_gate.test.mjs | 9/9: 누락 설정·동의 gate·handler 타입 검사 |

최종 검증 명령은 PowerShell에서 `$env:EXPO_NO_DOTENV='1'; npm run quality`였고 **exit 0**이다. 라이선스 24개·배포 게이트 회귀 11개·assets·TypeScript·lint·Jest **60개 스위트/1,033개 테스트**·Expo 의존성 검사·보안 감사 게이트가 모두 통과했다. 감사의 기존 임시 예외 3개는 유지됐다. 최초 quality는 소유 범위 밖 B 정산 화면 hook cleanup 경고 3건으로 중단됐으나, B 수정 후 최종 재실행에서는 lint도 통과했다. 앱 파일은 수정하지 않았다.

최종 로컬 카탈로그 확인: 085900+M1~M6 이력 7개, M7 이력 없음, current 문서 4개 모두 local-dev, auth.users/profile_consents 각각 0개. 테스트 후 기본 seed 상태로 복원됐다. 근거: supabase/seed.sql:1,79; supabase/release/check.mjs:21~46; package.json:27~28; docs/S1-release.md:3,29~54; docs/LOCAL-RUN.md:90~112.

## 이번 변경 파일

- 이동: supabase/migrations/20261017100000_s1_activate_terms.sql → supabase/release/20261017100000_s1_activate_terms.sql
- 추가: supabase/seed.sql, supabase/release/check.mjs, supabase/tests/s1_seed.mjs, supabase/tests/s1_release_gate.test.mjs, supabase/tests/s1_local_seed.sql
- 수정: supabase/config.toml, supabase/tests/s1_local.ps1, s1_m7_local.mjs, s1_m7_guard.ps1, s1_m7_activation.test.mjs, s1_upgrade.ps1, s1_concurrency.ps1, s1_http.test.mjs, S1-A-REPORT.md
- 추가 허용: package.json(quality 한 줄 + release:check), docs/S1-release.md(M7 이동/배포 첫 gate), docs/LOCAL-RUN.md(로컬 Supabase 절차)

## 미해결·증거 한계

처리방침 2판 최종 version/시행일/canonical/hash는 미확정이다. M7은 아직 운영 반영할 수 없다. 실제 Auth 이메일 발급/확인/Kong/실기기 가입 E2E와 운영 Realtime 실측은 미검증이다. 운영 085900 직접 SQL 적용은 사용자 인계이며 작업자가 원격에서 확인하지 않았다. 이번 seed/배포 게이트 변경은 새 검토 대상이다.

아래는 앞선 S1 구현·재검토 근거를 보존한 기록이며, M7 경로와 로컬 reset의 **현재 절차는 위 내용이 우선**한다.

**Realtime 한계:** 로컬 realtime.apply_rls의 DELETE는 행 RLS를 적용하지 않아 public.participants/public.notifications/public.rooms 각각에서 **무관한 로그인 사용자와 약관 미동의(pending) 사용자 모두** 전달 대상으로 분류됐다. 두 그룹 각각 3건의 old_record에는 PK인 id(UUID)만 있고 record는 비어 있다. 이름·방 ID·프로필 ID·메시지·계좌 등 행 내용은 없다(이벤트 및 열 정의 메타데이터는 별도). anon도 3건에서 전달 대상으로 분류되지만 old_record는 JSON null이었다. 이는 upstream 동작이며 S1이 apply_rls 구현을 바꾸지 않았음도 upgrade 검사로 확인했다. S1 회귀나 전체 약관 gate 보장을 뜻하지 않는다. 기존 인계의 사용자 수용 기록은 pending의 PK-only 한계에 관한 것이며, 확대 확인 결과를 새로 수용받았다고 주장하지 않는다. 운영 반영 뒤 실제 운영 Realtime 버전에서 실측해야 한다.

원격 Supabase, .env 읽기, link/db push/migration repair/Management API, 원격 URL·키 사용, 새 cron 등록, 배포, 커밋·푸시는 하지 않았다. 기존의 202608~202609 migration 파일은 편집하지 않았다. M1~M6 변경은 이전 작업자가 작성한 상태를 이어받아 검증했다. 이번 추가 수정은 Realtime 테스트와 이 보고서다. src/**·App.tsx·tests/** 및 허용된 단일 파일 외 scripts/**는 편집하지 않았다.

## 이어받은 시점 진단

- Develop, HEAD 34a3367. Git status에는 B의 앱 변경과 A의 미추적 migration/테스트가 함께 있었다. 기존 변경을 초기화하거나 stage하지 않았다.
- 마지막 수정 시각(2026-10-17 KST): M1 20261017090000과 M5 20261017094000은 09:48:40, s1_upgrade.ps1은 09:49:54, s1_concurrency.ps1은 09:50:43.
- 이미 들어 있던 변경: M5의 닫힌 bill 완료 취소 거절, M1 BEFORE TRUNCATE 트리거, 닫힌 정산/보안/HTTP/경쟁 테스트, 원본 70개 RPC 본문 복원, standalone hotfix 전후 비교, Realtime의 rooms/무관 사용자/anon 검사. PowerShell parser는 정상이며 전체 reset에서도 migration 문법 오류가 없었다.
- 실제 미완료 결함: 추가된 anon DELETE의 JSON null old_record에 기존 객체 삭제 연산을 적용하여 Realtime 테스트가 `cannot delete from scalar`로 중단됐다. s1_realtime_payload.sql:41,45에서 객체일 때만 키 연산을 수행하도록 수정했다. 인증 사용자 PK-only와 anon null 검사는 별도로 유지했다. 보고서의 과거 수치·완료 취소 허용·Realtime 설명도 갱신했다.
- 원본 20260823_rpc_hardening.sql은 `git diff --quiet HEAD -- <파일>` exit 0으로 HEAD 본문과 동일함을 확인했다. Git status의 M 표시는 남아 있으나 본문 diff는 없다. S1 adapter include로 교체하지 않았다.

## 닫힌 정산 오류 계약 및 명세 수정 제안

M5:80~82는 bill/멤버 잠금과 권한 재확인 뒤 `payment_disclosure_closed_at IS NOT NULL AND completed=false`를 **S1005 / SETTLEMENT_DISCLOSURE_CLOSED**로 거절한다. 기존 S1005를 확장 사용하므로 새 코드 번호는 추가하지 않는다. 미완료 열린 bill은 완료 취소 가능하고 닫힌 bill의 completed=true 재호출은 성공한다. 실패 시 멤버 상태는 유지되어 leave_room의 미완료 정산 차단 조건에 새 장애를 만들지 않는다. 방 삭제 후 남는 닫힌 snapshot도 취소할 수 없다.

docs/S1-design.md는 소유 범위 밖이므로 수정하지 않았다. 메인에게 8.1 오류표의 S1005 앱 처리를 **"계좌 제거·송금 비활성; 닫힌 정산의 completed=false도 거절. 정산 상태를 다시 읽고 완료 표시를 유지"**로 확대하고, 3장의 완료 취소 허용 문장 및 정산 RPC 설명도 이 결정에 맞추도록 제안한다. 근거: M5:65~85, s1_closed_settlement.sql:15~38, s1_concurrency.ps1:75~79, s1_http.test.mjs:81~82.

## 차단 3건의 수정 근거

1. 강제 방 입장 RPC 폐쇄: supabase/migrations/20261017085900_revoke_invite_friend_to_room.sql:3 에 정확한 시그니처의 PUBLIC/anon/authenticated EXECUTE 회수만 분리했다. S1 테이블/함수 의존성이 없고 pre-S1 DB 단독 적용을 검증했다. M6의 unsafe 함수 재정의도 제거했다. 초대는 create_room_invitation/accept_room_invitation을 사용한다. s1_security_regressions.sql:15~18 및 HTTP 검증에서 일방향 follows 뒤 강제 호출은 42501, 참가자 미생성, relationship=identity_only, public 생년월일/계좌도 미반환을 확인했다. **사용자 인계에 따르면 운영에는 같은 REVOKE가 SQL Editor로 직접 적용됐다. 운영 migration history에는 없으며 이후 승인된 push에서 멱등 재적용한다. 작업자는 원격 조회로 검증하지 않았다.**
2. FOUND 보존: M5/M6의 row-lock SELECT 뒤에 삽입됐던 PERFORM이 FOUND를 덮는 12곳을 수정했다. IF NOT FOUND(또는 not found OR expiry)를 먼저 판정하고, 분기 진입 시/정상 진행 시 각각 잠금 후 약관 gate를 실행한다. M6 join/create invitation/accept(2)/decline/leave/add/remove/toggle(2)/confirm, M5 create_room_settlement_impl가 대상이다. 대표 근거: M6:49, M6:332, M6:617, M5:155. s1_security_regressions.sql:19~24에서 비멤버 toggle=42501, 없는 방 leave=gone, 없는 초대 decline=P0002 등 원래 의미를 확인했다. 전체 S1 migration에 위험 패턴 grep 결과 0건이다.
3. 부분 S1 적용 방지: M1:3~11의 읽기 전용 preflight가 모든 S1 DDL/default ACL/data 변경보다 먼저 실행된다. 미분류 키, 비-object JSON, gender 값/타입, bio 타입/길이, 범위 밖 birth_date를 검사한다. M4의 뒤늦은 blocker는 제거했다. s1_upgrade.ps1은 6개 잘못된 fixture마다 실패 전후 전체 public/private 관계·열·함수·제약·정책·ACL 및 pg_default_acl fingerprint가 동일하고 consent_documents/states/requests가 없음을 확인한다. 독립 085900 권한 회수는 S1과 별개라 preflight 실패 후에도 유지되는 것이 의도다.

## 권장 10건의 반영

| 항목 | 구현 및 증거 |
|---|---|
| 1. 닫힌 정산 뒤 새 요청 | M5:167 활성 bill 검색에 payment_disclosure_closed_at IS NULL. 닫힌 bill의 completed=false는 S1005로 거절하여 미완료 수취인이 남지 않음. 새 명시 요청은 새 UUID의 bill 생성. SQL/HTTP/대기 중 취소 경쟁 및 leave_room 검증 |
| 2. default ACL 운영 영향 | M1:13~21에 명시. postgres의 이후 전역 함수 및 해당 schema 객체는 service_role 포함 명시 GRANT 필요. 별도 승인된 운영 반영 전에 **운영 pg_default_acl 사전 확인** 필요. 이번에는 원격 조회하지 않음 |
| 3. policy initPlan | M6:3~19의 USING/WITH CHECK를 (select private.has_current_terms_consent())로 감쌈. VOLATILE은 의도적으로 유지: clock_timestamp 기한과 잠금 대기 뒤 최신 동의/철회를 다시 읽어야 하므로 STABLE snapshot으로 고정하지 않음. 각 정책 표현식의 initPlan 평가를 사용 |
| 4. 비활성 건강 코드와 재동의 | M3:31~43. consent_event_id만 바뀌고 배열·data revision이 그대로인 rebind는 이미 검증된 원문을 보존하며 catalog 재검사 생략. 새로운 save는 비활성 코드 거절. 새 동의 유효성/본인/event 일치는 계속 검사. SQL:34~36 |
| 5. service_role INSERT | M4 CHECK를 엄격한 inline 검증으로 구성하여 authenticated의 private validator EXECUTE를 회수해도 본인 UPDATE 가능. service_role에 두 순수 validator EXECUTE만 명시. private schema 일반 USAGE를 새로 열지는 않음. 실제 SQL 역할 및 service JWT HTTP INSERT 성공, 건강 직접쓰기 거절 |
| 6. manifest 문서 ID | M2:108~112. 검증한 manifest의 kind+version+content_hash+공개/시행/current 조건으로 document_id 조회, FOR SHARE, 없음은 S1002. manifest 검증 뒤 현재 privacy/bundle이 바뀌는 interleaving을 test-only trigger로 만들어 S1002와 사건/request ledger 원자 롤백 확인(SQL:54~78) |
| 7. 잠금 전 권한 | M5:43~53 가시성 확인 후 advisory/room/bill 잠금, 잠금 뒤 재확인. read helper는 FOR NO KEY UPDATE. mutation도 본인 member/creator 권한을 먼저 확인하고 잠금 뒤 반복 검사. 없는/비가시 bill은 모두 P0002. 비참여자의 기존 set_settlement_completed 오류도 존재 은닉을 위해 P0002로 통일 |
| 8. legacy 형식/inventory | M1 preflight에 gender와 birth_date 추가. s1_personal_data_inventory.sql은 key/type 및 잘못된 형식 count만 반환. M4:28 trigger는 관련 열 변경에만 실행하여 push_token 같은 무관한 UPDATE를 재검증 대상으로 삼지 않음. 실제 authenticated 업데이트 검증 |
| 9. Edge 환경 누락 | consentGate.ts:1~4,15,53에서 SUPABASE_URL/SUPABASE_ANON_KEY 누락 시 값·JWT·body 없이 고정 필드명만 로그. HTTP503 {code:S1006,error:CONSENT_STATUS_UNAVAILABLE}. admin/provider 호출 없음, service key 대체 없음. strict TypeScript 검사와 handler mock 통과 |
| 10. 이력 append-only | M1:157~165 BEFORE UPDATE/DELETE 및 BEFORE TRUNCATE trigger는 owner도 42501/CONSENT_HISTORY_APPEND_ONLY. profile 루트가 사라진 CASCADE DELETE만 허용. 시간 경계 fixture는 과거 사건 UPDATE 대신 새 가상 grant를 INSERT. owner TRUNCATE CASCADE 실패 후 이력·상태 보존과 S2 profile cascade 양쪽 검증 |

## M1~M6 기준선의 로컬 대상과 검증 기록

전용 DB: supabase_db_mealchat_s1_a_20261017, 같은 이름의 Docker volume → /var/lib/postgresql/data, host 55322 → container 5432. Docker endpoint=npipe(local). 기존 supabase_db_mealchat_v2/54322는 수정하지 않았다. CLI 작업 디렉터리는 %TEMP%/mealchat-s1-a-20261017이며 최소 config·migration 사본만 사용한다. CLI 2.121.0, PostgreSQL 17, pgTAP 가용. 모든 reset은 --local --no-seed와 이 전용 작업 디렉터리만 사용했다.

| 명령/진입점 | 최종 결과 |
|---|---|
| powershell -NoProfile -ExecutionPolicy Bypass -File supabase/tests/s1_local.ps1 -Reset | 전체 기존 이력 + 독립 085900 + M1~M6 재구성 성공 |
| s1_consent_visibility.sql | pgTAP 160/160 |
| s1_consent_visibility_plain.sql | 같은 160개 assertion 통과 |
| s1_security_regressions.sql | pgTAP 31/31 |
| s1_acl_inventory.sql | pgTAP 66/66 |
| 20260823_rpc_hardening.sql | 원본 HEAD 본문 유지. pre-S1 + 085900 전 70/70, 085900 단독 후 69/70(폐쇄한 forced-invite grant 기대 1건만 의도적 실패), upgrade runner가 차이를 검사 |
| s1_legacy_rpc_regression.sql | S1 전제 adapter pgTAP 70/70 |
| s1_realtime_payload.sql | pgTAP 16/16. REALTIME_DELETE_UNRELATED_PK_ONLY=3, REALTIME_DELETE_PENDING_PK_ONLY=3; anon 3건 old_record=null |
| s1_closed_settlement.sql | pgTAP 13/13. 열린 bill 취소 허용, 늦게 입장한 비수취인 교체 거절, 닫힌 bill 취소 거절/true 멱등, leave_room, 방 삭제 뒤 snapshot |
| powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-rpc-additive-compat.ps1 | 26/26. synthetic 필수 약관 fixture, 실제 authenticated 호출, 전부 transaction rollback |
| powershell ... -File supabase/tests/s1_upgrade.ps1 | 원본 suite 전후 2 + 독립 hotfix 1 + preflight 무변경 6 + upstream Realtime 무변경 1 + upgrade 보존/권한 14 = 24 통과 |
| powershell ... -File supabase/tests/s1_concurrency.ps1 | 실제 두 연결 경쟁 8/8, finally 전체 reset exit 0 |
| node supabase/tests/s1_http.test.mjs | 실제 PostgREST/JWT HTTP 25/25; 임시 PostgREST 종료 및 finally 전체 reset 포함 exit 0 |
| node --test supabase/tests/s1_edge_gate.test.mjs | 9/9 (실제 handler mock의 admin/provider 0회, 환경 누락, helper strict typecheck) |
| EXPO_NO_DOTENV=1 설정 후 npm run quality | 성공: assets, 타입, lint, Jest 57 suites / 976 tests, Expo 의존성 검사, 의존성 audit gate |
| git diff --check -- supabase / S1 FOUND hazard grep | 공백 오류 없음 / 위험 패턴 0건 |

SQL은 fixture를 관리자 권한으로 준비한 뒤 SET LOCAL ROLE authenticated와 서로 다른 JWT claims/sub로 실행한다. actual role 결과와 catalog ACL을 구분한다. TAP not ok/Looks like you 및 프로세스 종료 코드를 모두 검사했다. 경쟁은 첫 세션이 mutation 후 잠금을 보유하고 PgSleep에 진입한 것을 확인한 뒤 두 번째 세션을 시작한다. profile lock과 room advisory→room→bill→member 순서를 검증한다.

원본 70개는 S1 이전의 역사적 권한 계약을 보존한다. 085900 단독 적용 후 실패하는 1건은 `legacy forced-invite, settlement-v1, and generic-system RPCs remain executable`라는 묶음 EXECUTE assertion으로, forced-invite의 의도적 회수 때문에 실패한다. 나머지 69개는 그대로 통과한다. 전체 S1에서는 필수 동의 fixture와 서버 소유 알림 등 전제가 바뀌므로 s1_legacy_rpc_regression.sql을 사용한다. 원본을 S1 adapter로 덮어써 두 결과를 혼동하지 않는다.

HTTP는 postgrest/postgrest:v12.2.12 이미지, 127.0.0.1:55321 전용 임시 컨테이너를 사용했다. Node 메모리에서 RSA 키를 새로 만들고 공개 JWK만 PostgREST에 제공했다. 기존 JWT/키를 읽거나 기록하지 않았다. 실제 HTTP에서 JWT 서명 검증(잘못된 JWT=401), REST/RPC/embedded 권한·건강 격리·정산 종료·강제 초대 거절을 검증했다. Supabase Auth에서 발급된 세션, Kong/apikey gateway, 배포 Edge runtime 검증은 아니다. finally에서 PostgREST를 종료하고 전용 DB를 reset하여 commit fixture와 임시 키 신뢰를 정리했다.

Realtime는 설치된 realtime.apply_rls를 사용하여 가상 WAL과 B/C/G/anon 구독 claims로 실제 role/column privilege/RLS 변환을 검사했다. legacy 민감 열이 포함된 WAL도 payload에서 제거된다. 네트워크 WebSocket 구독·실제 WAL slot 전달·클라이언트 cache까지 검증한 것은 아니다. DELETE의 PK-only/null 범위는 맨 위의 한계 설명과 같다.

## 추가 인계: REPLICA IDENTITY 확인과 완화

2026-10-17 최종 HTTP cleanup/reset 뒤 로컬 55322 전체 migration 상태의 pg_class.relreplident를 다시 조회했다. public/private 테이블 **21개 모두 d(DEFAULT)**, 비시스템 스키마 전체에서 **f(FULL) 0개**였다. 운영은 접근 금지로 미확인이다. 로컬 supabase_realtime 공개 테이블은 아래 4개이며 모두 RLS가 켜져 있고 단일 UUID 기본키(id)를 사용한다.

| 테이블 | REPLICA IDENTITY | 기본키 | 이번 DELETE payload 검사 |
|---|---|---|---|
| public.participants | DEFAULT | id UUID | unrelated/pending old_record={id:UUID}, record 비어 있음; anon old_record=null |
| public.notifications | DEFAULT | id UUID | unrelated/pending old_record={id:UUID}, record 비어 있음; anon old_record=null |
| public.rooms | DEFAULT | id UUID | unrelated/pending old_record={id:UUID}, record 비어 있음; anon old_record=null |
| public.messages | DEFAULT | id UUID | catalog 확인; 이 테이블 DELETE payload는 이번 가상 WAL 대상 아님 |

완화 방안은 **REPLICA IDENTITY DEFAULT를 유지**하고 FULL로 변경하지 않는 것이다. FULL은 DELETE logical WAL에 이전 행 전체를 포함시킬 수 있으므로 변경이 필요하다면 이전 행·구독 역할·Realtime 버전별 payload 검증과 별도 보안 검토가 선행돼야 한다. PK 존재 자체의 전달도 금지해야 하는 제품 요구가 생기면 해당 테이블의 Postgres Changes 공개 제거와 서버에서 인가한 Broadcast로의 전환을 별도 승인 범위에서 검토한다. 클라이언트 필터를 보안 경계로 삼지 않는다. 이번에는 identity/publication/서비스 설정을 변경하지 않았다. [Supabase 공식 문서](https://supabase.com/docs/guides/realtime/postgres-changes#receiving-old-records)도 DELETE의 RLS 미적용 및 FULL의 이전 행 수신 동작을 명시한다.

s1_realtime_payload.sql에 FULL 0건, 공개 테이블 DEFAULT+단일 UUID PK, 세 테이블의 pending/unrelated DELETE의 정확한 PK-only/빈 record 및 anon null을 검사한다. 로컬 네트워크 WebSocket 전달은 여전히 미검증이다. 운영 반영 뒤 운영 Realtime 버전·publication·replica identity를 확인하고 무관 로그인 사용자/pending/anon 실제 구독으로 다시 측정해야 한다.

읽기 전용 catalog 확인 SQL(격리 로컬 컨테이너의 psql에서 실행):

~~~sql
select n.nspname, c.relname, c.relreplident, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and c.relreplident='f'
  and n.nspname not like 'pg_%' and n.nspname<>'information_schema';
-- 결과 0행. public/private의 전체 테이블 identity 및 publication 별도 조회도 수행했다.
~~~

## 재현

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File supabase/tests/s1_local.ps1 -Reset -M7TestValues
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-rpc-additive-compat.ps1
docker cp supabase/tests/. supabase_db_mealchat_s1_a_20261017:/tmp/s1_tests
# SQL 파일별로 실행하고 not ok/Looks like you도 실패 처리한다.
docker exec supabase_db_mealchat_s1_a_20261017 psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -f /tmp/s1_tests/s1_security_regressions.sql
powershell -NoProfile -ExecutionPolicy Bypass -File supabase/tests/s1_upgrade.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File supabase/tests/s1_concurrency.ps1
node supabase/tests/s1_http.test.mjs
node --test supabase/tests/s1_edge_gate.test.mjs
$env:EXPO_NO_DOTENV='1'
npm run quality
~~~

reset은 DB 컨테이너 /tmp 사본도 제거하므로 reset 뒤 SQL 테스트 실행 전에 docker cp를 다시 한다. SQL fixture/helper 조각은 독립 test entrypoint가 아니다.

## 운영 전제·미검증·범위 밖 인계

다음은 **실행하지 않은 운영 반영 절차 제안**이며 별도 정확한 대상·SQL 승인과 독립 보안 검토가 필요하다.

1. 운영 `pg_default_acl`을 먼저 조회한다(소유 역할, schema별/전역 객체 종류, 수혜 역할). M1의 기본 grant 회수가 이후 생성될 함수·테이블과 service_role에 미치는 영향을 평가하고 필요한 명시 GRANT를 준비한다. 운영 migration history/SQL identity, 사전 개인정보 inventory, 앱 호환 버전도 확인한다.
2. **M1~M6(+M7)을 한 배포 창에서 연속 적용**한다. M7 템플릿은 작성했으며 법률 문구·canonical/hash·시행일 확정과 재검토 뒤에만 적용한다. M6 뒤 M7 전 current 문서가 없는 상태를 공개 서비스에 오래 노출하지 않도록 기능 접근을 차단하고 전환한다.
3. 중간 실패 시 후속 migration과 앱 재개를 멈추고, 마지막 성공 migration/실제 schema/ACL을 조회해 기록한다. 실패 transaction은 롤백 여부를 확인한다. 이미 성공한 migration이나 삭제한 민감 데이터가 자동 복구된다고 가정하지 않는다. 승인받은 forward fix로 같은 창에서 나머지를 완료하거나, 민감 grant·RLS를 복원하지 않은 상태로 기능 차단을 유지한다. 수정 SQL은 로컬 upgrade/격리 검증과 독립 검토 후 별도 승인받는다. 추측한 history repair나 전체 재실행은 하지 않는다.
4. **085900 단독 핫픽스는 db push가 아니라 해당 파일의 단일 SQL 실행**으로 적용한다. db push는 뒤의 미승인 S1까지 밀어넣을 수 있다. 이후 승인된 migration push에서 같은 REVOKE가 멱등 재적용되는 것은 의도다. 단독 SQL 실행만으로 migration history에 반영됐다고 주장하거나 임의 repair하지 않는다. 이력과 실제 EXECUTE 권한을 각각 확인한다.
5. 승인된 반영 뒤 migration/function identity, multi-user isolation/end-to-end, security advisors를 확인한다. 운영 Realtime 버전에서 세 테이블 DELETE의 무관 로그인 사용자/pending/anon 실제 구독 payload도 실측한다.

- 배포 코드가 명시적으로 읽는 필수 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY. 앞 두 개 누락은 S1006/503으로 닫히며, GEMINI_API_KEY 누락은 기존 provider configuration 오류다. @supabase/server withSupabase의 검증된 user/admin client 구성은 플랫폼 런타임에 필요하며 별도 배포 전 확인 대상이다. 새로운 service credential을 앱이나 소스에 넣지 않는다.
- 실제 개인정보 처리방침 2판 원문·시행일·version/hash 확정, M7 재검토, 운영 반영은 남아 있다. 로컬의 합성 privacy 2판과 실제 다른 3개 문서로 통과한 결과를 확정 법률 문구 또는 운영 출시 완료로 보고하지 않는다.
- 레거시 marketing은 최신 (agreed_at,id) 서버 기록의 상태·기존 시각+2년만 복원한다. 과거 원문 열람·고지·자발적 동의 행위 자체의 증거를 복원한 것은 아니다. 새 선택 문서 동의로 승격하지 않으며 sending_enabled=false다.
- M3 취향게임 backfill은 최신 결정에 따라 제거됐다. 기존 음식 행이 없는 사용자의 조회는 빈 취향/revision=0이며, 새 저장은 본인 프로필 잠금 뒤에만 행을 만든다. 프로필 자체가 없는 provisioning 실패는 기존 23503/S1 gate 계약으로 닫는다. 실제 원격 누락 row·업무 키 inventory는 금지 범위라 미확인이다.
- s1_personal_data_inventory.sql은 원문 없이 key/type와 invalid count만 제공한다. unknown 업무 데이터의 의미를 추측하거나 production 데이터를 버리지 않았다. 실제 정리와 migration 반영은 정확한 대상·SQL·삭제 범위 승인 뒤 별도 작업이다.
- scripts/test-rpc-additive-compat.ps1은 추가 소유 범위 승인에 따라 갱신했다. PUBLIC/anon/authenticated 강제 초대 EXECUTE 없음, legacy/linked 알림 직접 INSERT 없음, 실제 강제 초대·알림 INSERT 42501, 일방향 follow 뒤 identity_only 유지를 검증한다. 기존 v1/v2 정산·재시도·수취인·서버 알림/이벤트와 멤버 system RPC 호환성은 유지한다. M6 적용과 전용 로컬 컨테이너/55322를 확인하고, 필수 약관을 포함한 모든 합성 fixture는 한 트랜잭션에서 롤백한다. tests/rpcHardeningMigration.test.ts는 과거 202608 migration의 역사적 계약 검사이며 수정하지 않았다.
- 원격 migration/function identity, security advisors, 실제 사용자 데이터, 운영 pg_default_acl, provider 실제 응답/파싱/렌더, 실기기 UI, 일일 scheduler, Auth 계정 삭제/익명화/파일·backup 파기는 검증하지 않았다. S2 cascade assertion은 S2 전체 완료 증거가 아니다.

## 이전 M1~M6 인계의 최종 검증 기록

- 이번 이어받기에서 전체 reset, SQL, upgrade 24, concurrency 8, HTTP 25, Edge 9, additive 26을 재실행했다. 표의 수치는 이번 실행 결과다. upgrade/concurrency/HTTP 모두 최종 cleanup/reset까지 exit 0이며 임시 PostgREST는 종료됐다.
- EXPO_NO_DOTENV=1 후 npm run quality 최종 exit 0: licenses 24, assets/type/lint, Jest 57 suites / 976 tests, Expo 의존성, audit gate 통과. audit은 기존 임시 예외 3건을 사용한 gate 통과이며 취약점 0건이라는 뜻은 아니다. tests/** 수정 없음.
- PowerShell parser 통과. SQL 검증은 종료 코드와 TAP not ok/Looks like you를 함께 검사했다. 첫 보안 실행의 NOTICE는 호출 셸 ErrorActionPreference 때문에 중단됐으므로 Continue로 재실행하여 31/31을 확인했다. Realtime 첫 실행의 JSON scalar 오류는 수정 뒤 16/16 재실행으로 해결했다.
- 최종 catalog: 085900 및 M1~M6 7개 migration identity 존재. consent_documents=0, s1 합성 auth.users=0, S1/compat 합성 rooms=0. 읽기 전용 personal-data inventory의 invalid count는 모두 0(실사용 데이터 검증 아님). git diff --check 통과, 원본 RPC의 HEAD 본문 diff exit 0. 재실행 로그는 로컬 ignored 파일 s1-{quality,upgrade,concurrency,http}-latest.log에 있으며 개인정보·기존 키·JWT를 기록하지 않았다.
- 위 수치는 M7 작성 전 인계 기록이다. 이번 M7 검증 수치는 상단 절에 별도 기록한다. 운영 identity와 실제 WebSocket 전달은 여전히 미검증이다.

## 변경 파일 목록

직전 이어받기는 Realtime 테스트와 보고서를 수정했다. 이번 M7 작업 변경 파일은 아래 추가 목록과 s1_local.ps1, s1_upgrade.ps1, s1_http.test.mjs 및 이 보고서다. M1~M6, 기존 SQL 본문과 앱 파일은 이번 작업에서 변경하지 않았다. 아래는 이전 작업자의 구현·테스트를 포함한 S1 A 전체 인계 목록이다. 원본 20260823_rpc_hardening.sql은 HEAD 본문 복원 상태이며 내용 diff가 없다.

- supabase/migrations/20261017085900_revoke_invite_friend_to_room.sql
- supabase/migrations/20261017090000_s1_consent_documents.sql
- supabase/migrations/20261017091000_s1_consent_rpcs.sql
- supabase/migrations/20261017092000_s1_food_health_storage.sql
- supabase/migrations/20261017093000_s1_profile_visibility.sql
- supabase/migrations/20261017094000_s1_settlement_disclosure.sql
- supabase/migrations/20261017095000_s1_terms_access_gate.sql
- supabase/functions/schedule-recommend/index.ts
- supabase/functions/schedule-recommend/consentGate.ts
- supabase/tests/20260823_rpc_hardening.sql
- supabase/tests/s1_acl_inventory.sql
- supabase/tests/s1_assertions.sql
- supabase/tests/s1_concurrency.ps1
- supabase/tests/s1_closed_settlement.sql
- supabase/tests/s1_consent_visibility.sql
- supabase/tests/s1_consent_visibility_plain.sql
- supabase/tests/s1_edge_gate.test.mjs
- supabase/tests/s1_fixture.sql
- supabase/tests/s1_fixture_tools.sql
- supabase/tests/s1_http.test.mjs
- supabase/tests/s1_legacy_rpc_regression.sql
- supabase/tests/s1_local.ps1
- supabase/tests/s1_personal_data_inventory.sql
- supabase/tests/s1_realtime_payload.sql
- supabase/tests/s1_schema_fingerprint.sql
- supabase/tests/s1_security_regressions.sql
- supabase/tests/s1_test_helpers.ps1
- supabase/tests/s1_upgrade.ps1
- supabase/tests/s1_upgrade.sql
- supabase/tests/s1_upgrade_assertions.sql
- supabase/tests/S1-A-REPORT.md

- scripts/test-rpc-additive-compat.ps1 (추가 허용된 소유 범위)

M7 작업 추가 파일:

- supabase/migrations/20261017100000_s1_activate_terms.sql
- supabase/tests/s1_m7_local.mjs
- supabase/tests/s1_m7_test_values.json
- supabase/tests/s1_m7_activation.test.mjs
- supabase/tests/s1_m7_guard.ps1
- supabase/tests/s1_m7_upgrade_assertions.sql
