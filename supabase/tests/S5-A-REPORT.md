# S5 DB·Edge 검토 수정 인계 (2026-10-19)

## 출시 전 권장 3건 보완 (최신, 2026-10-19)

1. **방 삭제 후 계정 한도 보존**: supabase/migrations/20261018131946_s5_recommendation_worker_boundary.sql:19의 private.recommendation_usage는 caller_id/created_at와 내부 id만 저장하고, FK는 profiles 삭제 cascade 하나뿐이다. room/ticket FK가 없으므로 방 삭제가 사용량을 지우지 않는다. :101~107의 계정5/분·100/일은 이 테이블을 세며 caller profile 잠금 뒤 새 ticket과 같은 트랜잭션으로 1건 기록한다. 같은 ID 재조회·거절은 추가 기록하지 않는다. 방30/분·1000/일은 기존 ticket을 센다. :215에서 24시간 경과 사용량을 cleanup한다. 총 삭제 한도 p_limit은 ticket+usage 합계에 적용하고 반환 정수도 두 테이블 삭제 합계다(사용자 API 추가 변경 없음).
2. **레거시 zero-place Gemini 스키마**: functions/schedule-recommend/index.ts:383/:455/:460에서 placeCount=0이면 prompt와 schema properties/required 모두 placeRecommendations를 생략한다. rank.minimum=1/maximum=0 스키마는 생성하지 않는다. :513에서 provider의 누락 필드를 검증용 빈 배열로 정규화해 앱의 placeRecommendations=[] 형식은 유지한다. 실제 handler 성공 mock이 식당 필드 없는 schema·provider 응답을 검사한다. 실제 Gemini 호출 없음.
3. **테스트 실네트워크 기본 차단**: 신규 supabase/tests/edge_vm.mjs:4의 공통 runEdgeVm은 기본 fetch를 EDGE_TEST_NETWORK_DISABLED 예외로 두고 host globalThis.fetch 직접 주입도 거절한다. s1_edge_gate.test.mjs와 s5_edge.test.mjs의 모든 VM을 이 도우미로 통일했다. mock fetchImpl을 빠뜨린 실제 callGeminiWithRetry가 외부로 가지 않고 거절되는 회귀를 포함한다.

이번 변경 파일: 위 migration/index, 신규 edge_vm.mjs와 s5_quota_lifecycle.sql, s1_edge_gate.test.mjs, s5_edge.test.mjs, s5_review_regressions.sql(일간 계정 fixture를 독립 ledger로 이동), s5_sql.ps1, s5_concurrency.ps1, 이 보고서. src/App/package/docs/M7/S1 migration 원문은 이번 보완에서 수정하지 않았다.

| 이번 명령 | 결과 |
|---|---|
| powershell -File supabase/tests/s1_local.ps1 -Reset | 전용 로컬 npipe Docker/55322에서 M1~M6+S5+guarded seed 전체 reset 성공 |
| powershell -File supabase/tests/s5_sql.ps1 | **663/663**: S1 528 + S5 98 + 이전 검토18 + 신규 lifecycle19. 실제 authenticated/service 역할, owner leave_room 방 삭제 뒤 S5005 유지·일간 한도·idempotency·RLS/ACL·프로필 삭제·24시간 bounded cleanup 검증 |
| node --test supabase/tests/s5_edge.test.mjs supabase/tests/s1_edge_gate.test.mjs supabase/tests/s1_release_gate.test.mjs | **79/79**: S5 55 + S1 Edge9 + 배포 가드15. schema 생략·실제 handler 성공·mock 누락 네트워크 차단 |
| powershell -File supabase/tests/s5_concurrency.ps1 | **13/13**, 다른 두 방에서 같은 계정이 5번째/6번째 요청을 동시에 넣을 때 한 건만 생성·다른 건 S5005, 계정 usage=5 확인. finally reset 성공 |
| npx --yes deno check --config supabase/functions/schedule-recommend/deno.json supabase/functions/schedule-recommend/index.ts | 전체 index/import graph 통과 |
| npx --yes deno test --no-config supabase/functions/schedule-recommend/pipeline_test.ts | **6/6** |
| EXPO_NO_DOTENV=1 EXPO_NO_CACHE=1 npm run quality | **exit0, 66 suites/1115 tests**, TS/lint·Expo·자산·의존성 audit gate 통과 |
| git diff --check | 통과 |

이번 보완은 로컬 검증까지 완료했다. 원격 Supabase·.env·배포·cron 등록·커밋·실제 provider 호출 없음. M7은 release 디렉터리에 그대로 두었다. 물리 cleanup job 등록과 운영 지역 catalog/실제 provider E2E는 기존 운영 인계 범위에 남아 있다. 아래 기록의 이전 실행 건수는 당시 값이다.

## 2026-10-19 Claude 검토 후 기능 보완

기능 차단1건과 권장2~7을 반영했다. 원격 Supabase·.env·배포·커밋·앱 파일 수정 없음. 대상은 기존 전용 로컬 Docker npipe 및 supabase_db_mealchat_s1_a_20261017/55322이다. 다른 작업자의 앱/Auth/package/미리보기 변경은 보존했다. 기존 M1~M6와 release/M7은 변경하지 않았다.

### 수정 근거

| 검토 항목 | 수정/근거 |
|---|---|
| 1 레거시 시간 추천400 | functions/schedule-recommend/pipeline.ts:164에서 빈 배열 허용, index.ts:624의 중복 검증도 정합화. 라우트는 여전히 비어 있지 않은 legacy 후보를 S1008로 거절한다. s5_edge.test.mjs의 실제 handler 성공 경로에서 Auth→S1→방 권한→서버 일정→mock Gemini→시간 응답200을 검증한다. |
| 2 shown 문맥 무효화 | migrations/20261018131946_s5_recommendation_worker_boundary.sql:39: 완료된 v2 preferences/catalog_version만 hash에 포함. 저장용 revision/안내 시각과 미입력 행 생성은 제외. 최초 shown·반복 shown·기존 v2 shown, 실제 profile lock 대기 회귀 통과. mark RPC의 CAS revision 계약은 유지한다. |
| 3 공유 예산 고갈 | 같은 SQL:89: 계정5/min·100/day, 별도 방30/min·1000/day. caller 분당/일간, room 분당/일간 각각 차단 및 계정A 소진 뒤 계정B 시작 허용을 검증. |
| 4 claim 경합403 | functions/schedule-recommend/s5Recommendation.ts:113/136: claim42501이면 원래 사용자 JWT로 begin 한 번 재조회. working202/완료200으로 복구하고 실제 권한·동의 오류는 유지한다. 동시 Promise.all에서 provider1회·200/202, 별도 SQL/실제 HTTP claim 단일 token 승자 검증. |
| 5 claim 후 실패 ID | 같은 Edge:131/157: 빈 TMAP_API_KEY는 claim 전에 검사. SQL:120의 service-only fail_recommendation_work_v2(uuid,uuid)가 token 확인 뒤 failed로 마무리, 같은 ID begin은 S5006. 잘못된 token/사용자·anon 실행/완료 취소 거부, 동일 token 실패 기록 재시도 검증. |
| 6 읽기 검증 잠금 | 같은 SQL:183: validate는 STABLE이며 room advisory·멤버 profile·ticket write lock 없음. 상대가 room advisory·room/profile FOR UPDATE를 쥐어도 lock_timeout=200ms로 validate가 통과함을 실제 두 연결에서 검증. 시점 검증이며 사용 직전 재검사 필요. |
| 7 공백 | index 전체 deno check 통과. SDK 기본 schema의 미등록 RPC 타입은 index.ts:171에서 좁은 worker RPC 구조 타입으로 연결. 추천 SQL·전체 index/Edge의 건강 테이블·원문 개인정보 미참조 정적 검사, 실제 3인 집계/상위 키워드 순서, 동시 ID 응답 검사 추가. |

### 앱 전달 계약 변경

- 문서: docs/S5-food-profile-design.md:138(읽기), :144(worker 실패), :151(context), :155(한도), :169(claim 경합), :171/:191(S5006).
- Edge S5006/HTTP503에 **new_request_required:boolean** 추가. false=TMAP_API_KEY 없음/공백을 claim 전에 발견했으므로 설정 복구 뒤 같은 ID 재사용 가능. true=claim 뒤 공급원 실패/failed ID 재조회이므로 새 request_id 필요. 실패 기록 RPC가 실패해도 true를 유지한다(이 경우 기존 working TTL5분).
- claim 경합 패배는 403으로 확정하지 않고 begin을 재조회하여 202+Retry-After:1 또는 완료200을 받는다. 재조회42501/S1001 등은 그대로 거절한다.
- shown/later는 저장 CAS revision을 계속 올리지만 추천 결과를 무효화하지 않는다. 동일한 저장 payload 재저장도 context를 불필요하게 바꾸지 않는다.
- 예산: 계정5/분·100/일과 방30/분·1000/일을 독립 적용. 모든 pending/working/failed/complete 신규 ticket이 예산에 포함된다. 새 worker 실패 RPC는 앱에서 호출할 수 없다.

### 이번 변경 파일

- docs/S5-food-profile-design.md
- supabase/functions/schedule-recommend/index.ts, pipeline.ts, s5Recommendation.ts
- supabase/migrations/20261018131946_s5_recommendation_worker_boundary.sql(미커밋 S5 파일 보완)
- supabase/tests/s5_edge.test.mjs, s5_food_recommendation.sql, 신규 s5_review_regressions.sql, s5_sql.ps1, s5_concurrency.ps1, s5_http.test.mjs, 이 보고서

s5_sql.ps1은 Docker cp에 source/.를 사용하도록 수정했다. 기존 대상 폴더가 있으면 tests 하위에 중첩 복사되어 오래된 SQL이 실행되던 도우미 문제를 제거했고, 최신 덮어쓰기본으로 전체 SQL을 다시 통과시켰다.

### 이번 검증 결과

| 명령 | 결과 |
|---|---|
| powershell -File supabase/tests/s1_local.ps1 -Reset | M1~M6+S5+local seed 전체 reset 성공 |
| powershell -File supabase/tests/s5_sql.ps1 | **644/644**(S1 528 + S5 기존98 + 검토 회귀18), 실제 JWT 역할 |
| node --test supabase/tests/s5_edge.test.mjs supabase/tests/s1_edge_gate.test.mjs supabase/tests/s1_release_gate.test.mjs | **78/78**(S5 54 + S1 Edge9 + 배포 가드15) |
| npx --yes deno check --config supabase/functions/schedule-recommend/deno.json supabase/functions/schedule-recommend/index.ts | 전체 index 및 실제 import graph 통과, lock 변경 없음 |
| npx --yes deno test --no-config supabase/functions/schedule-recommend/pipeline_test.ts | **6/6** |
| powershell -File supabase/tests/s5_concurrency.ps1 | **12/12**, fixture finally 전체 reset 성공 |
| node supabase/tests/s5_http.test.mjs / node supabase/tests/s1_http.test.mjs | **38/38 + 33/33**, 로컬 실제 PostgREST/임시 RSA 서명 JWT, 각각 finally reset 성공 |
| powershell -File supabase/tests/s5_upgrade.ps1 | **12개 추가 assertion 통과**, S1 기준부터 S5 적용·보존 후 전체 reset 성공 |
| node supabase/tests/s1_seed_guard.test.mjs / s1_seed.mjs --check | **19/19**, generator 일치 |
| npm run release:check | M7 보류로 S1_RELEASE_M7_REQUIRED / exit1 정상 차단 |
| EXPO_NO_DOTENV=1 EXPO_NO_CACHE=1 npm run quality | **exit0, 66 suites/1106 tests**. TS/lint·Expo 의존성·자산·의존성 보안 gate 통과(기존 한시 예외3개 유지) |

초기 quality는 다른 작업자의 scripts/ui-preview/s5App.browser.cjs Buffer lint에서 중단했고 별도 Jest는 s5ProfileCompatibility.test.ts:37 기대값1건이 실패했다. 해당 작업자가 두 파일을 수정한 것을 확인한 뒤 전체 quality를 재실행했다. 이 작업자는 앱/미리보기 파일을 수정하지 않았다.

레거시 성공 테스트의 첫 실행에서 mock 주입이 빠져 합성 일정 후보와 가짜 API 키로 Gemini 요청1건이 발생했고 HTTP400으로 거절됐다. 실제 키·개인정보·원격 Supabase 요청은 없었다. 이후 단위 테스트 loader는 생네트워크 호출을 예외로 차단하고 pipeline/provider를 명시 주입해 성공 및 실패 회귀를 검증한다. 실제 provider 성공·키 가용성·운영 E2E는 여전히 미검증이다.

### 운영 지역 추가 형식과 미해결

운영 지역 catalog는 비어 있는 상태를 유지한다. 승인된 목록을 받은 뒤 새 S5 데이터 migration으로만 추가한다. 파일은 로컬 CLI migration new로 생성하고 다음 형식의 자리 표시 값은 승인된 공용 중심/반경으로 치환한다(아래는 실행하지 않은 문서 템플릿).

```sql
begin;
insert into public.public_meeting_areas
 (id,label,latitude,longitude,radius_m,enabled,revision)
values ('<approved-id>','<approved-label>',<latitude>,<longitude>,<radius_m>,true,0)
on conflict(id) do update set
 label=excluded.label,latitude=excluded.latitude,longitude=excluded.longitude,
 radius_m=excluded.radius_m,enabled=excluded.enabled,
 revision=public.public_meeting_areas.revision+1;
commit;
```

필드 제약: id는 소문자 시작 ASCII [a-z0-9_-] 최대64자, label1..80자, 위도-90..90·경도-180..180의 유한 숫자, radius_m100..2000의 정수, enabled=true만 조회/선택 가능, revision은 수정 시 증가. 개인 출발지가 아닌 검토한 공용 대표점만 넣는다. 현재 로컬 예시는 local-dev seed에만 있으며 운영 seed/M7을 변경하지 않는다. 사용자 목록·운영 반영 승인·실제 provider E2E·앱 렌더링·수정본 Claude 재검토는 메인 인계 사항이다.

## 이전 구현 기록 (2026-10-18)

## 결과와 0단계 결정

개인 STEP1 취향을 DB 내부에서만 집계하고 공용 만남 지역 주변 식당을 추천하는 additive v2 경로를 구현했다. 앱에는 최종 후보만, Gemini에는 식별자·인원수 없는 상위 코드 최대5개와 임시 후보 ID/음식 종류만 전송한다. 방장의 공용 음식 종류는 우선 선택 기능이다. STEP2 건강정보·동의 상태·개인 출발지를 공동 추천에서 읽지 않는다. 2인 방 결과로 STEP1 취향을 추정하는 잔여 위험은 사용자 승인대로 명시했다.

- 결정·제외: docs/S5-food-profile-design.md:5, 코드표 :23/:37, 앱 RPC 인자·응답 :121, worker :140, TTL/집계 :146, 오류 :170.
- Figma 67항목 확정(food34/health33), allergy 복수. 자유 입력 other_input 3개는 disabled, none은 UI 제어 값으로만 사용한다. catalog_version=s5-food-2026-10-18-v1, fixture content_hash=d9e9bed4857b3dc9590b36c13907d3212172baedde3f615cd4f63ee6c48d3122.
- 레거시 6 boolean을 이전하지 않는다. 기존 v1 행은 보존하고 v2 GET은 미입력으로 응답한다. 명시 v2 저장만 개별 전환한다. v2 행을 v1이 읽거나 덮어쓰는 경로는 S1008이다. v1 health 원문을 축약 변환하지 않고 명시 철회/파기·재입력 경로를 제공한다.
- 이번 추천 v2 목적은 places만, slots/both는 S1008이다. 기존 시간 전용 v1 경로(placeCandidates=[])는 유지한다. 클라이언트가 식당 후보를 보내는 legacy 경로는 S1008/426으로 차단한다.

## 변경 파일과 근거

- docs/S5-food-profile-design.md: 확정 결정·코드표·권한·입출력·오류·제외 범위.
- supabase/migrations/20261018131936_s5_food_profile_catalog_storage.sql: 새 catalog, schema2 확장, 순수 shape CHECK/쓰기 catalog 검사, 기존 S1 RPC v2 보호.
- supabase/migrations/20261018131939_s5_food_profile_rpcs.sql:3/30/67/83: owner-only catalog/food/health 저장·조회, CAS·선택 입력·복수 allergy·안내 snooze.
- supabase/migrations/20261018131943_s5_recommendation_public_area.sql:47/56/69: 현재 participant 조회·participant 방장 설정, 공개 지역 catalog. 운영 지역 데이터는 생성하지 않는다.
- supabase/migrations/20261018131946_s5_recommendation_worker_boundary.sql:23/34/47/72/97/120/170/182: 정렬된 profile 잠금, 식별자 없는 STEP1 키워드, 단일 worker token, provider 후 context/권한/반경 재검증, 60초 결과 TTL, 호출 예산, 24시간 cleanup RPC.
- supabase/functions/schedule-recommend/index.ts:162: 기존 Auth·S1 gate 뒤 새 v2 분기/8KiB body 제한. 기존 로그의 원문 오류 출력을 고정 코드로 축소.
- supabase/functions/schedule-recommend/s5Recommendation.ts:48/65/82/107: 서버 Tmap 후보 수집·반경/분류 검사, Gemini allowlist, strict result allowlist, source=rules fallback.
- supabase/seed.sql:150, supabase/tests/s1_seed.mjs:40: local-dev 예시 지역만 추가. S1 안전 가드 유지, M7 원문 수정 없음.
- supabase/tests/s1_edge_gate.test.mjs: 기존 시간 경로의 권한 순서 정적 검사를 legacy 분기로 한정. 새 실제 handler 권한 순서는 s5_edge.test.mjs로 검증.
- 신규 테스트: s5_catalog.fixture.json, s5_food_recommendation.sql, s5_edge.test.mjs, s5_concurrency.ps1, s5_upgrade.ps1, s5_upgrade.sql, s5_http.test.mjs, s5_sql.ps1, 이 보고서.

## 검증

대상은 로컬 Docker npipe:////./pipe/dockerDesktopLinuxEngine, supabase_db_mealchat_s1_a_20261017(호스트55322→5432)로 매번 확인했다. 기존 앱용54322/원격에는 연결하지 않았다. Docker Desktop을 숨김 창으로 시작했다. 임시 CLI workdir은 %TEMP%/mealchat-s1-a-20261017이다. 소스 M1~M6 + 새 S5 migration4개 + guarded local-dev seed로 reset한다. M7은 migration 입력 밖 그대로다.

| 실행 | 결과 |
|---|---|
| powershell -File supabase/tests/s1_local.ps1 -Reset | 전체 db reset --local 성공 |
| powershell -File supabase/tests/s5_sql.ps1 | 626/626: 기존 S1 528 + S5 98, 실제 SET LOCAL ROLE/JWT claims로 권한 검사 |
| node --test supabase/tests/s5_edge.test.mjs supabase/tests/s1_edge_gate.test.mjs supabase/tests/s1_release_gate.test.mjs | 67/67(S5 43 + S1 Edge 9 + 배포 가드15), strict TS noEmit 포함 |
| powershell -File supabase/tests/s5_upgrade.ps1 | S1→S5 upgrade 12개 추가 assertion 통과, 원형 v1 무변환·명시 전환·빈 운영 지역 확인, finally 전체 reset 성공 |
| node supabase/tests/s5_http.test.mjs | 29/29: 실제 로컬 PostgREST v12.2.12 + 임시 RSA 서명 JWT. raw 타인 행/worker ACL·복수 allergy·추천 finalize·context 변경·서명 검증 |
| powershell -File supabase/tests/s5_concurrency.ps1 | 10/10: 두 실제 DB 연결의 food CAS, health save/철회 양방향·잠금 후 만료, begin/claim 경쟁, food/지역/멤버/약관 변경과 finalize 경쟁. fixture finally reset |
| EXPO_NO_DOTENV=1 EXPO_NO_CACHE=1 npm run quality | exit0, TS/lint·앱 Jest 62 suite/1106 tests·Expo 의존성·asset/security audit 통과. 기존 임시 audit 예외3개 유지 |
| node supabase/tests/s1_seed_guard.test.mjs | 19/19, guard 거절·원형 bootstrap·전체 rollback |
| npx --yes deno test --no-config supabase/functions/schedule-recommend/pipeline_test.ts | 기존 시간/응답 파이프라인 6/6 |
| npx --yes deno check --no-config supabase/functions/schedule-recommend/s5Recommendation.ts | 통과 |
| npm run release:check | exit1 / S1_RELEASE_M7_REQUIRED, M7 보류에 따른 정상 차단 |
| node supabase/tests/s1_seed.mjs --check / git diff --check | 통과; PowerShell Compare-Object로 실제 DB와 fixture의 67항목 code/label 정확히 일치 |

초기 전체 S1 회귀에서 새 방 RPC가 미동의 시 인자/멤버십 오류를 먼저 반환하는 차이를 발견했다. 모든 새 사용자 RPC의 전제 동의 검사를 첫 경계로 옮겨 기존 S1001 계약을 유지했고 수정본 전체626건이 통과했다. HTTP 직접 조회 첫 검증은 본인의 빈 행을 포함해 행 수를 잘못 기대했다. 타인 profile_id를 지정한 조회로 정정해 외부 행 차단을 확인했다.

## 미해결·검증 경계

- 원격·.env·secret·cron 등록·배포·stage/commit/push 없음. 기존 M1~M6 migration 원문과 release/M7 무변경. 다른 작업자의 Auth/앱/package/문서 dirty 변경은 보존했다.
- 운영 공용 지역 catalog는 별도 검토·승인 필요. 로컬 예시만으로 운영 지역 준비가 완료됐다고 판단하면 안 된다.
- Edge 필요 변수: 기존 SUPABASE_URL, SUPABASE_ANON_KEY, 실행 플랫폼의 기존 service client, 신규 TMAP_API_KEY. GEMINI_API_KEY는 선택이며 부재/실패 시 rules다. 실제 키를 열거나 등록하지 않았다.
- Tmap 공식 around API의 음식 category·km 반경을 사용하고 DB/Edge에서 실제 미터 반경을 재검사한다. 공급원 참고: https://tmap-skopenapi.readme.io/reference/명칭poi-주변-카테고리-검색 . 실제 Tmap/Gemini 호출·키/요금·모델 가용성은 미검증. 기존 gemini-3.7-flash 모델 식별자를 유지했으며 부재 시 rules fallback이다.
- 후보의 검증된 cuisine 분류만 결정적 내부 점수에 쓴다. 재료/매운맛 적합성과 알레르기 안전을 보증하지 않는다. 건강 필터/완료 표시는 계속 비활성이다.
- Tmap 오류 시 S5006이고 성공/빈 후보로 위장하지 않는다. 이미 claim한 ticket은 working 상태로 5분 유지하며 새 시도는 새 request_id+예산 제한을 받는다. cleanup RPC만 제공했고 외부 job 등록은 하지 않았다.
- v2 slots/both, 전역 v1 종료, 앱 화면·실기기 렌더링, 실제 Auth 토큰 발급/Kong/배포 Edge·실제 provider E2E는 이번 범위 밖 또는 미검증이다. 로컬 HTTP JWT는 테스트 생성 키로 검증했으며 기존 사용자 토큰을 읽지 않았다.
- 보안·개인정보 경계는 메인의 독립 코드 검토를 거쳐야 한다. 이 보고는 구현/로컬 검증 증거이며 운영 승인이나 추천 복구의 실사용 완료 판정이 아니다.
