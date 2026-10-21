# S1·S5 앱·개인정보 처리방침 2판 및 음식 프로필·식당 추천 운영 반영 절차

> [!CAUTION]
> **출시 차단 — 법률 문서 정정 전 운영 반영 금지**
>
> 이용약관 제6조 2항(알레르기로 메뉴를 걸러 낸다), 건강정보 동의서(메뉴 제외에만 사용), 개인정보 처리방침(출발지로 중간 지점 계산, 건강정보로 메뉴 제외)이 실제 동작(건강정보 미사용, 출발지 미사용)과 다름.
> - **사용자 결정 보류 중**: 건강정보 STEP 2 수집 유지 여부, 출발지 수집 중단 여부.
> - 법률 문서 정정과 사용자 결정이 확정되기 전에는 S1·S5 전체의 운영 반영(마이그레이션 적용, Edge Function 배포, 외부 설정 등록)을 엄격히 금지한다.

**현재 승인 범위(2026-10-18): Develop 커밋 조건부 승인. 운영 반영은 이 절차 보완 후 별도 승인이 필요하다.** 커밋이나 개발 quality 통과를 운영 migration·Edge 배포·설정 변경의 승인으로 해석하지 않는다.

**서버 운영 반영의 첫 단계는 `npm run release:check`이다.** 현재는 확정 M7이 migrations에 없으므로 실패해야 한다. 아래 준비 절차로 값을 확정하고 파일을 이동한 뒤 다시 검사하여 성공하기 전에는 M1~M6도 운영에 적용하지 않는다.

사용자 결정 A: **시행일은 새 빌드 실제 배포일 + 7일**이다. 한국 달력 날짜를 기준으로 한다. 날짜가 미정이면 예고 띄를 숨기고, 2판을 동의용 원문이나 M7 seed로 쓰지 않는다.

1. 배포할 때 `src/legal/privacyRevision.ts`의 한 줄을 실제 배포일로 바꾼다.
   ```ts
   export const privacyRevisionReleaseDate: string | null = 'YYYY-MM-DD';
   ```
   시행일(+7일), 판 번호 `2`, version `privacy-{시행일}-v2`, bundle `mealchat-{시행일}-r2`, 예고 표시가 자동 산출된다. 앱에서는 같은 파일의 `privacyRevisionPublication`을 사용한다. 배포일이 미뤄지면 이 줄을 다시 수정하고 파일 생성·앱 빌드를 다시 한다.
2. 저장소 루트에서 한 번 실행한다.
   ```powershell
   node scripts/generate-legal-hashes.mjs
   ```
   이어서 `npm run quality`로 원문·생성 파일 일치와 앱을 검증한다. 생성 JSON 두 파일은 소스 관리 대상이다. 게시된 1판 원문과 해시는 바꾸지 않는다.
3. 작업자 A는 **보류된 M7 템플릿**(supabase/release/20261017100000_s1_activate_terms.sql)의 상단 PRIVACY RELEASE CONSTANTS 블록에 `src/legal/privacy-release.generated.json`의 다음 값을 그대로 사용한다.

   | M7에 넣을 값 | JSON 위치 |
   |---|---|
   | 시행 시각(한국 시행일 00:00의 UTC) | `release.effective_from` |
   | 새 bundle 식별자·변경 요약 | `release.bundle_version`, `release.change_summary` |
   | 개인정보 문서 version·판 번호 | `privacy.version`, `privacy.edition` |
   | 원문 SHA-256·canonical JSON 문자열 | `privacy.content_hash`, `privacy.canonical_content` |

   서비스·건강·마케팅의 참조는 기존 `src/legal/documents.generated.json`의 `service`·`health`·`marketing`을 사용한다. 이 파일의 기존 네 항목 형식과 `privacy` 1판은 유지했다. 새 2판만 별도 생성 파일로 전달한다. `published_at`은 실제 서버 게시 시각이며 배포일·시행일로 대체하지 않는다.

**11항의 `시행일: …` 문단도 canonical 원문의 `sections[].paragraphs[]`에 들어가므로 해시에 포함된다.** 상단 `effectiveDate`도 포함된다. 따라서 최종 해시는 배포일 확정 후에만 정해진다. 날짜 미정 상태의 생성 파일은 `release: null`, `privacy: null`이며 임의의 날짜나 해시를 게시하지 않는다.

앱 빌드를 먼저 배포하여 7일 동안 예고하고, 시행 시각 이후 승인된 별도 절차로 M7을 포함한 S1 서버 변경을 반영한다. 서버가 S1 이전이면 기존 동의 RPC를 사용하고, 다음 앱 실행/포그라운드에서 S1을 감지하면 새 재동의 gate로 전환한다. 이 문서는 원격 반영 승인이 아니다.

## M7 이동과 운영 게이트

개발 중에는 M7을 supabase/release/에 보관한다. 미확정 version/시행일/hash/canonical 값은 null이며 템플릿을 실행하면 명시적 오류로 중단한다. supabase/migrations/에는 M1~M6만 두고, 로컬 활성화는 supabase/seed.sql의 local-dev 문서로 수행한다. 로컬 seed는 운영 약관이나 동의 증거가 아니다.

확정된 시행 시각 이후, 별도 승인된 서버 배포 창에서 다음 순서로 준비한다.

1. 상단 블록의 privacy 값을 생성 JSON과 일치시킨다. edition은 2, bundle은 시행일에서 mealchat-YYYY-MM-DD-r2로 파생된다. 서비스·건강·마케팅 snapshot도 생성 파일과 비교한다.
2. 템플릿을 복사하지 말고 migrations로 **이동**한다.

   ~~~powershell
   Move-Item -LiteralPath supabase/release/20261017100000_s1_activate_terms.sql -Destination supabase/migrations/20261017100000_s1_activate_terms.sql
   npm run release:check
   npm run quality
   ~~~

3. 엄격 배포 게이트가 통과해야 M1~M7 연속 적용을 승인 대상으로 올린다. M6이 있는데 확정 M7이 없거나, 자리 표시 값·local-dev 값·해시/앱 생성 파일 불일치·미래 시행일이면 게이트가 실패한다. **실패하면 M1~M6만 먼저 적용하지 않는다.** 중간 실패 시 기능 접근을 닫고 성공 migration과 실제 schema/ACL을 기록한 뒤 승인된 forward fix 또는 복구 절차를 따른다.
**데이터 삭제: profile_private.tastes(취향게임 답) 전량, 이전 없음**. M3는 알려진 6개 boolean을 포함한 기존 답을 모두 `{}`로 비우고 새 음식 저장소에는 행을 만들지 않는다. 삭제 범위를 운영 반영 검토에 포함한다. 기존 사용자는 다음 실행 때 음식 프로필을 새로 입력하며, 재동의 후 빈 취향 조회와 명시적인 6개 boolean 신규 저장은 계속 지원한다. 기존 답은 migration log/임시 archive에 복제하지 않는다.

4. 적용 전에 아래 체크리스트의 삭제 대상 건수·운영 백업/PITR·pg_default_acl을 확인하고 기록한다. **M1~M7을 한 배포 창에서 연속 적용한 뒤** 실제 문서/bundle·RPC·권한과 다중 사용자 격리를 검증한다.
5. **별도 사용자 승인 필요 — 새 `schedule-recommend`는 M1~M7 및 S5 DDL 전체 적용·검증 후에만 배포한다.** 새 `consentGate.ts:19`는 `get_my_consent_status`를 호출하고, S5 식당 추천은 S5 worker RPC(`begin_room_recommendation_v2` 등)를 호출한다. DB보다 먼저 배포하면 RPC/동의 구성 및 S5 스키마가 준비되지 않아 추천 요청이 S1006으로 실패하고 레거시 경로도 후보가 있으면 S1008로 차단된다. DB 검증이 실패했으면 새 Edge Function도 배포하지 않는다. 배포 후 실제 호출로 현재 약관 동의자의 정상 경로와 미동의자의 차단을 검증한다.

현재 개발 quality는 M7 존재를 요구하지 않는다. M7이 migrations에 들어 있을 때 미확정 상수·잘못된 hash 등을 거절하며, 로컬 seed 일치와 배포 게이트 회귀도 실행한다. 개발 quality 통과는 배포 준비 완료가 아니다. 배포 전에는 기본값도 엄격 모드인 node supabase/release/check.mjs --release가 별도로 반드시 통과해야 한다. 이 읽기 전용 검사는 원격 CLI 자체를 가로채지는 않으므로 수동 SQL/CLI 반영도 같은 게이트와 개별 승인 절차를 따라야 한다.

seed.sql은 config.toml의 [db.seed]에 연결되어 로컬 start/reset 뒤에 실행된다. 일반 db push에는 seed가 포함되지 않으며, 운영에는 --include-seed를 사용하거나 seed SQL을 직접 실행하지 않는다. 미확정 템플릿을 migrations로 복사해서 로컬 reset을 해결하지 않는다.

운영 CLI 경로는 별도 승인된 `db push`만 사용하며, `--include-seed`·`db reset --linked`는 금지한다. 자동 권한 검사로 DDL 실행이 차단되면 아래 SQL Editor 경로를 사용한다. 이 문구는 운영 CLI 실행 승인이 아니다.

## S5 운영 반영 순서와 마이그레이션 목록

S5(음식 프로필 저장 및 공용 지역 식당 추천)의 운영 반영은 다음 순서를 엄격히 준수한다.

**반영 순서: M1~M7 적용·검증 완료 → S5 DDL 마이그레이션 전부 적용·검증 → 새 `schedule-recommend` Edge Function 배포.**

> [!IMPORTANT]
> **선행 배포 금지 이유**: Edge Function을 S5 DDL보다 먼저 배포하면 식당 추천(`purpose: "places"`) 요청 시 DB의 v2 RPC 및 테이블이 존재하지 않아 S1006으로 실패한다. 또한 레거시 경로에서도 클라이언트가 보낸 식당 후보가 비어 있지 않으면 S1008(`CLIENT_UPDATE_REQUIRED`)로 즉시 거절된다. 따라서 반드시 S5 DDL 마이그레이션 적용과 검증이 끝난 후 Edge Function을 배포해야 한다.

### S5 DDL 마이그레이션 목록 (타임스탬프 순서)

1. `supabase/migrations/20261018131936_s5_food_profile_catalog_storage.sql`
   - 카탈로그 저장소 및 `profile_food_preferences` / `profile_health_preferences` schema v2 확장, 순수 shape CHECK 제약.
2. `supabase/migrations/20261018131939_s5_food_profile_rpcs.sql`
   - 음식·건강 프로필 v2 조회/저장 RPC (`get_food_profile_catalog_v2`, `get_my_food_preferences_v2`, `save_my_food_preferences_v2`, `mark_food_profile_prompt_v2`, `get_my_health_preferences_v2`, `save_my_health_preferences_v2`).
3. `supabase/migrations/20261018131943_s5_recommendation_public_area.sql`
   - 공용 만남 지역 테이블(`public_meeting_areas`), 방장 추천 설정 테이블 및 RPC (`get_public_meeting_areas_v2`, `get_room_recommendation_settings_v2`, `set_room_recommendation_area_v2`, `set_room_public_cuisines_v2`).
4. `supabase/migrations/20261018131946_s5_recommendation_worker_boundary.sql`
   - 추천 티켓(`private.recommendation_requests`) 및 사용량(`private.recommendation_usage`) 테이블, 내부 STEP 1 집계, 사용자 RPC (`begin_room_recommendation_v2`, `validate_my_recommendation_v2`), worker 전용 RPC (`claim_recommendation_work_v2`, `finalize_recommendation_work_v2`, `fail_recommendation_work_v2`, `cleanup_recommendation_requests_v2`).
5. `supabase/migrations/20261018173304_s5_public_meeting_area_catalog.sql`
   - 승인된 공용 만남 지역 37개(서울 23개, 부산 14개) 초기 데이터 카탈로그 DDL.

## Edge 환경 변수와 비밀값 (별도 사용자 승인)

새 `schedule-recommend` Edge Function 배포 전 운영 환경 변수를 확인하고 등록한다. 비밀 값 자체는 문서·로그·프롬프트에 기록하지 않는다.

- **`TMAP_API_KEY` (별도 사용자 승인 필요 — 필수)**:
  - Tmap 주변 POI 검색 API(`https://apis.openapi.sk.com/tmap/pois/search/around`) 호출에 사용된다.
  - 미등록 또는 공백일 경우 `s5Recommendation.ts:131`에서 claim 전에 S5006(HTTP 503, `new_request_required: false`)으로 즉시 반환되며, 티켓은 pending 상태로 남아 환경 변수 복구 후 동일 request_id로 재시도할 수 있다.
- **`GEMINI_API_KEY` (별도 사용자 승인 필요 — 선택)**:
  - Gemini 모델 호출(`gemini-3.7-flash`)에 사용된다.
  - S5 식당 추천에서는 선택 사항이다. 키가 없거나 호출 실패·타임아웃 발생 시 rules 기반 순위('기본 추천')로 정상 fallback 처리된다(`source: "rules"`). 단, 레거시 시간 추천 경로에서는 키가 없으면 500 오류를 반환한다.
- **`schedule-recommend` (`index.ts`, `s5Recommendation.ts`) 참조 환경 변수 전체 목록**:
  - `SUPABASE_URL`: Supabase 프로젝트 URL (필수)
  - `SUPABASE_ANON_KEY`: Supabase anon/publishable 키 (필수)
  - `TMAP_API_KEY`: SK OpenAPI Tmap 키 (필수)
  - `GEMINI_API_KEY`: Google Gemini 키 (선택)
- **`ctx.supabaseAdmin`**:
  - Edge Runtime 내부에서 주입되는 service_role 클라이언트이다. Worker 전용 RPC(`claim_recommendation_work_v2`, `finalize_recommendation_work_v2`, `fail_recommendation_work_v2`) 호출에 사용된다.

## 앱 선배포 및 외부 상태 사전 확인 체크리스트

서버 반영 전에 앱 배포 상태 및 외부 연동 상태를 사전 확인한다.

- [ ] **앱 선배포(7일 예고) 및 레거시 서버 동작 확인**:
  - 개인정보 처리방침 2판 시행일 준수를 위해 새 앱 빌드를 서버 반영 최소 7일 전에 먼저 스토어에 배포한다.
  - 서버가 S5 이전(레거시)인 상태에서 새 앱이 실행될 때, 식당 추천 기능이 오류나 무한 대기 없이 '추천 없이 진행' 경로로 부드럽게 동작하는지 확인한다.
- [ ] **외부 상태 확인 (코드 수정 불필요)**:
  - **Gemini 모델 ID 가용성 확인**: `supabase/functions/schedule-recommend/s5Recommendation.ts:169`에 하드코딩된 모델 식별자 `gemini-3.7-flash`가 실제 Google AI Studio / Vertex AI에서 호출 가능한 활성 모델인지 확인한다 (**확인 필요**).
  - **Tmap 주변 검색 API 응답 필드 및 요금 확인**: `https://apis.openapi.sk.com/tmap/pois/search/around`의 실제 응답에 `normalizeS5Pois`가 파싱하는 좌표(`frontLat`, `frontLon`), 업종 분류(`upperBizName`, `middleBizName`, `lowerBizName`, `detailBizName`), 주소(`upperAddrName`, `middleAddrName` 등)가 정확히 반환되는지 확인하고, 일일 쿼터 및 과금 기준을 확인한다 (**확인 필요**).
  - **새 빌드 산출물 위치 권한 제거 확인**: `app.json`의 `android.blockedPermissions`(`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`) 및 iOS `Info.plist` 설정에 따라, 실제 빌드된 Android APK/AAB의 매니페스트 및 iOS IPA에서 위치 접근 권한이 완전히 제거되었는지 확인한다.

## 운영 반영 전 체크리스트

아래 항목은 실제 대상·변경 값·검증 결과를 기록한다. 문서의 체크박스나 Develop 커밋 승인은 외부 상태 변경의 승인이 아니다.

- [ ] **Android 보안 저장소 백업 제외:** prebuild/EAS 빌드 산출물에서 `fullBackupContent`·`dataExtractionRules`와 SecureStore SharedPreferences 제외 규칙을 확인한다(현재 로컬 `android/`에는 규칙 없음).

- [ ] **별도 사용자 승인 필요 — M1~M7 운영 적용:** 확정 M7과 전체 SQL identity, 대상 프로젝트, 배포 창, 삭제 범위, 중간 실패 시 복구/forward fix 절차를 함께 승인받는다. 승인 전에는 실행하지 않는다.
- [ ] **삭제 전 집계:** M3 적용 전에 아래 읽기 전용 SQL로 비어 있지 않은 `profile_private.tastes` 행 수만 집계한다. 대상·조회 시각·건수를 기록하고 삭제 범위 승인에 포함한다. 답의 값 자체를 조회하거나 로그/임시 archive에 복제하지 않는다.

  ~~~sql
  select count(*) as legacy_taste_answers_to_delete
  from public.profile_private
  where tastes <> '{}'::jsonb;
  ~~~

- [ ] **운영 백업/PITR 존재 확인:** 실제 사용할 수 있는 운영 백업 또는 PITR 복구 지점이 있는지, 복구 가능한 시각·보존 범위·복구 절차를 확인하고 기록한다. 삭제 후 기존 답을 재구성할 수 있다고 가정하지 않는다. 복구 수단을 확인하지 못하면 데이터 삭제를 포함한 반영을 중단한다. 복구 실행은 별도 사용자 승인이 필요하다.
- [ ] **운영 pg_default_acl 사전 조회:** 이후 생성 객체에 service_role을 포함한 명시 GRANT가 필요한지 확인한다. 적용 후 실제 함수 ACL·search_path·다중 사용자 격리와 security advisors를 검증한다.
- [ ] **별도 사용자 승인 필요 — S5 DDL 운영 적용:** M1~M7 검증 완료 후, S5 마이그레이션 5개(`20261018131936` ~ `20261018173304`)의 전체 SQL identity, 대상 프로젝트, 배포 창, 권한, 중간 실패 시 forward fix 절차를 함께 승인받는다. 승인 전에는 실행하지 않는다.
- [ ] **별도 사용자 승인 필요 — 새 schedule-recommend Edge 배포:** M1~M7 및 S5 DDL 적용·검증 완료 후, 새 `schedule-recommend` Edge 배포를 승인받는다. 사전에 `TMAP_API_KEY` 등록 여부와 `GEMINI_API_KEY` 설정 여부를 확인한다.

## 보관 기한 작업·Auth 별도 승인 체크리스트

건강정보 파기 및 S5 추천 데이터 파기 예약은 아래 경로 중 하나를 선택하고 중복 등록하지 않는다. DB가 준비된 뒤 진행하며 Edge Function 배포만으로 예약 실행이 완료됐다고 판단하지 않는다.

- [ ] **별도 사용자 승인 필요 — 외부 스케줄러 경로:** `s1-health-retention` Edge Function 배포, 운영 secret store의 전용 scheduler 인증/자격 정보 설정, 외부 예약 서비스 등록을 승인받는다. 매일 03:00 Asia/Seoul 실행을 기준으로 실제 시간대와 성공 이력을 확인한다.
- [ ] **별도 사용자 승인 필요 — pg_cron 경로:** 필요한 extension 활성화와 `s1-health-retention-daily` 작업 등록을 승인받는다. UTC cron이면 `0 18 * * *`이며 서버 시간대·중복 job·실행 성공 이력을 확인한다. 외부 스케줄러 경로와 동시에 등록하지 않는다.
- [ ] **별도 사용자 승인 필요 — S5 추천 티켓·사용량 정리 작업 (`cleanup_recommendation_requests_v2`) 정기 실행 등록:** `private.recommendation_requests`(티켓)와 `private.recommendation_usage`(계정별 호출 원장)는 24시간 보관 후 파기 대상이다. `cleanup_recommendation_requests_v2(p_limit integer default 1000)`를 정기 실행(pg_cron 또는 외부 스케줄러)에 등록해야 한다. 미등록 시 `caller_id`가 포함된 티켓 및 호출 기록이 무기한 누적되어 24시간 보관 기간 고지와 불일치하게 된다. pg_cron 경로(`select public.cleanup_recommendation_requests_v2(1000);`) 또는 외부 스케줄러 경로 중 하나를 선택해 별도 승인을 받아 등록한다.
- [ ] **별도 사용자 승인 필요 — 운영 Auth Redirect URL:** `mealchat://auth/callback`과 `mealchat://auth/reset`을 등록하고 실제 앱의 이메일 확인/비밀번호 재설정 복귀를 검증한다.
- [ ] **별도 사용자 승인 필요 — 유출 비밀번호 보호:** 운영 Auth에서 유출 비밀번호 보호를 켜고 실제 거절 동작을 확인한다.
- [ ] **별도 사용자 승인 필요 — secure password change:** 현행 설정과 비밀번호 변경 화면의 재인증 흐름이 맞는지 확인하고, 변경이 필요하면 승인받은 값만 반영한다.
- [ ] **별도 사용자 승인 필요 — single session per user:** 현행 설정과 비밀번호 변경 뒤 다른 세션 처리 동작을 확인하고, 변경이 필요하면 승인받은 값만 반영한다.
- [ ] **별도 사용자 승인 필요 — CAPTCHA:** 현행 설정과 가입·비밀번호 변경/재설정 화면의 challenge 처리를 확인하고, 변경이 필요하면 승인받은 값만 반영한다.

**운영 Auth에 config push는 금지한다.** 변경 전 설정을 읽기 전용으로 확인하고, 별도 승인받은 필드만 Auth Management API로 부분 갱신한다. 전체 설정을 덮어쓰거나 관련 없는 값을 초기화하지 않는다. 각 변경 후 설정과 실제 앱 흐름을 다시 확인한다. 비밀 값은 문서·로그에 남기지 않는다.

## 운영 DDL 실행 경로와 이력 확인

Claude Code 자동 권한 검사기가 운영 DDL 실행을 막는 실행 환경에서는, **사용자가 검토·승인된 SQL을 Supabase SQL Editor에서 실행하고 메인이 읽기 전용으로 검증하는 흐름**을 사용할 수 있다. 권한 차단을 우회하는 도구 실행을 시도하지 않는다. 사용자는 확정 M7을 포함한 M1~M7 및 S5 마이그레이션 5개를 같은 배포 창에서 순서대로 연속 실행하며, 중간 실패 시 성공한 SQL identity·실제 schema/ACL을 기록하고 승인된 복구/forward fix 절차를 따른다. 메인은 원격 DDL을 대신 실행하지 않고 적용된 문서/bundle·함수 정의·권한·migration 이력을 읽기 전용으로 대조한다.

`20261017085900_revoke_invite_friend_to_room.sql`의 EXECUTE 회수는 **사용자가 운영 SQL Editor에서 이미 적용했다는 인계 사실**이다. 운영 migration 이력에는 없지만 해당 REVOKE는 멱등이므로 이후 승인된 적용 때 재실행해도 무해하다. 이 사실을 다른 M1~M7 및 S5 SQL의 재실행 안전성으로 확대하지 않는다.

**SQL Editor 실행 시 마이그레이션 이력 처리**:
SQL Editor 실행만으로 CLI migration 이력 테이블(`supabase_migrations.schema_migrations`)에 자동 기록되지 않는다. 수동 적용한 SQL identity·순서·성공 결과와 실제 이력을 대조하고, S5를 포함한 마이그레이션 파일들의 이력 정합성 처리 방식(예: `schema_migrations`에 적용 버전 INSERT 등)은 별도 검토·사용자 승인 후 확정한다. 그 전에는 후속 `db push`로 M1~M7 및 S5 DDL을 무심코 재실행하지 않는다.

## S5 운영 반영 후 검증 절차

S5 DDL 마이그레이션과 Edge Function 배포가 완료된 직후 다음 순서로 운영 상태를 검증하고 결과를 기록한다.

1. **함수·마이그레이션 식별자 확인**:
   - `supabase_migrations.schema_migrations` 또는 DB 스키마에서 S5 마이그레이션 5개 버전 반영 확인.
   - 신규 테이블 및 카탈로그 확인: `public.public_meeting_areas` (37개 공용 지역 행), `private.recommendation_requests`, `private.recommendation_usage`, `profile_food_preferences`, `profile_health_preferences` schema v2 확장.
   - RPC 식별자, `search_path=''`, 실행 권한 확인:
     - `authenticated` 전용 사용자 RPC: `begin_room_recommendation_v2`, `validate_my_recommendation_v2`, `get_food_profile_catalog_v2`, `get_my_food_preferences_v2`, `save_my_food_preferences_v2`, `mark_food_profile_prompt_v2`, `get_my_health_preferences_v2`, `save_my_health_preferences_v2`, `get_public_meeting_areas_v2`, `get_room_recommendation_settings_v2`, `set_room_recommendation_area_v2`, `set_room_public_cuisines_v2`.
     - `service_role` 전용 worker RPC: `claim_recommendation_work_v2`, `finalize_recommendation_work_v2`, `fail_recommendation_work_v2`, `cleanup_recommendation_requests_v2`.
     - `anon` 및 `authenticated`에서 worker RPC 실행 시 42501 차단 확인.
2. **다중 사용자 격리 테스트**:
   - 타인 행 RLS 차단: 타인의 `profile_food_preferences`, `profile_health_preferences`, `private.recommendation_requests`, `private.recommendation_usage`에 직접 접근 불가 확인.
   - 방 멤버십 격리: 방 멤버가 아닌 사용자의 `begin_room_recommendation_v2` 호출 차단 (42501).
   - 방장 권한 격리: 방장이 아닌 일반 멤버의 `set_room_recommendation_area_v2`, `set_room_public_cuisines_v2` 호출 차단 (42501).
   - claim 경합 격리: 동일 request_id에 대한 동시 claim 경합 시 단일 worker token 발급 및 202/200 정상 처리 확인.
3. **실제 Tmap/Gemini 1건 E2E**:
   - 승인된 실제 공용 만남 지역(예: 강남역)으로 1건의 v2 식당 추천 E2E 호출 실행.
   - Tmap 주변 검색 POI 수집 성공 및 반경/카테고리 정규화(최대 12개 후보) 확인.
   - Gemini 또는 rules fallback 순위 산출 확인.
   - 최종 응답 3개 이하 후보, `places_status: "ready"`, `evidence_status: "unverified"`, 점수/키워드/인원수 미노출 확인.
4. **Supabase security advisors 재실행**:
   - 운영 프로젝트 Security Advisor를 재실행하여 신규 테이블 RLS 활성화 여부, Security Definer 함수의 `search_path=''` 설정, 과도한 권한 노출 여부를 점검한다.

## S4 운영 반영 전 확인

- [ ] `supabase/tests/s4_legacy_place_inventory.sql`을 대상 DB에서 읽기 전용으로 실행하고 조회 시각·집계 건수를 기록한다. S4 이전 스키마에서도 실행할 수 있다(PostgreSQL 16+). 시간 미선택 place 방 전체/유효 일정이 없는 방/미제출 멤버가 있는 방/실제 멤버가 없는 방 및 미확정 scheduling/place에 열린 bill이 있는 방의 수만 반환하며 식별자·일정 원문을 출력하지 않는다. 운영에서는 아직 실행하지 않았다.
- [ ] 시간 없는 place 방은 실제 멤버의 일정 제출→방장 시간 선택→현재 투표 검증→최종 확정으로 복구한다. 시간·방장 확정 증거를 backfill하지 않는다.
- [ ] S4 3개 migration 뒤 `20261019022100_fix_settlement_null_participants.sql`과 `20261019022110_s4_confirmed_settlement_boundary.sql`, `20261020010000_s4_meeting_time_preview.sql`, `20261020020000_s4_settlement_restart_lifecycle.sql`, 최종 보강 `20261020030000_s4_revoke_update_settlement_amount.sql`(금액 RPC 회수·폐쇄 금액 보호·정산 단계 pending 초대 만료)을 포함한 최종 SQL identity를 검토한다. 새 정산은 confirmed 또는 방장 확정 시각이 있는 settling/done에서 생성하고 NULL-profile 표시행은 새 수취인에서 제외한다. 이전 정산 방의 데이터는 보존한다.
- [ ] 방장 확정 done의 새 bill 생성에서 settling/settled_at=NULL/유한 min(bill 생성+7일, 최초 방장 확정+30일), 완료 뒤 min(완료+24시간, 최초 확정+30일) 정리 기한, 기존 계좌 종료 보존을 확인한다. s4_legacy_place_inventory.sql의 expired_owner_confirmed_done_with_open_bill(복구 제외)·rooms_with_nonfinite_expiry도 사전 집계한다. 복구는 기존 expires_at과 원래 bill+7일/확정+30일이 모두 미래인 방만 허용하며 만료 방을 되살리지 않는다. settling/done의 코드 참가·초대 생성·수락은 S4003/hint=operation=membership로 거절되는지 확인한다. 미완료 만료 방 삭제 후 bill.room_id=NULL 및 기존 수취인 정산 권한 보존을 확인한다. 로컬 Edge issuer 설정은 LOCAL-RUN.md를 따르고 호스팅에는 MEALCHAT_LOCAL_AUTH_ISSUER를 등록하지 않는다.
- [ ] 직접 시간 선택은 preview_room_meeting_time_v1의 available_count/eligible_count를 표시한 뒤 방장이 결정한다. 저장에는 표시한 preview revision과 같은 구간을 사용하고 S4005이면 재조회·재확인한다. 새 조회 RPC의 STABLE·현재 멤버십·좁은 EXECUTE와 읽기/쓰기 비차단을 확인한다.
- [ ] 앱이 place의 `permissions.can_submit` 예외, `legacy_settlement_unverified`, `S4011`(요청 이력 상한), 정산 RPC의 `S4008/SETTLEMENT_REQUIRES_CONFIRMATION`을 처리하는지 확인한다. 일정 변경 이력은 사용자1,000/방1,000×max(5,실제 참가자 수)행으로 제한하며 방장 시간 선택·확정은 제외한다. 같은 일정 재제출은 이력을 추가하지 않는다. 기록된 성공 ID replay를 보존한다. S4008은 hint의 operation=settlement/vote_confirmation으로 분기한다. 새 cron 등록은 없다.
- [ ] 별도 승인된 운영 반영 뒤 migration/function identity·ACL·다중 사용자 격리·읽기/쓰기 경합·정산 gate·앱 왕복을 확인하고 security advisors를 다시 실행한다. 이 문서는 원격 변경 승인이 아니다.

## S3 운영 반영 절차 — S1 → S5 → S4 검증 완료 후

정본은 `docs/S3-design.md` §12·14·15이며, 선행 순서는 **확정 M7 포함 S1 → S5 → S4(최종 `20261020040000_s4_lock_amount_after_payment.sql` 포함) 적용·검증 → S3 준비 → 예약 등록·관측 → S3 활성화 → 별도 정리 시작**이다. 상단의 법률 문서 출시 차단을 유지한다. 구현 재검토 통과나 이 문서의 체크 완료는 운영 반영·D9 법률 문안의 승인이 아니며, 대상 프로젝트·SQL identity·배포 창·단축/삭제 범위를 포함한 별도 사용자 승인이 필요하다.

### S3 준비 마이그레이션 목록 (타임스탬프 순서)

1. `supabase/migrations/20261021010000_s3_lifecycle_storage.sql` — 수명·초대·위임·요청 저장소, RLS/ACL·인덱스.
2. `supabase/migrations/20261021010100_s3_membership_owner_core.sql` — 생성·나가기·종료·위임 core와 서버 이벤트.
3. `supabase/migrations/20261021010200_s3_invite_core.sql` — 코드 TTL·재발급·미리보기·공유 시도 제한.
4. `supabase/migrations/20261021010300_s3_cleanup_core.sql` — 비활성 worker와 제한된 실행 역할·진입점.
5. `supabase/migrations/20261021010400_s3_activate_lifecycle.sql` — **활성화 준비만**: 수명 guard·정산 hook·Q1 집계 함수.

이 5개만으로는 capability를 공개하거나 D10/R1 EXECUTE·D11/rooms 직접 INSERT를 회수하지 않고, scheduler도 등록하지 않는다. 기존 migration을 고치거나 아래 보류 파일을 자동 migration 입력으로 옮기지 않는다.

### 적용 전 증거와 사전 집계

- [ ] **운영 Postgres 버전 읽기 전용 확인:** 아래 SQL의 버전·조회 시각을 기록한다. 로컬 검증은 PG17이며 **PG15 역할/소유권 전환 분기는 미검증**이다. 운영이 PG15이면 같은 버전의 격리 환경에서 migration·역할/ACL·cron·release gate를 검증하고 재검토한 뒤 반영한다. 이 확인을 위해 운영 버전을 바꾸지 않는다.

  ```sql
  begin transaction read only;
  select statement_timestamp() as observed_at,
         current_setting('server_version') as server_version,
         current_setting('server_version_num')::integer as server_version_num;
  rollback;
  ```

- [ ] **D10 베타 앱 호출 부재:** 배포할 베타의 artifact digest·versionCode·소스 commit을 고정하고 `post_room_system_message` 호출 제거와 대체 서버 이벤트 경로를 확인한다. §15 Q2/Q3의 권한·함수/SQL 호출 통계를 함께 검토하며, 통계 없음·관측 기간 불명은 `미확인`이다. 관측 0건만으로 베타 호출 부재를 승인하지 않는다.
- [ ] **D11 새 베타 최소 버전:** 지원할 최소 versionCode와 실제 배포 artifact를 확인한다. 해당 베타가 S3 지원 감지 뒤 새 생성 RPC를 사용하고 rooms 직접 INSERT를 쓰지 않으며, 구 서버에서만 허용된 fallback이 동작하는지 검증한다. §15 Q3/Q4의 호출 후보·table/column grant·RLS를 대조하고 구 앱 영향과 전환 계획을 승인받는다.
- [ ] **§15 사전 집계 SQL:** `supabase/tests/s3_inventory.sql`의 Q0→Q1→Q2/Q3/Q4를 승인된 읽기 전용 세션에서 실행하고 조회 시각·건수·스키마/함수 identity를 기록한다. Q3은 실제 extension schema와 접근 가능 여부를 먼저 확인하며 통계를 reset하지 않는다. 이름·코드·채팅·식별자 원문은 출력하지 않는다. D8의 불명 기점 대상과 최대7일 이내의 고정 전환 마감일, 기존 만료 방을 되살리지 않는 단축 범위를 검토한다.
- [ ] **베타 사용자 기한 안내:** 약속 확정·정산을 시작해도 방 기한(생성+7일)은 늘지 않아 미완료 정산이 남은 채 방이 삭제될 수 있음을 안내한다. 정산 기록은 방·채팅과 분리 보존된다.
- [ ] **시간 민감한 Q1 기대 건수:** 준비 migration 적용 뒤 아래 읽기 전용 조회로 같은 Q1의 11개 건수 JSON을 얻고, **집계 직후 승인된 활성화에 적용**한다. 코드 형식 불일치와 정규화 후 중복에 속한 방 수도 검토한다. 값을 생략하거나 일부 키만 전달하지 않고 `mealchat.s3.expected_inventory`에 그대로 입력한다. 시간이 지나거나 쓰기가 발생하면 건수가 달라질 수 있으므로, `S3_INVENTORY_COUNT_MISMATCH`이면 적용을 중단하고 재집계·대상 검토 후 새 기대 건수를 사용한다. 실패를 0건으로 대체하거나 검사를 우회하지 않는다.

  ```sql
  begin transaction read only;
  select statement_timestamp() as observed_at,
         private.s3_inventory_counts() as expected_inventory;
  rollback;
  ```

- [ ] **D8 잠금·복구 준비:** 유지보수 창에서 구 앱 쓰기를 정지하고 백업/PITR·복구 절차·Q1 total_rooms 대비 공유 advisory lock 용량을 확인한다. 방별 lock은 commit까지 누적된다. 용량이 부족한 대규모 대상은 별도 배치 절차 승인 전 실행하지 않는다(`supabase/tests/S3-A-REPORT.md`의 운영 제한 참조).
- [ ] **다계정 추측 잔여 위험:** 32^6 코드 공간과 계정당200회/일 제한만으로 다계정 합산 추측을 막을 수 없다. 가입 남용 제한과 다계정/분산 요청·실패율·잠금 비율 알람을 확인한다. 현재 DB 구현을 IP 제한으로 설명하지 않는다.
- [ ] **REST 본문 크기 제한:** DB 도달 전 gateway/프록시의 적용 계층·허용 byte 수·초과 요청 거절과 direct REST/RPC 우회 경로를 확인한다. SQL 코드 입력64byte 제한은 전체 HTTP 본문 제한을 대신하지 않는다. 상한·적용 위치는 아직 미확정이므로 임의 수치로 완료 처리하지 않는다.

### 보류 파일 적용 조건과 순서 (각 외부 변경 별도 사용자 승인)

1. **`supabase/release/s3_schedule_cleanup.sql`: 예약 등록·관측.** 준비5개와 역할/ACL 검증, pg_cron 준비 및 중복 job 부재를 확인하고 cleanup OFF에서 `postgres`가 등록한다. 호스티드 superuser를 요구하지 않으며 고정 command는 NOLOGIN worker 소유 `private.run_s3_job_v1(text)`만 호출한다. `s3-room-expiry-v1`·`s3-transfer-expiry-v1`은 매분, `s3-ephemeral-purge-v1`은 5분마다 실행한다. 세 job의 username·database·command·schedule·active와 실제 성공 기록을 검증하고 관측 시작 시각을 남긴다. OFF 상태의 성공은 실제 데이터 삭제 증거가 아니다.
2. **`supabase/release/s3_activate_lifecycle.sql`: D8·D10·D11·capability 활성화.** 위 베타/D10/D11 증거, scheduler 성공 관측, 직전 Q1 기대11개 건수, 승인된 고정 전환 마감일을 모두 확인한 후 실행한다. 세션 입력은 `mealchat.s3.beta_artifact_sha256`, `mealchat.s3.beta_version`, `mealchat.s3.transition_at`, `mealchat.s3.scheduler_observed_after`, `mealchat.s3.expected_inventory`다. table lock 뒤 기대 건수가 다르거나 writer advisory가 바쁘면 전체 중단한다. 성공하면 D8 단축·legacy 교체·R1/직접 INSERT 회수·새 grant·capability가 한 transaction으로 반영되며 **cleanup은 OFF로 남는다.**
3. **활성화 후 정리 시작 전 확인:** S4/S3 기능·멤버십 격리·신구 앱·ACL·security advisors를 확인하고 활성화 영수증 `activated_at`을 기록한다. release gate의 활성화 전 S4 503건, 후495건/정확한 구 계약 예상 실패8건 목록을 기준으로 예상 외 실패를 차단한다. **이 간격에는 만료 방의 접근만 닫히고 S3 예약 정리로 물리 삭제되지 않는다.** 보관 위험·간격·시작 시각을 검토하여 이 상태를 무기한 두지 않는다. 방장의 허용된 즉시 종료는 별도 사용자 동작이다.
4. **`supabase/release/s3_start_cleanup.sql`: 파괴적 정리 시작.** 활성화 후 검증과 삭제 범위 승인이 끝나면 정확한 `activated_at` 영수증을 `mealchat.s3.cleanup_approved_activation`에 입력하여 별도 실행한다. 그 뒤 실제 background 삭제·위임 만료·임시 자료 정리, 실패 건수·가장 오래 지난 기한·cron 지연 알람을 확인한다. 정산 snapshot은 방/채팅과 별도로 보존되는지 검증한다. 만료 시점의 접근 차단을 물리 삭제 시각·앱 캐시·백업 삭제 증거로 확대하지 않는다.

### D9 처리방침 문구 초안 — 사용자 승인 필요

현재 `src/legal/privacy.ts`의 “채팅 기록: 방이 사라질 때(정산 뒤 24시간)까지”를 대신할 **미승인 초안**이다. 이번 작업에서는 법률 원문을 변경하지 않는다. 최종 문안·예고·시행일·재동의 검토를 승인받은 뒤 별도 작업으로 원문·canonical/hash·앱/서버 문서 일치를 처리한다.

- **짧은 안 (2문장):** 채팅 기록은 기본적으로 방 생성 후 7일까지 보관하고, 정산을 모두 마치면 완료 후 24시간과 최초 약속 확정 후 30일 중 먼저 오는 때까지 보관해요. 재정산을 시작하면 시작 후 7일과 같은 30일 상한 중 먼저 오는 때로 기한을 다시 정하고 만료 후 예약 정리하며, 미완료 정산이 없는 방을 방장이 종료하면 즉시 삭제해요.
- **자세한 안 (2문장):** 채팅 기록의 기본 기한은 방 생성 후 7일이며 첫 정산을 시작해도 이 기한을 자동으로 늘리지 않고, 모든 열린 정산이 완료되면 완료 후 24시간과 최초 약속 확정 후 30일 중 먼저 오는 때로, 재정산을 시작하면 그 시작 후 7일과 최초 약속 확정 후 30일 중 먼저 오는 때로 기한을 다시 정해요. 기한이 지나면 방 접근을 닫고 예약된 정리 작업으로 채팅을 삭제하며, 미완료 정산이 없는 방을 방장이 종료하면 정리 작업을 기다리지 않고 방과 채팅을 즉시 삭제하고 정산 기록은 별도로 보관해요.

## Develop 커밋 후 주의

**운영 반영 승인 전까지 Develop에서 `supabase db push`는 금지한다.** M7이 빠진 채 M6의 필수 약관 gate만 적용되면 유효한 current bundle이 없어 S1006으로 전체 서비스 접근이 차단된다. M1~M6만 먼저 배포하지 않는다.

**Develop→main 병합 전에도 이 위험을 다시 판단한다.** 병합할 migration 목록, 확정 M7 포함 여부·시행 시각, `release:check` 결과, 운영 적용/migration 이력, 별도 운영 승인 상태와 DB→Edge 배포 순서를 재확인한다. Develop 커밋 조건부 승인은 병합 또는 운영 반영을 자동 승인하지 않는다.

- 새 `schedule-recommend` Edge 배포는 M1~M7 및 S5 DDL 적용·검증 직후 진행하며, 앱 측은 레거시 서버에서 시간 추천을 비활성화하고 식당 추천은 '추천 없이 진행'으로 동작시킨다.
