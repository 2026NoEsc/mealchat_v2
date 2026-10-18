# S1 앱·개인정보 처리방침 2판 배포

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
5. **별도 사용자 승인 필요 — 새 `schedule-recommend`는 M1~M7 적용·검증 후에만 배포한다.** 새 `consentGate.ts:19`는 `get_my_consent_status`를 호출한다. DB보다 먼저 배포하면 RPC/동의 구성이 준비되지 않아 추천 요청이 모두 503으로 막힌다. DB 검증이 실패했으면 새 Edge Function도 배포하지 않는다. 배포 후 실제 호출로 현재 약관 동의자의 정상 경로와 미동의자의 차단을 검증한다.

현재 개발 quality는 M7 존재를 요구하지 않는다. M7이 migrations에 들어 있을 때 미확정 상수·잘못된 hash 등을 거절하며, 로컬 seed 일치와 배포 게이트 회귀도 실행한다. 개발 quality 통과는 배포 준비 완료가 아니다. 배포 전에는 기본값도 엄격 모드인 node supabase/release/check.mjs --release가 별도로 반드시 통과해야 한다. 이 읽기 전용 검사는 원격 CLI 자체를 가로채지는 않으므로 수동 SQL/CLI 반영도 같은 게이트와 개별 승인 절차를 따라야 한다.

seed.sql은 config.toml의 [db.seed]에 연결되어 로컬 start/reset 뒤에 실행된다. 일반 db push에는 seed가 포함되지 않으며, 운영에는 --include-seed를 사용하거나 seed SQL을 직접 실행하지 않는다. 미확정 템플릿을 migrations로 복사해서 로컬 reset을 해결하지 않는다.

운영 CLI 경로는 별도 승인된 `db push`만 사용하며, `--include-seed`·`db reset --linked`는 금지한다. 자동 권한 검사로 DDL 실행이 차단되면 아래 SQL Editor 경로를 사용한다. 이 문구는 운영 CLI 실행 승인이 아니다.


## 운영 반영 전 체크리스트

아래 항목은 실제 대상·변경 값·검증 결과를 기록한다. 문서의 체크박스나 Develop 커밋 승인은 외부 상태 변경의 승인이 아니다.

- [ ] **별도 사용자 승인 필요 — M1~M7 운영 적용:** 확정 M7과 전체 SQL identity, 대상 프로젝트, 배포 창, 삭제 범위, 중간 실패 시 복구/forward fix 절차를 함께 승인받는다. 승인 전에는 실행하지 않는다.
- [ ] **삭제 전 집계:** M3 적용 전에 아래 읽기 전용 SQL로 비어 있지 않은 `profile_private.tastes` 행 수만 집계한다. 대상·조회 시각·건수를 기록하고 삭제 범위 승인에 포함한다. 답의 값 자체를 조회하거나 로그/임시 archive에 복제하지 않는다.

  ~~~sql
  select count(*) as legacy_taste_answers_to_delete
  from public.profile_private
  where tastes <> '{}'::jsonb;
  ~~~

- [ ] **운영 백업/PITR 존재 확인:** 실제 사용할 수 있는 운영 백업 또는 PITR 복구 지점이 있는지, 복구 가능한 시각·보존 범위·복구 절차를 확인하고 기록한다. 삭제 후 기존 답을 재구성할 수 있다고 가정하지 않는다. 복구 수단을 확인하지 못하면 데이터 삭제를 포함한 반영을 중단한다. 복구 실행은 별도 사용자 승인이 필요하다.
- [ ] **운영 pg_default_acl 사전 조회:** 이후 생성 객체에 service_role을 포함한 명시 GRANT가 필요한지 확인한다. 적용 후 실제 함수 ACL·search_path·다중 사용자 격리와 security advisors를 검증한다.

## 보관 기한 작업·Auth 별도 승인 체크리스트

건강정보 파기 예약은 아래 두 경로 중 하나를 선택하고 중복 등록하지 않는다. DB가 준비된 뒤 진행하며 Edge Function 배포만으로 예약 실행이 완료됐다고 판단하지 않는다.

- [ ] **별도 사용자 승인 필요 — 외부 스케줄러 경로:** `s1-health-retention` Edge Function 배포, 운영 secret store의 전용 scheduler 인증/자격 정보 설정, 외부 예약 서비스 등록을 승인받는다. 매일 03:00 Asia/Seoul 실행을 기준으로 실제 시간대와 성공 이력을 확인한다.
- [ ] **별도 사용자 승인 필요 — pg_cron 경로:** 필요한 extension 활성화와 `s1-health-retention-daily` 작업 등록을 승인받는다. UTC cron이면 `0 18 * * *`이며 서버 시간대·중복 job·실행 성공 이력을 확인한다. 외부 스케줄러 경로와 동시에 등록하지 않는다.
- [ ] **별도 사용자 승인 필요 — 운영 Auth Redirect URL:** `mealchat://auth/callback`과 `mealchat://auth/reset`을 등록하고 실제 앱의 이메일 확인/비밀번호 재설정 복귀를 검증한다.
- [ ] **별도 사용자 승인 필요 — 유출 비밀번호 보호:** 운영 Auth에서 유출 비밀번호 보호를 켜고 실제 거절 동작을 확인한다.
- [ ] **별도 사용자 승인 필요 — secure password change:** 현행 설정과 비밀번호 변경 화면의 재인증 흐름이 맞는지 확인하고, 변경이 필요하면 승인받은 값만 반영한다.
- [ ] **별도 사용자 승인 필요 — single session per user:** 현행 설정과 비밀번호 변경 뒤 다른 세션 처리 동작을 확인하고, 변경이 필요하면 승인받은 값만 반영한다.
- [ ] **별도 사용자 승인 필요 — CAPTCHA:** 현행 설정과 가입·비밀번호 변경/재설정 화면의 challenge 처리를 확인하고, 변경이 필요하면 승인받은 값만 반영한다.

**운영 Auth에 config push는 금지한다.** 변경 전 설정을 읽기 전용으로 확인하고, 별도 승인받은 필드만 Auth Management API로 부분 갱신한다. 전체 설정을 덮어쓰거나 관련 없는 값을 초기화하지 않는다. 각 변경 후 설정과 실제 앱 흐름을 다시 확인한다. 비밀 값은 문서·로그에 남기지 않는다.

## 운영 DDL 실행 경로와 이력 확인

Claude Code 자동 권한 검사기가 운영 DDL 실행을 막는 실행 환경에서는, **사용자가 검토·승인된 SQL을 Supabase SQL Editor에서 실행하고 메인이 읽기 전용으로 검증하는 흐름**을 사용할 수 있다. 권한 차단을 우회하는 도구 실행을 시도하지 않는다. 사용자는 확정 M7을 포함한 M1~M7을 같은 배포 창에서 순서대로 연속 실행하며, 중간 실패 시 성공한 SQL identity·실제 schema/ACL을 기록하고 승인된 복구/forward fix 절차를 따른다. 메인은 원격 DDL을 대신 실행하지 않고 적용된 문서/bundle·함수 정의·권한·migration 이력을 읽기 전용으로 대조한다.

`20261017085900_revoke_invite_friend_to_room.sql`의 EXECUTE 회수는 **사용자가 운영 SQL Editor에서 이미 적용했다는 인계 사실**이다. 운영 migration 이력에는 없지만 해당 REVOKE는 멱등이므로 이후 승인된 적용 때 재실행해도 무해하다. 이 사실을 다른 M1~M7 SQL의 재실행 안전성으로 확대하지 않는다.

SQL Editor 실행만으로 CLI migration 이력에 자동 기록된다고 가정하지 않는다. 수동 적용한 SQL identity·순서·성공 결과와 실제 이력을 대조하고, 이력 정합성 처리 방식은 별도 검토·사용자 승인 후 확정한다. 그 전에는 후속 `db push`로 M1~M7을 무심코 재실행하지 않는다.

## Develop 커밋 후 주의

**운영 반영 승인 전까지 Develop에서 `supabase db push`는 금지한다.** M7이 빠진 채 M6의 필수 약관 gate만 적용되면 유효한 current bundle이 없어 S1006으로 전체 서비스 접근이 차단된다. M1~M6만 먼저 배포하지 않는다.

**Develop→main 병합 전에도 이 위험을 다시 판단한다.** 병합할 migration 목록, 확정 M7 포함 여부·시행 시각, `release:check` 결과, 운영 적용/migration 이력, 별도 운영 승인 상태와 DB→Edge 배포 순서를 재확인한다. Develop 커밋 조건부 승인은 병합 또는 운영 반영을 자동 승인하지 않는다.
