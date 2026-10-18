# S1 구현 명세: 정보 공개·선택 동의·약관

작성 기준: 2026-10-17. 이 문서는 로컬 구현 계약이며 운영 반영 증거가 아니다. 사용자 확정 결정이 이전 설계 제안보다 우선한다. 작업자 A와 B는 아래 RPC 이름·인자·응답·오류 계약을 공유하며 임의로 별도 계약을 만들지 않는다.

## 1. 범위, 확정 결정, 완료 조건

### S1에서 구현

1. 같은 **유효한 방**의 현재 메이트에게만 공개 스위치 적용. 친구만인 사용자와 무관한 인증 사용자는 공개 신원만 조회한다. `follows`는 개인정보 열람 권한의 근거가 아니다.
2. **정산 요청 행위 자체가 해당 정산의 계좌 공개 동의**다. 고정 정산 참여자·생성자에게 미완료 정산의 계좌만 반환한다. 프로필 계좌 스위치 OFF는 이미 요청한 정산의 계좌를 숨기지 않는다. 완료된 정산에서는 계좌 원문을 반환하지 않는다.
3. 건강정보는 별도 선택 동의. 가입 약관 화면에 선택 항목을 유지한다. 미동의 사용자는 S5 음식 프로필 STEP 2 진입 시 다시 묻는다. 필수 가입 조건에 포함하지 않는다.
4. 건강 동의 시각부터 달력 기준 1년. 만료 시각부터 읽기·저장·추천 사용 즉시 금지. 물리 삭제는 하루 1회 배치. 거절·철회는 상태 변경과 데이터 삭제를 한 트랜잭션으로 수행한다.
5. 마케팅 상태와 다음 2년 재확인 시점만 기록한다. 안내 수단이 마련될 때까지 **광고성 발송은 전부 비활성**이다. 발송 테이블·큐·안내 작업은 S1에 만들지 않는다.
6. 필수 약관 재동의 전에는 문서 보기, 로그아웃, 계정 삭제 진입 경로, 선택 동의 철회만 허용한다. 동의 상태 확인·동의 제출은 이 흐름을 위한 제어 API로 허용한다. 그 외 앱 기능과 사용자 데이터 API는 차단한다. 조회 실패·빈 응답·미확인은 동의 완료가 아니다.
7. 서비스 약관 2판·개인정보 처리방침 1판, 시행일 2026-10-01에 대한 버전 일치와 재동의를 구현한다.

### 비범위와 인계

- S2: 실제 계정 삭제/Auth 사용자 삭제, 남는 밥약·정산 기록의 `탈퇴한 메이트` 익명화, 저장소 파일 삭제, 백업 파기 운영. S1 신규 개인 테이블은 삭제 CASCADE를 사용하고 이 경로를 약관 gate에서 막지 않는다. S1에서 삭제 성공을 흉내 내지 않는다.
- S5: 음식 프로필 STEP 1/2 화면, 건강 코드 목록의 제품 확정, 재료 데이터 기반 추천 제외 로직, 새로운 중간 지점 추천 흐름. S1은 저장 위치·동의 검사·RPC 계약과 레거시 우회 차단을 제공한다.
- 기존 `meeting_midpoint` 재개방은 범위 밖이다. `20260906141801_contain_meeting_midpoint.sql`의 EXECUTE 회수를 유지한다. 정밀 평균 좌표는 2인 집단에서 다른 사람 좌표를 역산할 수 있으므로 단순 재허용하지 않는다.
- 마케팅 발송, 원격 마이그레이션, 운영 cron 등록, Edge Function 배포는 이번 로컬 구현 완료에 포함하지 않는다.
- 비밀번호 복구 등 로그인 복원은 Auth의 선행 흐름이다. 복구가 끝나도 필수 약관 gate를 우회하여 앱 본문에 진입하지 않는다.

S1 완료는 최신 로컬 DB 재구성/기존 데이터 업그레이드, 다중 사용자 격리 SQL, 앱 테스트, `npm run quality`, 독립 보안 검토 통과로 판정한다. 운영 완료라고 보고하려면 별도 승인된 반영과 사후 검증이 필요하다.

## 2. 현재 근거와 구현 시 주의할 경계

| 근거 | 확인 내용 |
|---|---|
| `supabase/migrations/20260817173500_private_profile_split.sql:17,119,136` | 본인 전용 `profile_private`, 개인정보/공개 설정/취향 JSON 직접 쓰기 grant |
| `src/screens/profile/PrivacyScreen.tsx:15,39,43,52` | `birth/account` 별칭, 정산·출발지 설명, JSON 전체 교체 |
| `supabase/migrations/20260817131934_security_auth_foundation.sql:283,312,374` | 공개 신원 전체 인증 조회, 참가자 같은 방 조회, table grant |
| `supabase/migrations/20260817200241_open_room_features.sql:214` | 일방향 follows 생성 가능 |
| `supabase/migrations/20260823072701_harden_settlement_invitation_events.sql:435,620,742` | 고정 정산 참여자 권한, bill 및 notification 계좌 사본 |
| `supabase/migrations/20260908120000_settlement_stage_transitions.sql:18` | 정산 생성·멤버 완료와 방 단계 연결. 계좌 종료 판정은 방 단계만 믿지 말 것 |
| `supabase/migrations/20260817144252_terms_consent_records.sql:18` | 구 약관 `2026-08-17`, 건강 kind 없음 |
| `supabase/migrations/20260817173500_private_profile_split.sql:89` | 가입 트리거가 필수 동의를 무조건 true 기록 |
| `supabase/migrations/20260817193123_terms_reconsent_rpc.sql:60` | service의 과거 true 존재만 확인 |
| `src/lib/consents.ts:22`, `src/consents/useConsentGate.ts:47`, `App.tsx`의 `ConsentGate` | 빈 결과/실패 시 진입 허용하는 계약 수정 필요 |
| `src/auth/pendingSignupProfile.ts:14`, `src/auth/AuthProvider.tsx:202` | 이메일 확인 대기 프로필, 세션 생성 후 자동 저장 순서 수정 필요 |
| `src/legal/terms.ts:4`, `src/legal/privacy.ts:3` | 서비스 2판, 개인정보 1판 원문 |
| `src/lib/tasteKeywords.ts:8`, `src/lib/placeCandidates.ts:43` | 6개 비민감 취향 키, 폐쇄된 midpoint의 남은 호출부 |
| `supabase/functions/schedule-recommend/index.ts:254,321` | admin 조회 후 제공자 요청. 사용자 약관 검사를 별도로 넣어야 함 |
| `supabase/tests/20260823_rpc_hardening.sql:1` | 트랜잭션 내 pgTAP 및 역할 전환 테스트 선례 |
| `scripts/test-rpc-additive-compat.ps1:1`, `scripts/test-rpc-concurrency.ps1:1` | 로컬 Docker psql에 SQL을 stdin으로 전달하는 선례 |

위 행 번호는 작성 당시 작업 트리 기준이다. 동시 작업 때문에 바뀔 수 있다. 실제 운영 데이터의 존재·내용, remote migration identity는 확인하지 않았다. 과거 WORKFLOW의 운영 상태 문구를 현재 증거로 사용하지 않는다.

## 3. 권한과 상태의 정의

### 3.1 공개 범위

`valid_room(room_id)` = 방 존재 AND `expires_at > server_now`. `current_mates` = 같은 valid_room에 caller와 target의 `participants.profile_id`가 모두 존재. owner라는 사실만으로 멤버십 검사를 생략하지 않는다. 초대 대기·follows·과거 참가 기록은 해당하지 않는다.

| 조회자 | 공개 신원 | birthdate/gender/bio | 프로필 bank_account | 출발지 원문·좌표 | 건강정보 |
|---|---|---|---|---|---|
| 본인, 필수 약관 동의 완료 | 허용 | 허용 | 허용 | 본인 조회만 | 유효한 건강 동의 때 본인 전용 API만 |
| 같은 valid_room 현재 메이트 | 허용 | 해당 스위치 public만 | 스위치 public만 | 반환 금지 | 반환 금지 |
| 친구만/무관한 인증 사용자 | 허용 | 반환 금지 | 반환 금지 | 반환 금지 | 반환 금지 |
| 미인증 | 반환 금지 | 반환 금지 | 반환 금지 | 반환 금지 | 반환 금지 |
| 필수 약관 pending/error | 문서/동의 제어 API 외 차단 | 차단 | 차단 | 차단 | 철회 제어만 허용 |

정식 키: `birthdate`, `gender`, `bio`, `bank_account`, `origin`. 값: `public | private`. `public`은 인터넷 공개가 아니라 이 표의 필드별 이용 범위다. origin 스위치는 서버 계산 사용 여부이며 프로필에 원문을 공개한다는 뜻이 아니다. 신규 기본값은 5개 모두 private. 레거시의 명확한 저장값은 이전 규칙에 따라 유지한다. 초기 스위치는 서버에서 불러오고 로딩 중 수정 불가.

일반 프로필의 `bank_account`와 **정산 계좌**는 서로 다른 계약이다. 정산 계좌를 반환하는 근거는 아래 3.2이며 스위치와 독립적이다. 프로필 공개 범위를 OFF로 바꿔도 정산 공개 동의가 철회되는 UI를 표시하지 않는다.

### 3.2 정산 계좌

- `bill_recipient` = `bill.creator_id = caller` OR 생성 때 고정된 `dutch_pay_members`에 caller 존재. 방에 나중에 가입한 사람은 제외한다. 방을 떠난 고정 참여자는 미완료 정산을 계속 조회할 수 있다.
- `bill_completed` = 멤버가 1명 이상이고 `NOT EXISTS(member WHERE NOT is_completed)`. `rooms.stage`, `rooms.settled_at`, 방 존재 여부만으로 판정하지 않는다.
- 원문 반환 조건: 필수 약관 완료 AND bill_recipient AND 검증된 정산 요청 근거 있음 AND `payment_disclosure_closed_at IS NULL` AND 미완료. 멤버가 0명이면 계좌 반환 금지.
- 한번 완료된 정산은 `payment_disclosure_closed_at`을 서버가 설정한다. 이후 완료 표시를 되돌리는 기존 동작이 있더라도 계좌는 다시 공개하지 않는다. 새 공개는 새로운 정산 요청으로만 가능하다. 이미 완료된 bill의 계좌를 업데이트하는 경로도 거절한다.
- 완료 시 bill의 계좌 원문 3개 열을 빈 문자열로 파기한다. 금액·분담 인원·완료 상태는 유지한다. 사용자 프로필의 자기 계좌는 지우지 않는다.
- `notifications`의 `bank_name/account_number`는 새 사본을 만들지 않는다. 기존 행은 전체 빈 문자열로 정리하고 CHECK로 다시 채우지 못하게 한다. 클라이언트는 `settlement_id`로 계좌 API를 호출한다.
- 모든 민감 조회는 요청 시점 권한을 검사한다. 이미 사용자에게 전달된 값·외부 송금 앱에 넘긴 값을 서버가 회수할 수 있다는 보장은 하지 않는다. 앱은 완료/포그라운드/화면 이탈 때 계좌 캐시를 버리고 송금 실행 직전에 다시 조회한다.

### 3.3 시간·동시성·동의 상태

- 시간은 timestamptz로 보관하고 JSON에는 UTC ISO 8601을 반환한다. `server_now`는 `clock_timestamp()`를 사용하며 잠금 대기 후 다시 얻는다. 장시간 트랜잭션의 `now()`로 만료를 연장하지 않는다.
- 기한 계산: `(granted_at AT TIME ZONE 'Asia/Seoul' + interval '1 year') AT TIME ZONE 'Asia/Seoul'`. 마케팅은 `2 years`. 2월 29일의 다음 비윤년 기념일은 2월 28일 같은 현지 시각이다.
- 상태: `not_asked | granted | declined | withdrawn | expired`. 미생성 상태는 not_asked로 응답한다. health는 저장 상태가 granted라도 `server_now >= valid_until`이면 즉시 expired로 판정한다.
- 마케팅 기한은 만료 시각이 아니다. `confirmation_due = status = granted AND server_now >= next_confirmation_at`. S1 응답의 `sending_enabled`는 항상 false다. 접속/설정 조회만으로 다음 시점을 갱신하지 않는다.
- 필수 약관은 service와 privacy 각각 최신 사건이 현재 bundle의 문서에 agreed=true여야 한다. 과거 EXISTS(true), JWT 메타데이터, 클라이언트 캐시는 판정 근거가 아니다.
- 본인 동의 변경은 `profiles`의 본인 행을 `FOR UPDATE`로 잠근 뒤 수행한다. 가입·필수 동의·선택 동의·건강 저장·파기 모두 이 순서를 공유한다. 정산 경로는 기존 방 advisory lock → room row → bill row 순서를 유지한다. 필수 동의 판정은 lock 획득 후 재검사한다.
- 배치와 재동의의 경쟁에서 배치는 최신 유효 동의에 묶인 데이터를 삭제하지 않는다. 재동의는 만료된 건강 데이터를 되살리지 않는다. 만료 후 재동의 시 이전 행부터 삭제하고 새 입력을 받는다.
- request_id 재시도는 동일 요청을 다시 실행하지 않는다. 같은 request_id에 다른 payload는 S1007. 이전 요청 이후 철회/새 동의가 있으면 이전 grant 재시도가 그 상태를 되돌리지 않는다.

## 4. 약관 번들·원문·해시

### 4.1 고정 식별자

| 대상 | version | edition | effective_from |
|---|---|---|---|
| 필수 bundle | `mealchat-2026-10-01-r1` | 해당 없음 | `2026-09-30T15:00:00Z` |
| 서비스 | `service-2026-10-01-v2` | 2 | `2026-09-30T15:00:00Z` |
| 개인정보 | `privacy-2026-10-01-v1` | 1 | `2026-09-30T15:00:00Z` |
| 건강 선택 동의 | `health-2026-10-17-v1` | 1 | `2026-10-16T15:00:00Z` |
| 마케팅 선택 동의 | `marketing-2026-10-17-v1` | 1 | `2026-10-16T15:00:00Z` |

`published_at`은 실제 등록 시각이다. 시행일과 게시·동의 시각을 섞지 않는다. 구 `2026-08-17` 행과 그 동의 기록은 보존하며 새 bundle 동의로 backfill하지 않는다.

### 4.2 해시의 정확한 산출 계약

파일 바이트가 아니라 `src/legal/*.ts`가 export하는 LegalDocument의 실제 문서 데이터를 해시한다. TypeScript 주석/줄바꿈/포맷 변경은 법률 문서 변경으로 취급하지 않는다.

1. 모든 문자열은 CRLF/CR → LF, Unicode NFC. trim·공백 축약·배열 재정렬 금지.
2. 다음 순서로 새 JS 객체를 만든다: `id`, `title`, `effectiveDate`, `edition`, `sections`. 각 section은 `id`, `title`, `paragraphs` 순서. 문단/section 배열 순서 그대로 유지.
3. `JSON.stringify(object) + '\n'`을 UTF-8 BOM 없이 인코딩한다. SHA-256 lowercase hex 64자리.
4. SQL seed는 같은 canonical text를 저장한다. `jsonb::text`를 다시 직렬화하여 해시하지 않는다. 공백과 키 순서가 달라진다.
5. 서버의 `content_hash`는 canonical text UTF-8에 대한 pgcrypto digest로 검증한다. API는 `canonical_content` JSON 문자열 자체와 hash를 반환한다. 앱은 번들된 동일 hash면 로컬 문서를 렌더하고, 다르면 서버 canonical_content를 파싱해 실제 문서를 보여 준 뒤 그 hash로 동의한다.
6. 게시된 `(kind,version)`의 canonical text/hash는 불변. 본문 변경은 새 version/bundle이 필요하다. 변경된 앱 원문을 기존 해시에 억지로 맞추거나 서버 최신 버전에 자동 동의시키지 않는다.

작성 시 로컬 원문에 실제 적용한 결과:

```text
service-2026-10-01-v2
81ba373c21fafc5711b47013b32f7e9b37150100d84d49e937711524b38ba0cf

privacy-2026-10-01-v1
a2764f66fb163ef85e97072b4fc829b6ae44605c573b90336a0162be6e47c460
```

재현용 알고리즘(빌드/테스트에서 node:crypto 사용, 앱 런타임에 Node crypto를 넣지 않음):

```ts
const normalize = (s: string) => s.replace(/\r\n?/g, '\n').normalize('NFC');
const canonical = (d: LegalDocument) => JSON.stringify({
  id: normalize(d.id), title: normalize(d.title),
  effectiveDate: normalize(d.effectiveDate), edition: d.edition,
  sections: d.sections.map(s => ({
    id: normalize(s.id), title: normalize(s.title),
    paragraphs: s.paragraphs.map(normalize),
  })),
}) + '\n';
// createHash('sha256').update(canonical(d), 'utf8').digest('hex')
```

건강/마케팅은 별도 원문 `src/legal/healthConsent.ts`, `src/legal/marketingConsent.ts`를 B가 작성하고 같은 알고리즘으로 A에게 seed를 전달한다. 건강에는 수집 항목(알레르기·식단 제한), 메뉴 제외 목적, 선택성/거절해도 기본 서비스 이용, 1년과 만료 즉시 사용 차단·일 1회 삭제, 철회 즉시 삭제, 재동의 필요를 명시한다. 마케팅에는 선택성, 철회, 2년 재확인, S1 기간 광고성 발송 비활성을 명시한다. 두 선택 문서를 필수 개인정보 문서의 단순 링크로 대체하지 않는다.

**문구 정합성에 대한 출시 전 조건:** 현재 `privacy.ts`는 만료 시 DB에서 바로 지운다고 쓰고, 계좌는 정산 때만 공개한다고 쓴다. 사용자 확정 결정은 일 1회 물리 삭제와 프로필 스위치에 따른 정산 밖 공개를 허용하므로 차이가 있다. 위 두 해시는 현재 원문의 증거이며 수정 후 해시가 아니다. 구현자는 원문을 임의로 바꾸지 말고 조정할 문구를 검토에 제출한다. 게시 전 문구 수정이 승인되면 불변 version 원칙에 따라 새 개인정보 version/필수 bundle을 발급하고 fixture/seed/앱을 함께 갱신한다. 이 검토 전에는 로컬 구현·mock 테스트만 완료할 수 있고, 원문 정합성이 해결된 운영 출시로 인정하지 않는다.

## 5. 마이그레이션 단위와 소유권

A가 `supabase/**`를 단독 소유한다. 다음 이름은 제안이며 기존 이력과 충돌 시 타임스탬프만 조정하고 상대 순서를 유지한다. 기존 파일 편집·migration repair로 적용한 척하기 금지.

| 순서/제안 파일 | 내용 | 해당 단계 확인 |
|---|---|---|
| M1 `20261017090000_s1_consent_documents.sql` | 문서 카탈로그, bundle 연결 컬럼, 이력 확장, 상태/멱등 테이블 | 기존 기록 보존, canonical hash, FK/제약 |
| M2 `20261017091000_s1_consent_rpcs.sql` | 문서/상태/가입/재동의/선택 동의 RPC, handle_new_user의 자동 true 제거 | pending 가입, 현재 문서/시각 검증, 철회 원자성 |
| M3 `20261017092000_s1_food_health_storage.sql` | 비민감/건강 저장소, 코드 카탈로그, 레거시 취향 이전, 파기 함수 | 동의 없는 저장·만료 읽기 차단, 일괄 삭제 경쟁 |
| M4 `20261017093000_s1_profile_visibility.sql` | 키 정규화, revision, 타인 마스킹, 참가자 사본 정리, 관련 grant 제한 | 관계별 SQL 테스트 |
| M5 `20261017094000_s1_settlement_disclosure.sql` | 요청/종료 근거, 전용 계좌 RPC, 알림 사본 제거, 완료 시 파기 | 스위치 OFF 정산 공개/완료 비공개, 레거시 우회 |
| M6 `20261017095000_s1_terms_access_gate.sql` | 모든 사용자 데이터 경로의 필수 약관 gate, 기존 RPC 하드닝, 구 동의 RPC 차단 | 미동의 REST/RPC/Storage 쓰기 차단 |
| M7 `20261017100000_s1_activate_terms.sql` | 검증된 문서 게시, bundle 원자 전환, 마케팅 상태 이전 마무리 | 기존 사용자 재동의, 빈 current 오류, 가입 전체 |

M1~M7은 로컬에서는 전체 적용해 검증한다. 운영에는 중간 상태를 공개 서비스로 오래 남기지 않는다. 앱 호환 준비 및 별도 승인 없이 M6/M7을 먼저 배포하지 않는다. cron 등록은 migration 부수 효과로 숨기지 않고 별도 승인 작업으로 분리한다.

## 6. 테이블·제약·인덱스 명세

모든 신규 public 개인 테이블은 RLS ENABLE. 아래 `profile_id` FK는 `public.profiles(id) ON DELETE CASCADE`. 명시하지 않은 일반 timestamp는 서버가 설정한다. 사용자 제공 동의시각/만료시각은 받지 않는다.

### 6.1 문서와 bundle

`public.consent_documents`:

- `id uuid PK DEFAULT gen_random_uuid()`, `kind text NOT NULL CHECK IN ('service','privacy','health','marketing')`.
- `version text NOT NULL`, `edition integer NOT NULL CHECK > 0`, `effective_from timestamptz NOT NULL`, `published_at timestamptz NULL`, `is_current boolean NOT NULL DEFAULT false`.
- `canonical_content text NOT NULL`, `content_hash text NOT NULL CHECK ~ '^[0-9a-f]{64}$'`, `change_summary text NOT NULL DEFAULT ''`.
- UNIQUE `(kind,version)`, UNIQUE `(id,kind)`, UNIQUE partial `(kind) WHERE is_current`. is_current이면 published_at 필수. kind와 canonical document.id의 대응을 trigger로 검증(service는 id=terms).
- canonical JSON 형식, 본문 최대 128KiB, hash 일치를 검증. 공개된 본문의 UPDATE를 trigger로 금지.

`public.terms_versions` 기존 확장:

- `service_document_id uuid NULL`, `privacy_document_id uuid NULL`, `published_at timestamptz NULL`, `change_summary text NOT NULL DEFAULT ''`。
- 각 문서 FK는 ON DELETE RESTRICT. activation trigger에서 kind가 service/privacy이고 공개·시행된 문서인지 확인. 구 이력의 NULL은 허용하지만 새 current에는 둘 다 필수.
- 기존 version UNIQUE와 is_current partial UNIQUE 유지. M7은 구 current=false → 새 current=true를 동일 transaction으로 수행. current 0건을 성공 응답으로 만들지 않는다.
- 개인 삭제는 문서 삭제를 요구하지 않는다. 문서의 RESTRICT는 S2 사용자 삭제를 막지 않는다.

### 6.2 동의 이력·현재 상태·멱등성

`public.profile_consents` 기존 확장:

- 기존 `id bigint`, `profile_id`, `kind`, `version`, `agreed`, `agreed_at` 유지. kind에 health 추가.
- `document_id uuid NULL REFERENCES consent_documents(id)`, `action text NOT NULL`, `source text NOT NULL`, `request_id uuid NULL` 추가.
- action = `grant | decline | withdraw | expire`; source = `legacy | signup | reconsent | settings | food_step2 | maintenance`.
- grant는 agreed=true, 나머지는 false. 기존 행은 agreed에 따라 grant/decline, source=legacy, document_id/request_id=NULL. 과거 문서를 추정하지 않는다.
- 신규 사용자 동의는 document_id 필수(문서가 없는 최초 철회는 예외: document_id=NULL, version='unversioned-withdrawal'). document.kind=kind 검증. 서버가 document.version을 version에 기록한다.
- UNIQUE `(id,profile_id,kind)`, UNIQUE `(profile_id,kind,request_id)` WHERE request_id IS NOT NULL.
- 최신 조회 인덱스 `(profile_id,kind,agreed_at DESC,id DESC)`로 기존 인덱스를 교체.
- 직접 UPDATE/DELETE 불허. account cascade 삭제는 허용. payload/건강값/IP/token을 이력에 넣지 않는다.

`public.profile_consent_states`:

- `profile_id uuid`, `kind text`, PK `(profile_id,kind)`.
- `status text NOT NULL CHECK IN ('granted','declined','withdrawn','expired')`, `document_id uuid NULL`.
- `latest_event_id bigint NOT NULL`, `granted_event_id bigint NULL`, `granted_at timestamptz NULL`, `valid_until timestamptz NULL`, `next_confirmation_at timestamptz NULL`, `revision bigint NOT NULL CHECK > 0`, `updated_at timestamptz NOT NULL`.
- `(latest_event_id,profile_id,kind)`는 consent events를 참조하는 composite FK. granted_event도 같은 본인/kind의 grant인지 검증. 삭제 연쇄는 개인 프로필 루트 기준으로 설계하고 여러 FK 경로의 순환을 만들지 않는다.
- health granted는 granted_event_id/granted_at/valid_until 필수, valid_until>granted_at, next_confirmation_at NULL.
- marketing granted는 granted_at/next_confirmation_at 필수, valid_until NULL. service/privacy는 두 기한 모두 NULL.
- decline/withdraw는 활성 granted_event_id와 두 기한을 NULL로 설정. 이력의 과거 grant는 유지. expire는 마지막 만료시각을 유지할 수 있지만 활성으로 읽지 않는다.
- 상태와 이력의 document_id는 같은 문서를 가리켜야 한다. legacy 마케팅 상태만 document_id=NULL의 granted를 허용한다. 신규 grant에는 실제 document_id가 필수다. granted_event_id 참조의 action=grant, kind/profile 일치는 FK로 표현할 수 없는 부분까지 trigger로 검증한다.
- partial indexes: `(valid_until,profile_id) WHERE kind='health' AND status='granted'`; `(next_confirmation_at,profile_id) WHERE kind='marketing' AND status='granted'`.
- 명시적 재동의마다 revision 증가. 재조회·동일 request 재시도는 증가시키지 않는다.

`private.consent_requests` (추가 전용 동의 이력과 별개 멱등 제어):

- `(profile_id uuid,request_id uuid)` PK, profile FK CASCADE, `operation text NOT NULL`, `payload_hash text NOT NULL`, `created_at timestamptz NOT NULL`.
- 입력의 문서 ID/hash/boolean/action만 canonical hash. 건강 payload·계좌·원문 입력값 저장 금지.
- 성공한 동의 변경과 같은 transaction에 기록. 기존 key+다른 hash는 S1007. 같은 hash는 사건을 다시 만들지 않고 **현재** 상태를 반환한다. 모든 종류 간 request_id 충돌도 검사한다.
- S1에는 별도 만료 삭제를 도입하지 않음. 계정 삭제와 함께 파기. 사용자 API에 직접 노출하지 않는다.

### 6.3 음식·건강정보

`public.profile_food_preferences`:

- `profile_id uuid PK`, `schema_version integer NOT NULL DEFAULT 1 CHECK = 1`, `preferences jsonb NOT NULL DEFAULT '{}'`, `revision bigint NOT NULL DEFAULT 0 CHECK >= 0`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- object만 허용. 허용 키는 `korean, meat, seafood, western, chinese, japanese`, 각 value는 JSON boolean, 최대 6개. schema 검증은 IMMUTABLE helper 사용 가능. 건강/식단 키와 unknown key는 22023.
- 가입 때 빈 행 생성, 기존 프로필에도 빈 행 보충. `profile_private.tastes`의 알려진 boolean만 이전. 중복 원본은 `{}`로 비우고 직접 UPDATE grant 제거.
- S5 STEP 1이 확장할 때 schema_version 및 허용 필드를 새 migration으로 확장한다. STEP 2 필드를 여기에 추가하지 않는다.

`public.health_code_catalog`:

- PK `(category,code)`; category IN `allergy,dietary_restriction`; `code text`는 `^[a-z][a-z0-9_]{0,63}$`; `label text NOT NULL`, `enabled boolean NOT NULL DEFAULT true`.
- S1 production seed는 비워 둔다. S5가 검증된 코드 목록을 채운다. S1 테스트는 transaction 내부에서 테스트 코드만 seed한다. empty list 건강 row는 가능하지만 미등록 코드는 저장 불가. 건강 기능 전체 UI는 S5 전 제공하지 않는다.

`public.profile_health_preferences`:

- `profile_id uuid PK`, `consent_event_id bigint NOT NULL`, `allergies text[] NOT NULL DEFAULT '{}'`, `dietary_restrictions text[] NOT NULL DEFAULT '{}'`, `revision bigint NOT NULL DEFAULT 0 CHECK >=0`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- 각 배열은 최대 64개. NULL 원소/중복/unknown·disabled code 금지. code 존재·category는 BEFORE write trigger로 검사한다.
- consent_event_id는 같은 profile의 health grant 사건 FK/trigger로 검증. 현재 상태의 granted_event_id와 같아야 한다. UPDATE/INSERT 때 서버 현재시각으로 유효 동의 확인.
- 건강 행이 있어도 동의 상태가 만료/철회면 읽기 정책에서 즉시 제외. table raw write는 service_role도 revoke하고 정해진 함수로만 쓴다. SQL owner 등 신뢰 관리자 권한은 일반 사용자 격리 테스트의 대상과 구분한다.
- 건강 만료를 표현하려고 `CHECK(now() < expiry)`를 쓰지 않는다. CHECK는 시간 경과 때 자동 재검사되지 않는다.
- `personal_data`는 구조상 gender/bio만 허용하도록 정리한다. 알려진 건강 구조 키를 제거하고 unknown legacy 키는 아래 이전 규칙으로 처리한다. 일반 자유 문구에 건강내용을 적는 것까지 자동 판독·차단한다는 계약은 아니다.

### 6.4 공개 설정·참가자·정산 기존 테이블

`profile_private`:

- `privacy_revision bigint NOT NULL DEFAULT 0 CHECK >= 0` 추가.
- privacy_settings는 정식 5키가 모두 있고 다른 키가 없는 object, 값은 public/private. DEFAULT 모두 private. 설정 변경은 RPC 전용.
- personal_data는 gender(male/female/none), bio(최대120자)만 허용하는 CHECK. 기존 무관 데이터가 있는 upgrade fixture에서 분류 이전을 검증한 뒤 적용한다.
- tastes 직접쓰기 회수/빈값 강제. 기본 계좌·birth_date·출발지 등은 본인 쓰기 및 필수 약관 gate 유지.

`participants`:

- personal_data는 `{}`로 정리하고 CHECK `personal_data='{}'::jsonb`.
- start_location_name/start_latitude/start_longitude는 NULL로 정리하고 NULL CHECK. 참가자 생성/초대 RPC가 다시 복제하지 않음.
- 방에서 제출한 schedule/voted_items는 유지. 개인 프로필 schedule 전체를 복사하는 경로가 발견되면 제거하되 방 제출 데이터까지 삭제하지 않는다.
- SELECT는 id,room_id,profile_id,name,avatar_color,avatar_url,schedule,voted_items,created_at와 이후 migration으로 추가된 **검토된 비민감 열**만 column grant. 실제 catalog로 열 목록을 고정하고 `*` 금지.

`dutch_pay_bills`:

- `payment_disclosure_source text NULL CHECK IN ('request','legacy_linked_request')`, `payment_disclosure_requested_at timestamptz NULL`, `payment_disclosure_closed_at timestamptz NULL` 추가.
- `event_revision bigint NOT NULL DEFAULT 0 CHECK >= 0` 추가. 제목/금액/계좌의 실제 변경 때만 증가시키고 시스템 이벤트 key는 `settlement-updated:<bill_id>:<event_revision>`로 구성한다. 동일 값 재제출은 증가시키지 않는다.
- request source는 requested_at 필수. legacy source의 requested_at은 NULL(추정 동의일 생성 금지). close 시각은 접근 종료 제어 시각이며 과거 실제 정산 완료 시각으로 주장하지 않는다.
- close가 있으면 bank_name/account_number/account_holder가 모두 빈 문자열인 CHECK.
- raw account 열 SELECT/UPDATE grant 제거. 기존 bill 수취인 RLS 유지. 공개 목록 열은 id,room_id,creator_id,title,total_amount,split_count,created_at와 공개 상태 열만 허용.
- 내부 생성 함수는 실제 정산 요청 때 source=request/requested_at=server_now 설정. 입력한 계좌는 이 요청의 snapshot이며 이후 프로필 계좌 변경으로 자동 교체하지 않는다. 계좌 변경 요청은 생성자만 기존 미완료 bill에 새 요청으로 기록한다.
- 완료 처리는 bill row 잠금 아래 상태 판정·closed_at 설정·계좌 3열 삭제를 원자적으로 실행. 회원 단독 정산의 INSERT 완료도 포함한다.
- set_settlement_completed의 기존 member row 우선 잠금을 조정하여 공통 advisory lock → 존재하는 room row → bill row → member row 순서로 통일한다. 참가자 snapshot INSERT 문장이 끝나기 전에 첫 완료 행만 보고 계좌를 닫지 않는다. 완료 trigger는 같은 문장의 전체 snapshot이 보이는 시점에 판정하고 생성 RPC 끝에서도 검증한다. 레거시 member 직접 UPDATE 권한은 회수해 동일 잠금 경로만 사용한다.
- 필요한 보조 인덱스: 기존 `(bill_id,profile_id)`를 확인하고 없으면 생성. `participants(room_id,profile_id)`, `(profile_id,room_id)` 기존 인덱스 재사용. 중복 생성 금지.

`notifications`:

- bank_name/account_number의 모든 행을 `''`로 정리, 각각 CHECK `= ''`, column INSERT/UPDATE/SELECT grant 제거.
- settlement_id 없는 구 알림은 기존 RLS대로 숨김. 새 알림은 settlement_id와 비민감 제목/문구/금액만 저장한다.
- 저장 함수의 `ON CONFLICT` update도 계좌를 복제하지 않도록 수정한다. 이벤트 key가 계좌 원문을 포함하거나 그것을 단순 hash한 값에 의존하지 않도록 요청/행 revision으로 대체한다.

## 7. RLS·grant·함수 보안 계약

### 7.1 정책별 의도

| 객체/정책 | 명령 | USING | WITH CHECK | grant |
|---|---|---|---|---|
| consent_documents_public_read | SELECT | published_at IS NOT NULL AND effective_from <= server time | 없음 | anon/authenticated SELECT |
| terms_versions_public_read | SELECT | published_at IS NOT NULL | 없음 | anon/authenticated SELECT, 사용자 쓰기 없음 |
| profile_consents_select_own | SELECT | profile_id=auth.uid() | 없음 | authenticated SELECT만; gate 예외 제어자료 |
| consent_states_select_own | SELECT | profile_id=auth.uid() | 없음 | authenticated SELECT만; gate 예외 제어자료 |
| food_select_own | SELECT | profile_id=auth.uid() | 없음 | authenticated SELECT만 |
| health_select_active_own | SELECT | profile_id=auth.uid() AND private.has_active_health_consent(consent_event_id) | 없음 | authenticated SELECT만 |
| health_codes_read | SELECT | enabled=true | 없음 | authenticated SELECT만 |
| profile_private_select_own | SELECT | id=auth.uid() | 없음 | authenticated SELECT (health 원문 없음) |
| profile_private_update_own | UPDATE | id=auth.uid() | id=auth.uid() | 허용된 본인 열 UPDATE만; privacy/tastes는 RPC만 |
| participants_select_room_member | SELECT | 기존 private.is_room_member(room_id) | 없음 | 비민감 column SELECT만 |
| bills/members_select_bill_recipient | SELECT | 기존 private.is_bill_visible(id 또는 bill_id) | 없음 | bill의 계좌 열 제외 SELECT |
| notifications_select_bill_recipient | SELECT | settlement_id IS NOT NULL AND private.is_bill_visible(settlement_id) | 없음 | 계좌 제외 SELECT |
| app_terms_gate_<table> | ALL, AS RESTRICTIVE | private.has_current_terms_consent() | private.has_current_terms_consent() | grant를 추가하지 않음 |

마지막 restrictive policy는 profiles/public_profiles/profile_private/food/health/health_code_catalog/rooms/participants/messages/follows/calendar_notes/dutch_pay_bills/dutch_pay_members/notifications/scheduled_time/room_invitations에 적용한다. 해당 테이블의 기존 permissive 소유·관계 정책과 AND된다. 구현 시 실제 public 사용자 데이터 테이블 catalog와 비교하여 누락을 테스트한다. 문서/동의 제어 테이블은 제외. state/event 직접쓰기는 정책도 grant도 만들지 않는다.

**열별 차단 전 테이블 전체 권한 회수가 필수다.** participants/dutch_pay_bills/notifications에 먼저 `REVOKE SELECT ON <table> FROM PUBLIC, anon, authenticated`를 적용하고 기존 column SELECT grant도 점검·회수한 뒤 허용 열만 다시 grant한다. 테이블 SELECT가 남은 상태에서 민감 열 SELECT만 revoke하면 보호되지 않는다. INSERT/UPDATE도 table grant와 column grant를 각각 검사한다. 설정/취향을 RPC로 제한할 때 기존 전체 UPDATE가 남지 않도록 재구성한다. personal_data의 본인 UPDATE는 gender/bio 형식 CHECK와 약관 gate 아래에서 유지한다. has_table_privilege와 has_column_privilege를 모두 SQL 테스트로 검증한다.

`private.consent_requests`는 RLS ENABLE, 사용자 policy/grant 없음. service_role도 직접 접근 불필요. health·동의·카탈로그 신규 객체는 default privilege를 믿지 말고 PUBLIC/anon/authenticated/service_role의 쓰기를 명시적으로 revoke한 다음 필요한 권한만 grant한다.

`storage.objects`의 avatars 쓰기 정책은 기존 bucket/자기폴더 조건 AND 필수 약관 완료. SDK의 공개 avatar URL 자체는 공개 버킷 자산이며 S1에서 철회 가능한 개인 데이터 API로 바뀌지 않는다. 약관 pending 앱에서는 본문/아바타 목록을 렌더하지 않는다. 공개 파일 URL 자체를 차단해야 하는 추가 요구는 별도 저장소 전환이 필요하다.

### 7.2 함수 공통 규칙

- 공개 API에서 `auth.uid()` null은 42501/AUTH_REQUIRED. 본인 함수는 target user 인자 없음. 개인 프로필 존재 확인.
- 아래 새 public RPC는 `RETURNS jsonb`, `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = ''`, `SET timezone = 'UTC'`, VOLATILE(현재시각 재검사)로 통일한다. 필요한 이유는 제어 테이블 쓰기 또는 본인 RLS 밖의 제한된 projection이며 범용 관리자 쿼리를 노출하지 않는다.
- 각 함수는 실제 필요한 테이블 열만 참조하고 fully qualified 객체명을 쓴다. dynamic SQL·caller가 준 SQL/열 이름 실행 금지.
- owner는 이 저장소 기존 migration과 같이 관리 역할로 두되 기능별 권한 검사를 독립 테스트한다. 편의를 위한 다른 사용자의 SELECT policy 확장은 금지. 배포 전 독립 검토에서 owner privilege도 검토한다.
- 생성 후 `REVOKE ALL ON FUNCTION <정확한 시그니처> FROM PUBLIC, anon, authenticated, service_role`; 함수별 아래 EXECUTE만 다시 허용. private helper는 불필요하게 PostgREST 공개 schema로 옮기지 않는다.
- `get_consent_manifest`: anon/authenticated. 일반 앱 RPC: authenticated만. 유지보수 RPC: service_role만. trigger 함수: 외부 EXECUTE 없음.
- private helper `has_current_terms_consent()`/`has_active_health_consent(bigint)`는 본인만 검사하는 SD boolean 함수, 고정 search_path, authenticated EXECUTE(정책 평가용). `require_current_terms_consent()`는 SD void, 직접 노출 안 함. document/hash/현재 상태 조회는 함수 내부에서 직접 정확히 수행하고 RLS 재귀를 만들지 않는다.
- SQL owner 및 service_role는 신뢰 서버 권한이다. RLS가 이를 막는다고 가정하지 않는다. Edge Function은 JWT 검증→사용자 식별→약관 확인→방 권한 확인을 admin 조회보다 앞서 수행한다.

### 7.3 기존 RPC·직접 경로의 필수 약관 차단

다음 기존 public API는 signature/기능 반환형은 유지하되 진입점에서 `private.require_current_terms_consent()`를 호출한다. 부수 효과 전에 검사하고 잠금 후 다시 검사한다. 후속 migration으로 덮어쓴 **최종 정의**에 적용한다.

- join_room_by_code, create_room_invitation, accept_room_invitation, decline_room_invitation, invite_friend_to_room, leave_room.
- create_room_settlement, create_room_settlement_v2, set_settlement_completed, update_settlement_amount.
- add_voting_item, remove_voting_item, toggle_vote, confirm_room_vote, advance_room_stage.
- set_my_availability, room_availability_status, room_availability_cells, post_room_system_message, delete_expired_rooms의 사용자 호출.
- 인증 role에 EXECUTE가 남은 다른 public 데이터 helper도 catalog inventory로 검사. 폐쇄된 함수는 다시 열지 않는다. 트리거를 callable RPC로 열지 않는다.
- `schedule-recommend`는 `ctx.supabaseAdmin`으로 읽기 전에 사용자 JWT의 `get_my_consent_status` 결과를 확인. 미동의는 HTTP403 `{ "code":"S1001", "error":"TERMS_REQUIRED" }`, 검사 실패는 HTTP503 `{ "code":"S1006", "error":"CONSENT_STATUS_UNAVAILABLE" }`. provider 호출·사용자 데이터 로깅 없음.
- email_available 등 익명 가입 전용 API는 익명 인증 선행 기능으로 유지하되, 인증된 pending 사용자의 앱 기능 진입 수단으로 사용하지 않는다.
- `record_terms_consent(boolean)`는 항상 S1008/CLIENT_UPDATE_REQUIRED, 새 문서에 동의 기록을 만들지 않는다. `current_terms_consent_status()`는 호환 read wrapper로 유지할 경우 service/privacy 모두 검사하고 `{version,agreed}` 기존 반환형 유지. current 없으면 S1006. 새 앱은 v2 계약만 사용한다.
- REST row filtering으로 pending SELECT가 0행일 수 있다. 이를 빈 계정으로 렌더하지 말고 먼저 status API로 gate한다. 쓰기의 RLS 42501은 status를 재조회해 약관/일반 권한 실패를 구분한다.

### 7.4 private helper·trigger의 고정 계약

모두 SET search_path = '', 객체명 완전 수식. 아래 boolean/검증 함수가 임의 사용자 데이터 조회 기능이 되지 않게 한다. trigger를 반환하는 함수에는 외부 EXECUTE grant를 주지 않는다. private schema의 authenticated USAGE는 기존 정책 평가에 필요한 만큼만 유지한다.

| 시그니처/반환 | 보안·변동성 | EXECUTE | 동작 |
|---|---|---|---|
| private.has_current_terms_consent() → boolean | SD, VOLATILE | authenticated | auth.uid 본인의 service/privacy 상태와 현재 게시·시행 bundle 일치. 구성 없으면 false. RLS 재귀 없이 상태 테이블 검사 |
| private.require_current_terms_consent() → void | SD, VOLATILE | 함수 owner만 | 신원 없음 42501, 구성 없음 S1006, 미동의 S1001 |
| private.has_active_health_consent(p_event_id bigint) → boolean | SD, VOLATILE | authenticated | 본인 health state의 활성 사건 일치 및 현재시각 < valid_until. 타인 사건/NULL은 false |
| private.validate_s1_document() → trigger | SD, VOLATILE | 없음 | canonical/hash/문서 kind/게시 후 불변 검사. 잘못된 입력 22023 |
| private.validate_s1_bundle() → trigger | SD, VOLATILE | 없음 | current=true인 bundle의 service/privacy 문서 존재·kind·게시/시행 검사. 실패 S1006 |
| private.validate_s1_consent_state() → trigger | SD, VOLATILE | 없음 | 사건 profile/kind/action/document 일치. 무결성 위반 23514 |
| private.validate_s1_health_write() → trigger | SD, VOLATILE | 없음 | 건강 사건·현재 상태·기한·코드 검사. 사용자 RPC가 확인한 profile과 NEW.profile_id 일치, 관리자 배치 외 임의 신원 우회 금지 |
| private.close_completed_bill_disclosure() → trigger | SD, VOLATILE | 없음 | bill 잠금, 전체 snapshot 완료 시 한번만 closed_at 설정·계좌 원문 파기 |
| private.handle_new_user() → trigger (기존 교체) | SD, VOLATILE | 없음 | profiles/private/food만 생성, 동의 자동 생성 금지 |

순수 JSON 허용 키 검사 등 데이터 비조회 helper는 SECURITY INVOKER/IMMUTABLE로 만든다. SD 함수/trigger 안에서만 사용하면 외부 EXECUTE 없음, 사용자의 직접 UPDATE에 적용되는 CHECK에서 호출하면 authenticated에 그 helper만 EXECUTE를 부여한다. 이 차이 때문에 모든 정상 UPDATE가 권한 오류로 실패하지 않는지 테스트한다. 상태 검증 trigger는 사용자 입력 검증을 대체하지 않는 최후 무결성 방어이며 23514/23505 같은 예기치 않은 내부 오류는 앱에서 일반 저장 실패로 처리하고 원문을 로깅하지 않는다. M2에서 정의한 함수가 M3 테이블을 참조한다면 전체 마이그레이션 적용 전에는 호출하지 않고, migration 내부 backfill 호출도 의존 테이블 생성 뒤로 배치한다.

## 8. 클라이언트-서버 RPC 계약 v1

SQL 인자는 `p_` prefix, JSON response는 snake_case. 아래 JSON은 `.rpc(name, args)`의 args와 data다. JSON object 단일 응답이며 `.maybeSingle()`을 붙이지 않는다. UUID는 실제 UUID 문자열, revision은 JS 정밀도 문제를 피하기 위해 **10진 문자열**, timestamp는 UTC ISO 문자열이다. nullable과 누락을 구분한다. 문서 hash 자리 표시는 mock에서 64자리 hex로 치환한다.

### 8.1 공통 오류

오류는 성공 JSON에 섞지 않고 PostgreSQL exception으로 반환한다. Supabase error `{code,message,details,hint}`에서 code와 안정적인 message symbol을 읽는다. details에는 허용된 현재 revision 등만, 원문 개인정보는 넣지 않는다.

| code | message | 앱 처리 |
|---|---|---|
| 42501 | AUTH_REQUIRED / NOT_ALLOWED | 세션 없으면 로그인; 관계 거부면 원문 제거하고 접근 불가 |
| 22023 | INVALID_INPUT | 필드 검증 오류, 제출값 수정 |
| P0002 | RESOURCE_NOT_FOUND | 삭제/접근 불가 동일 표시. 타인 존재 여부 유추 금지 |
| 23503 | PROFILE_NOT_READY | 가입 provisioning 재시도/안내. 성공으로 간주 금지 |
| S1001 | TERMS_REQUIRED | 일반 앱 unmount, 캐시 제거, 재동의 gate |
| S1002 | DOCUMENT_CHANGED | manifest 다시 읽고 해당 문서를 표시, 관련 체크 해제 후 명시 재동의 |
| S1003 | HEALTH_CONSENT_REQUIRED | 건강값 제거, 선택 동의 안내; 기본 서비스 이용 가능 |
| S1004 | REVISION_CONFLICT | 최신값 다시 읽고 사용자 재입력; 자동 덮어쓰기 금지 |
| S1005 | SETTLEMENT_DISCLOSURE_CLOSED | 계좌 제거·송금 비활성; 정산 상태 다시 읽음 |
| S1006 | CONSENT_CONFIGURATION_UNAVAILABLE | 재시도 가능한 오류 gate. 본문 진입 금지 |
| S1007 | IDEMPOTENCY_CONFLICT | payload 변경 시 새 request_id; 무한 자동 재시도 금지 |
| S1008 | CLIENT_UPDATE_REQUIRED | 앱 업데이트 안내, 본문 진입 금지 |

네트워크 실패/timeout/알 수 없는 오류도 필수 동의 완료로 바꾸지 않는다. mutation timeout 재시도는 동일 request_id. 선택 동의 철회 실패 시 삭제 완료 toast를 띄우지 않는다.

### 8.2 get_consent_manifest()

인자 `{}`. anon/authenticated, 필수 gate 예외. 공개된 현재 bundle/선택 문서가 불완전하면 S1006.

```json
{
  "contract_version": 1,
  "bundle_version": "mealchat-2026-10-01-r1",
  "effective_from": "2026-09-30T15:00:00Z",
  "change_summary": "서비스 약관 2판 및 개인정보 처리방침 1판 동의",
  "documents": {
    "service": {"version":"service-2026-10-01-v2","edition":2,"content_hash":"<64hex>","canonical_content":"<canonical JSON plus LF>"},
    "privacy": {"version":"privacy-2026-10-01-v1","edition":1,"content_hash":"<64hex>","canonical_content":"<canonical JSON plus LF>"},
    "health": {"version":"health-2026-10-17-v1","edition":1,"content_hash":"<64hex>","canonical_content":"<canonical JSON plus LF>"},
    "marketing": {"version":"marketing-2026-10-17-v1","edition":1,"content_hash":"<64hex>","canonical_content":"<canonical JSON plus LF>"}
  },
  "server_time": "2026-10-17T00:00:00Z"
}
```

### 8.3 get_my_consent_status()

인자 `{}`. authenticated, gate 예외. 사용자 ID를 받지 않는다. 상태 조회로 grant/expiry를 자동 연장하지 않는다.

```json
{
  "contract_version": 1,
  "bundle_version":"mealchat-2026-10-01-r1",
  "required":{"status":"required","service_agreed":false,"privacy_agreed":false},
  "health":{"status":"not_asked","document_version":null,"granted_at":null,"valid_until":null,"revision":"0"},
  "marketing":{"status":"not_asked","document_version":null,"granted_at":null,"next_confirmation_at":null,"confirmation_due":false,"sending_enabled":false,"revision":"0"},
  "server_time":"2026-10-17T00:00:00Z"
}
```

required.status는 `accepted | required`. 오류는 status 문자열로 삼키지 않는다. health expired 응답에는 마지막 valid_until/문서 버전이 남을 수 있지만 건강값은 없다. marketing due는 granted 상태를 자동 withdrawn으로 바꾸지 않는다.

### 8.4 complete_signup_consents(p_request_id uuid, p_bundle_version text, p_documents jsonb, p_choices jsonb)

authenticated, gate 예외. 최초 신규 문서 동의 확정용. p_documents는 4종 version/hash, choices는 정확히 4종 boolean. 필수 둘은 true여야 하며 선택 둘은 false 가능. 임의 키/문자열 boolean 거절.

```json
{
  "p_request_id":"11111111-1111-4111-8111-111111111111",
  "p_bundle_version":"mealchat-2026-10-01-r1",
  "p_documents":{
    "service":{"version":"service-2026-10-01-v2","content_hash":"<64hex>"},
    "privacy":{"version":"privacy-2026-10-01-v1","content_hash":"<64hex>"},
    "health":{"version":"health-2026-10-17-v1","content_hash":"<64hex>"},
    "marketing":{"version":"marketing-2026-10-17-v1","content_hash":"<64hex>"}
  },
  "p_choices":{"service":true,"privacy":true,"health":false,"marketing":false}
}
```

응답은 8.3과 같은 전체 상태 객체. 4종 검증/기록/상태 변경은 한 transaction. 두 필수 동의가 맞지 않으면 22023, version/hash 불일치는 S1002. 선택 false는 decline 사건, 건강값은 즉시 삭제. 신규 선택 기록이 이미 있으면 다른 request_id의 complete 호출은 S1004로 거절해 과거 가입 초안이 최근 설정을 덮어쓰지 못하게 한다. 구 legacy 사건은 최초 신규 계약 확정을 막지 않는다.

`private.handle_new_user()`는 profiles/profile_private/food 빈 행만 만들고 동의 true/marketing 선택을 자동 기록하지 않는다. 건강 동의 boolean이나 건강값을 Auth raw_user_meta_data에 넣지 않는다. Auth signup은 pending 계정이 될 수 있으며 앱 기능은 서버 gate로 막힌다.

### 8.5 record_required_consents(p_request_id uuid, p_bundle_version text, p_documents jsonb, p_choices jsonb)

authenticated, gate 예외. 입력 형태는 8.4와 같되 documents/choices에는 **service/privacy만** 허용하고 둘 다 true 필수. 결과 8.3. health/marketing 상태·기한을 건드리지 않는다. 최초 동의에도 사용할 수 있으며 이후 선택 동의는 별도 API로 받는다.

### 8.6 set_optional_consent(p_request_id uuid, p_kind text, p_action text, p_document_version text, p_content_hash text, p_expected_revision bigint, p_source text)

kind=`health|marketing`, action=`grant|decline|withdraw`, source=`settings|food_step2`. signup source는 8.4만 사용. grant는 필수 약관 완료 필요. decline/withdraw는 약관 pending·문서 설정 장애에도 허용하며 저장된 건강값을 삭제한다. 문서 없는 최초 철회도 성공해야 한다.

```json
{
  "p_request_id":"22222222-2222-4222-8222-222222222222",
  "p_kind":"health",
  "p_action":"grant",
  "p_document_version":"health-2026-10-17-v1",
  "p_content_hash":"<64hex>",
  "p_expected_revision":"0",
  "p_source":"food_step2"
}
```

grant는 현재 문서 version/hash·revision 필수. decline/withdraw는 version/hash/expected_revision을 null로 보내도 허용하며 최신 상태를 잠근 뒤 철회를 우선 적용한다. 새 문서를 읽어야 철회할 수 있게 만들지 않는다.

```json
{
  "kind":"health",
  "status":"granted",
  "document_version":"health-2026-10-17-v1",
  "granted_at":"2026-10-17T00:00:00Z",
  "valid_until":"2027-10-17T00:00:00Z",
  "next_confirmation_at":null,
  "revision":"1",
  "data_deleted":false,
  "server_time":"2026-10-17T00:00:00Z"
}
```

withdraw/decline 응답의 status는 해당 값, 활성 granted_at/valid_until/next_confirmation_at은 null, data_deleted=true(건강 kind, 지울 행이 없어도 true). marketing은 valid_until=null, grant 시 next_confirmation_at=+2년, data_deleted=false. 모든 선택 응답의 형태는 위와 같고 marketing에만 `confirmation_due`/`sending_enabled:false`를 추가한다.

### 8.7 get_my_profile_visibility() / set_profile_visibility(p_field text, p_visibility text, p_expected_revision bigint)

authenticated, 필수 gate 적용. 조회 args `{}`. 변경은 한 필드만, 정식 키만. expected_revision 불일치는 S1004. 같은 값 재설정은 revision을 증가시키지 않지만 expected_revision 검사는 수행한다.

```json
{"p_field":"bank_account","p_visibility":"private","p_expected_revision":"2"}
```

두 RPC 응답:

```json
{"settings":{"birthdate":"private","gender":"private","bio":"private","bank_account":"private","origin":"private"},"revision":"3"}
```

계좌 스위치 변경은 bill snapshot, disclosure_requested_at/closed_at, 진행 중 정산 계좌 응답을 변경하지 않는다.

### 8.8 get_visible_profile(p_profile_id uuid, p_room_id uuid DEFAULT NULL)

authenticated, 필수 gate 적용. 상대가 없으면 P0002. room_id를 주면 양쪽 valid room membership 확인 실패는 P0002(잘못된 방 존재 확인 금지). null이면 self 또는 실제 공유 valid_room의 존재로 분류하고, 없으면 identity_only. follows를 보지 않는다.

```json
{"p_profile_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","p_room_id":null}
```

```json
{
  "profile":{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"테스트 메이트","tag":"user-aaaaaaaa","avatar_color":"#23A455","avatar_url":null},
  "relationship":"room_mate",
  "fields":{"birthdate":"1995-02-03","gender":"female","bio":"한마디","bank_account":{"bank_name":"테스트은행","account_number":"0000000000"}}
}
```

relationship=`self|room_mate|identity_only`. fields는 허용되고 실제 값이 있는 키만 포함. 비공개/값없음은 키 자체를 생략, identity_only는 `{}`. origin/health/tastes/personal_data는 이 RPC에서 반환하지 않는다. 본인의 출발지 편집은 기존 본인 API를 사용한다. relationship 분류 자체로 친구 여부를 노출하지 않는다.

### 8.9 get_settlement_payment_details(p_bill_id uuid)

authenticated, 필수 gate 적용. 미존재와 비참여자는 모두 P0002. 현재 방 멤버라는 이유만으로 허용하지 않는다. caller가 생성자여도 완료된 계좌는 반환하지 않는다.

```json
{"p_bill_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
```

```json
{
  "bill_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "status":"open",
  "payment_details":{"bank_name":"테스트은행","account_number":"0000000000","account_holder":"테스트 메이트"},
  "hidden_reason":null,
  "server_time":"2026-10-17T00:00:00Z"
}
```

완료/종료는 `status:"completed", payment_details:null, hidden_reason:"completed"`. 멤버0/미검증 과거 요청/계좌 미설정은 `status:"unavailable", payment_details:null, hidden_reason:"unavailable"`. 원문이 없는 정상 응답을 일반 네트워크 오류로 표시하지 않는다. 금액·완료 상태는 기존 비민감 정산 조회로 계속 렌더한다. 읽기 RPC는 종료 상태에 S1005를 던지지 않고 위 응답을 쓴다. S1005는 종료된 bill 계좌를 변경하는 mutation에서 사용한다.

여기서 status는 계좌 공개의 수명 상태다. 완료 표시를 되돌린 bill의 계좌 공개가 이미 종료됐다면 completed를 유지한다. 이를 실제 채무가 모두 완료됐다는 표시로 재사용하지 않고 정산 금액·완료 표시 자체는 기존 정산 데이터로 판단한다.

기존 create_room_settlement(_v2) RPC의 입력/UUID 결과는 유지한다. 새 요청/계좌 변경 시 snapshot과 요청 시각을 기록한다. 새 정산의 계좌는 유효한 입력값을 명시적으로 전달해야 하며 스위치 OFF를 이유로 거부하지 않는다. 생성자 이외 수정 금지, 잠금·고정 참여자 규칙은 기존과 동일하다. 요청 버튼의 계좌 공개 설명을 B가 추가한다.

### 8.10 음식 프로필 API (S1 서버 기반, STEP 2 화면은 S5)

`get_my_food_preferences()` / `save_my_food_preferences(p_preferences jsonb,p_expected_revision bigint)`: authenticated, 필수 gate. 저장 입력 `{ "p_preferences":{"korean":true,"meat":false}, "p_expected_revision":"0" }`. 응답 `{ "schema_version":1,"preferences":{"korean":true,"meat":false},"revision":"1" }`. 전체 replace이며 안 보낸 키는 제거. 허용 키 외에는 22023. 신규 row revision=0.

`get_my_health_preferences()`: authenticated, 필수 gate+건강 동의. 비활성/만료는 S1003; 활성이고 row 없으면 `{ "allergies":[],"dietary_restrictions":[],"revision":"0","consent_revision":"1","valid_until":"2027-10-17T00:00:00Z" }`.

`save_my_health_preferences(p_allergies text[],p_dietary_restrictions text[],p_expected_revision bigint,p_consent_revision bigint)`: 같은 보안 조건. 예시 입력 `{ "p_allergies":["test_allergy"],"p_dietary_restrictions":[],"p_expected_revision":"0","p_consent_revision":"1" }` (test_allergy는 로컬 test catalog만). 출력은 get 응답과 같은 형식, row revision 증가. 만료 S1003, state/data revision 불일치 S1004, 코드 미등록 22023. 실패 시 부분 저장 없음. grant 갱신은 이 API에서 하지 않는다.

health 저장/읽기는 관련 상태 잠금 후 검사. 만료 뒤 grant를 다시 해도 만료된 payload를 자동 복구하지 않는다. 유효기간 내 명시적 재동의는 유효 데이터의 consent_event_id를 새 사건으로 원자적으로 다시 결합할 수 있다. state revision 변경으로 이전 작업의 저장은 거부한다.

### 8.11 run_s1_health_retention(p_limit integer DEFAULT 1000)

service_role 전용, SD/search_path 고정. authenticated/anon/PUBLIC EXECUTE 없음. limit=1..10000, 사용자 ID/삭제 시각은 받지 않는다. 결과 `{ "deleted_profiles":12,"expired_states":12,"remaining_due":false,"server_time":"2027-10-18T00:00:00Z" }`. 원문/개인 ID 목록 반환 금지. due state를 순서대로 잡고 profile lock 후 다시 검사한다. 1회 호출 한 batch, 스케줄러가 remaining_due일 때 반복하되 예산 종료/실패를 운영 경보로 남긴다. 유효 grant 없는 orphan 건강 행도 검사/삭제한다.

배치의 잠금 순서는 대상 profile ID를 잠금 없이 목록화 → profile row lock → 상태 재조회/검사다. state를 먼저 잠그고 profile을 기다려 다른 동의 RPC와 교착하지 않게 한다. 만료를 확정하면 expire 사건(source=maintenance)을 추가하고 상태 revision/latest_event를 갱신하며 payload를 삭제한다. 이미 expired인 행에는 사건을 중복 생성하지 않는다. 배치 실행 전 읽기 차단은 이 사건 생성 여부와 무관하다.

## 9. 가입·재동의·앱 흐름

1. 가입 화면 진입 시 manifest를 읽는다. 네트워크 오류면 동의 제출을 막고 재시도 제공. 서비스/개인정보/건강/마케팅 원문과 버전을 연결한다. 건강 체크는 선택이며 service && privacy만 가입 필수 조건.
2. Auth signup 후 세션이 있으면 complete_signup_consents → status accepted 확인 → 개인 프로필/비민감 취향 저장 순서. AuthProvider의 pending profile 저장 effect가 동의보다 먼저 실행되지 않게 조정한다.
3. 이메일 확인 대기는 기존 pending 프로필과 별개로 request_id, 사용자 일치용 식별, 문서 version/hash, 네 가지 선택, savedAt만 기기에 보관한다. 건강 원문/비밀번호/token 추가 금지. TTL 3일, 계정 불일치/만료 시 파기. user_id가 확보되면 이메일만이 아니라 user_id도 일치시킨다.
4. 세션 생성 후 같은 문서이고 TTL 내인 경우 명시적으로 선택했던 가입 동의를 제출한다. 동의일은 서버 확정 시각이며 과거 클릭 시각으로 backdate하지 않는다. pending이 없거나 문서가 바뀌면 원문과 선택 항목을 다시 표시한다. 이미 선택 동의를 변경한 계정에 오래된 pending payload를 replay하지 않는다.
5. useConsentGate는 `loading|accepted|required|error`. 오류 화면에서도 문서 열람/로그아웃/선택 동의 철회/계정 삭제 진입을 제공한다. 로딩 지연으로 무한 spinner만 남기지 않는다.
6. 재동의 제출은 service/privacy만 기록한다. 기존 건강/마케팅 체크를 기본 false로 덮어쓰지 않는다. 재동의 화면의 선택 동의 철회는 별도 제어 action이다.
7. App.tsx의 ConsentGate 밖에서 알림 provider/네비게이터/프로필 자동 fetch가 pending 사용자 데이터를 요청하지 않게 한다. accepted에서 required/error로 바뀌면 본문 unmount, 계좌/건강/추천 캐시 제거. auth account 변경·포그라운드 복귀 때 status 재조회.
8. 설정에서 건강 동의일/만료/철회, 마케팅 상태/다음 재확인 시점 표시. 마케팅 동의 ON이어도 광고 발송 활성화라고 표시하지 않는다.
9. 계정 삭제는 S2용 handler/route 슬롯을 gate 예외로 마련한다. S2 미구현 상태에는 미구현 안내를 표시하고 삭제됐다고 주장하지 않는다. S2 구현 시 진행 중 정산 때문에 재동의부터 하도록 다시 막지 않도록 경계를 인계한다.
10. S5 STEP 2는 get_my_consent_status의 health가 granted/미만료인지 확인. 아니라면 별도 선택 동의 표시, 거절 시 건강값/미제출 초안 폐기 후 STEP 1만 이용. grant 후에만 건강값 입력·저장.

## 10. 만료 배치와 추천 경계

### 10.1 하루 1회 물리 파기

로컬 근거: `20260907140000_delete_settled_rooms.sql:103`은 pg_cron 설치/예약 실패를 warning으로 넘기고, `20260907160000_drop_expired_rooms_cron.sql:14`는 기존 방 청소 job을 해제한다. `supabase/config.toml`의 PostgreSQL 17 설정만으로 cron 가용성을 보장할 수 없다. 원격 pg_extension/cron.job은 미확인이다.

- 우선안: pg_cron job `s1-health-retention-daily`, 매일 03:00 Asia/Seoul(UTC 18:00, cron timezone UTC일 때 `0 18 * * *`). 작업자 시간대 설정을 실제 확인하고 중복 예약하지 않는다.
- 대안: 별도 예약 서비스가 Edge Function `s1-health-retention`을 매일 호출한다. **Edge Function 배포만으로 예약 실행되지 않는다.** 실제 외부 scheduler 등록/성공 이력까지 필요하다. pg_cron이 없는 환경에서 pg_cron으로 Edge Function을 예약하는 순환 대안을 제시하지 않는다.
- 함수는 전용 scheduler 인증을 확인하고 내부 service_role로 run_s1_health_retention만 호출. 브라우저 JWT는 거절. secret은 승인된 운영 secret store에만 두고 source/config/log에 넣지 않는다.
- 마지막 성공/실패·처리 개수는 플랫폼 작업 로그로 관측, 원문/사용자 ID 로깅 금지. 1일 주기+실행 지연을 넘기면 운영 경보. S1은 별도 마케팅 발송 job을 등록하지 않는다.
- 배치가 멈춰도 사용 차단은 독립적으로 동작한다. 정상 물리 삭제 지연은 다음 일일 실행까지 최대 약24시간+실행 지연이다. 즉시 물리 삭제라고 보고하지 않는다.

### 10.2 S5 추천으로 넘기는 계약

- 현재 S1 추천은 건강정보를 새로 사용하지 않는다. 기존 Edge Function에는 필수 약관 검사만 추가하고, 건강 입력을 사용자 body나 레거시 tastes에서 수용하지 않는다.
- S5는 사용자 JWT 검증 → 필수 약관 → 현재 방 멤버십 → 각 건강 동의 유효성 → 필요한 데이터만 서버 처리 순서. admin client를 쓴다는 이유로 앞 단계를 생략하지 않는다.
- 일반 취향과 건강정보는 다른 테이블/API. taste_counts에 allergy/diet key나 사용자별 건강정보·인원수를 추가하지 않는다.
- 공급자 호출에 건강 원문을 보내는 설계는 S1 승인에 포함되지 않는다. 주재료 데이터 검증과 서버 제외 정책을 S5에서 검토한다. category만으로 안전한 알레르기 필터라고 주장하지 않는다.
- 진행 중 추천은 동의 revision과 가장 이른 valid_until을 묶고 사용 직전/응답 확정 전에 재검사. 철회된 데이터를 이용해 새 결과를 만들거나 이전 응답이 클라이언트 캐시를 복구하지 못하게 한다. 이미 전송한 제공자 요청을 소급 삭제했다는 보장 금지.

## 11. 데이터 이전·구버전·롤백

1. `privacy_settings`: birth→birthdate, account→bank_account. 같은 의미의 두 키가 모두 있으면 하나라도 private면 private. 단독 정상 public은 유지. 잘못된 값/누락은 private. unknown key 제거. JSON과 앱 adapter 모두 정식키로 통일.
2. 레거시 tastes: 취향게임 답은 알려진 6개 boolean을 포함해 새 음식 프로필로 옮기지 않는다. **데이터 삭제: profile_private.tastes(취향게임 답) 전량, 이전 없음**. M3에서 모든 tastes를 `{}`로 비우고 빈값 제약·직접 UPDATE 권한 회수를 유지한다. 기존 사용자에게는 다음 실행 때 음식 프로필 입력을 안내한다. migration은 새 음식 행도 만들지 않으며, 재동의 후 조회는 빈 취향·revision=0을 반환하고 명시적인 새 저장 때만 행을 만든다. S5 전까지 남는 취향게임 화면의 6개 boolean 신규 저장은 그대로 허용한다. 원문을 migration log/임시 archive에 복제하지 않으며 운영 삭제는 별도 승인된 migration 적용 때 수행한다.
3. personal_data: gender/bio만 유지하는 기본 변환. 단, 이전에 계좌·birth 등 정규 컬럼으로 옮겨야 할 키가 있으면 **샘플 값을 외부에 노출하지 않는 키/형식 inventory와 로컬 synthetic upgrade fixture**로 매핑을 먼저 확정한다. unknown 키를 의미 없이 정규 컬럼에 매핑하거나 건강 동의가 있다고 가정하지 않는다. 확인되지 않은 업무 데이터 손실은 upgrade blocker로 보고한다.
4. 참가자 개인 JSON/저장 출발지는 제거. schedule은 방 제출용 데이터만 유지. 새 participant_snapshot 함수가 신원과 필요한 방 정보만 생성하도록 확인한다.
5. 계좌: notification 사본은 전부 삭제. bill은 creator+고정 members가 유효하고 settlement_id로 연결된 서버 알림 또는 검증 가능한 정산 생성 사건이 있을 때만 `legacy_linked_request`. 당시 별도 동의 시각은 추정하지 않음. 근거 없는 bill은 source=NULL로 두고 원문 반환 금지. 생성자가 새 요청을 명시적으로 제출하면 현재 요청 근거로 전환 가능.
6. 완료 bill은 migration 시 closed_at=실제 접근 종료 시각을 기록하고 원문을 비움. 미완료이며 source가 확인된 bill snapshot은 유지. 프로필 계좌 스위치는 이 이전 판정에 사용하지 않는다.
7. 마케팅은 최신 `(agreed_at,id)`로 상태를 복원. latest true면 그 기존 시각+2년, false면 declined. 이력이 없으면 not_asked. 허위 안내 발송/재확인 사건을 만들지 않음. health는 과거 동의로 backfill하지 않는다.
8. 가입 트리거의 구 자동 필수 동의는 과거 이력으로만 남김. 현재 bundle을 승인한 것으로 바꾸지 않음. 새 gate는 정확한 문서/최신 사건을 요구.
9. 구버전 앱이 직접 계좌/participants.*를 요청하면 열 권한 오류가 나는 것이 맞다. 개인정보 보호를 위해 grant를 되돌리지 않는다. 앱 지원 버전/업데이트 유도와 운영 전환을 조율한 뒤 승인받아 적용한다.
10. 롤백은 새 안전 RPC를 유지하거나 기능 비활성화로 처리. 삭제한 건강·알림 계좌를 복원하지 않음. 구 RLS/자동 동의 true/원문 grant로 되돌리지 않음. M1~M7 일부만 내려야 하는 상황은 보호 경계 유지 여부를 다시 검토.
11. S2 cascade: 신규 profile-owned row, consent_requests 포함 삭제 확인. 기존 bill.creator_id/member.profile_id의 SET NULL 구조와 충돌하는 새로운 NOT NULL/RESTRICT 참조를 추가하지 않는다. 새 테이블에 이름·이메일 사본을 저장하지 않는다.

## 12. SQL·앱 테스트 계획과 로컬 실행

### 12.1 역할별 기대 결과

테스트 fixture: A=계좌/프로필 소유자·정산 생성자, B=같은 유효한 방+고정 정산 참여자, C=친구만, D=무관, E=정산 생성 후 방에 들어온 멤버, F=과거 방 메이트이나 현재 방 없음+고정 정산 참여자, G=미동의 사용자. A~F는 현재 필수 동의 완료. 최소 2개 방으로 cross-room 사례도 만든다.

| 호출자 | A 일반 공개필드 ON/OFF | 미완료 bill 계좌(프로필 스위치 OFF) | 완료 bill 계좌 | A 건강정보 | 본인 optional 철회 |
|---|---|---|---|---|---|
| A | 본인 허용 | 허용 | null/completed | 유효 동의만 | 허용 |
| B | ON만 | 허용 | null/completed | 거절 | 허용 |
| C | identity_only | P0002 | P0002 | 거절 | 허용 |
| D | identity_only | P0002 | P0002 | 거절 | 허용 |
| E | ON만 | P0002 | P0002 | 거절 | 허용 |
| F | identity_only | 허용 | null/completed | 거절 | 허용 |
| G | S1001 | S1001 | S1001 | S1001 | 허용 |
| anon | 42501/ACL 거절 | 거절 | 거절 | 거절 | 거절 |

탈퇴 계정(S2 fixture)은 profile 삭제 후 개인 신규 row 0건, A 데이터에 대한 그 JWT의 일반 API 접근 실패. FK cascade가 기록 익명화 작업을 막지 않는지 확인한다. S2 익명화 자체를 S1 테스트 통과로 주장하지 않는다.

### 12.2 A가 작성할 파일

- `supabase/tests/s1_consent_visibility.sql`: pgTAP 사용 가능 시 전체 동작/assertion. 트랜잭션 rollback.
- `supabase/tests/s1_consent_visibility_plain.sql`: pgTAP 불가 시 동일 핵심 assertions를 DO/RAISE EXCEPTION으로 실행. 테스트 수/범위가 줄어든 경우 명시.
- `supabase/tests/s1_upgrade.sql`: 구 키 충돌/개인 JSON/알림 계좌/구 동의/완료 정산 synthetic fixture upgrade. live dump 사용하지 않음.
- `supabase/tests/s1_concurrency.ps1`: 기존 scripts의 stdin psql 및 두 세션 job 패턴 재사용. scripts 디렉터리는 수정하지 않고 A 소유 supabase/tests에 둠.
- `supabase/tests/s1_acl_inventory.sql`: table/column grant, SECURITY DEFINER/search_path, callable 함수 gate, 새 schema 객체 default grant, orphan 상태 검사.

필수 assertion:

1. 실제 `SET LOCAL ROLE authenticated`와 서로 다른 JWT claim으로 raw table/column/RPC/임베디드 동작. 관리자 결과만으로 RLS 통과 주장 금지.
2. follows를 스스로 추가해도 권한 증가 없음; room 만료/회원 제거/초대 대기에서 개인 필드 미반환; 방장도 OFF 필드 못 봄.
3. JSON 별칭 충돌·누락·잘못된 값, unknown key, stale revision, 조회자 위조 인자 실패.
4. 계좌 스위치 OFF여도 요청한 미완료 bill의 고정 참여자에게 반환. 완료 즉시 RPC null, raw SELECT 권한 없음, notification 사본 빈값. 1인 정산 INSERT 완료와 완료 되돌리기 후 재공개 금지.
5. 신규 signup metadata 누락/위조로 자동 true 생성 안 됨. 두 필수 동의 중 하나만 참이면 gate 실패. 현재 version/hash 불일치, current 0건, 이미 게시된 본문 변경 거절.
6. 가입 health=false/marketing=false 허용. 필수 재동의가 두 선택 상태를 바꾸지 않음. gate error/pending에서도 철회 성공. 마케팅 ON이어도 sending_enabled=false.
7. 건강 미동의/만료/철회에서 raw SELECT·RPC·save 실패. 시간 비교는 만료 전/정확한 시각/후, 윤년, session timezone 변경. 클라이언트 임의 시각 입력 거절.
8. 만료 데이터는 배치 전에도 읽기 금지. 배치 후 0행, 재실행 idempotent. 만료 후 grant가 과거 데이터를 복구하지 않음.
9. 두 연결에서 저장 대 철회, grant 대 배치, 중복 request_id, revision 변경, 같은 bill 완료 대 계좌 조회/수정 경쟁. 두 작업의 선후 선형화 지점을 정의하고 철회/완료 commit 이후 새 요청에서 원문 미반환을 확인.
10. request_id 동일 payload 재시도 사건 수 유지. 옛 grant 재시도 뒤 현재 withdrawn 유지. 서로 다른 payload는 S1007.
11. 일반 REST의 모든 public 사용자 테이블에서 G가 조회/쓰기 불가. 모든 callable SD RPC를 inventory하여 G의 호출이 side effect 없이 거절되는지 확인.
12. service_role의 건강 직접 쓰기 grant 없음, maintenance 함수만 사용. anon/authenticated의 maintenance 호출 거절. gate bypass Edge 호출에서 provider mock 호출 0회.
13. 개인 profile 삭제 cascade, 신규 FK의 S2 방해 없음, 데이터/토큰이 오류·작업 로그에 포함되지 않음.

### 12.3 실행 방법 (로컬만)

현재 스크립트의 기본 container는 `supabase_db_mealchat_v2`. 실행자는 먼저 이름/마운트/포트를 확인하여 **로컬 격리 DB**임을 확정한다. `.env`/remote connection string 필요 없음. 기존 로컬 작업 데이터가 있는 DB를 임의 reset하지 않는다. 신규 격리 로컬 stack에서 `supabase start`, `supabase migration up --local` 또는 명시적으로 폐기 가능한 DB의 `supabase db reset --local`로 M1~M7을 적용한다. `--linked`, 원격 `--db-url`, `db push` 금지.

PowerShell 예시(이미 실행 중인 격리 container에서 테스트만 실행):

```powershell
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$DockerExe = 'C:\Users\PC\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$Container = 'supabase_db_mealchat_v2'
& $DockerExe inspect --format '{{.Name}} {{json .Mounts}}' $Container
if ($LASTEXITCODE -ne 0) { throw 'Local container inspection failed' }
# 출력으로 로컬 격리 컨테이너임을 확인한 뒤 다음 단계 실행.
$Sql = Get-Content -Encoding utf8 -Raw 'supabase/tests/s1_consent_visibility.sql'
$Output = @($Sql | & $DockerExe exec -i $Container psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f - 2>&1)
$SqlExit = $LASTEXITCODE
$Output | Write-Output
if ($SqlExit -ne 0 -or ($Output -match '^\s*not ok\b') -or ($Output -match 'Looks like you')) {
  throw 'S1 SQL assertions failed'
}
```

기존 SQL은 `create extension if not exists pgtap with schema extensions`를 사용하지만 현재 runtime에서 사용 가능한지는 미확인이다. 먼저 로컬 pg_available_extensions를 확인한다. 사용할 수 없으면 plain SQL을 같은 stdin 방식으로 실행한다. pgTAP의 not ok는 psql 종료 코드가 0일 수 있으므로 위 TAP 실패 검사 또는 pg_prove도 필수다.

테스트 SQL 기본 형태:

```sql
begin;
-- 관리자로 가상 fixture 생성. 실존 이메일/개인값/secret 금지.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
-- RPC/table assertion. pg_temp.sqlstate_of 등으로 기대 SQLSTATE 검사.
reset role;
-- 건강 기한 등 경계 fixture는 관리자로 변경하고 다시 role을 전환하여 검사.
rollback;
```

plain SQL은 불일치 시 RAISE EXCEPTION하고 psql의 ON_ERROR_STOP으로 비정상 종료한다. 두 연결 경쟁은 다른 연결의 uncommitted fixture를 읽을 수 없으므로 테스트 전용 fixture를 commit하고 try/finally에서 해당 UUID만 정리한다. 기존 scripts처럼 SQL은 stdin으로 전달하며 psql -c에 여러 줄 JSON을 삽입하지 않는다. 운영 시각을 임의로 바꾸는 override 함수는 공개하지 않는다.

### 12.4 B의 테스트

- manifest/hash/LegalDocument canonical serialization, schema 변경 시 version 일치, 선택 항목이 필수 조건이 아닌지 확인.
- 가입 즉시 session/이메일 확인 대기/pending 만료/다른 계정/문서 변경/timeout 재시도.
- gate loading/required/error에서 본문 provider 미마운트, 허용된 제어만 표시, 복귀 시 재판정.
- 필수 재동의가 marketing/health를 변경하지 않음, 철회 성공 전 성공 표시 금지, 철회 후 cache·입력 삭제.
- privacy key 정규화·revision 경쟁·저장 실패 복원, profile account OFF와 settlement account OPEN의 독립.
- settlement completed/unavailable/forbidden이면 계좌 표시·복사·Toss 링크 생성 금지. 송금 직전 재조회.
- recommendation wrapper의 Auth/gate/함수 호출/provider/parse/validation/render를 독립 검증. 건강 필터는 S5 미구현으로 구분.
- focused Jest/Deno/SQL 이후 변경이 모이면 npm run quality. 기존 concurrency·정산 계약 테스트의 현재 약관 fixture도 보완하여 회귀 실행. 통과를 위한 권한 완화 금지.

## 13. 작업 분할·순서·인계

보안/인증/건강/금전 경계를 포함하므로 A/B 모두 주 구현 책임 범위다. A가 supabase/**, B가 앱을 소유한다. 한 파일에 한 작성자만 둔다.

| 단계 | A: DB/SQL/Edge | B: 앱 | 완료 기준 |
|---|---|---|---|
| 0 계약 고정 | migration 순서, SQLSTATE, seed 수용 확인 | 본문으로 mock fixtures 생성, 원문 canonical 생성 | 8장 args/data/error 일치, 파일 소유권 확인 |
| 1 병렬 기반 | M1~M3, 건강/동의 SQL, 유지보수 함수 | consents API/hooks, signup/reconsent/settings mock 개발, 선택 문서안 | 미동의/기한/철회/재시도 focused test |
| 2 공개/엄격 gate | M4~M6, Edge gate, grant inventory | profile API/privacy 화면, App gate/자동 저장 순서 연결 | raw table/SD/Edge 우회 차단, pending 본문 미마운트 |
| 3 bundle 통합 | B의 hash 검증 후 M7 seed, upgrade 리허설 | manifest 실제 RPC 연결, 문서 불일치 재표시, 선택 상태 유지 | 신규/기존/이메일 확인 전체 경로 |
| 4 마지막 화면 연결 | settlement 상세 RPC·알림 호환 확정 | **소유권 인계 후** chat/settlement 화면과 lib 전환 | 스위치 OFF도 open bill 계좌 표시, completed 계좌 관련 조작 불가 |
| 5 통합 검증 | SQL/동시성/ACL 재실행, diff 증거 제출 | quality/UI/cache 검증, diff 증거 제출 | 독립 코드 검토, 경계 최종 승인. 원격 미반영 명시 |

B의 주요 소유 파일:

- `src/lib/consents.ts`, `src/consents/**`, `src/auth/**`。
- `src/screens/signup/**`, `src/screens/auth/**`, `src/screens/settings/**`。
- `src/screens/profile/PrivacyScreen.tsx`, `src/lib/profile.ts`, 관련 Jest tests.
- 필수 연결 파일은 App.tsx, src/components/ui/TermsCard.tsx, src/legal/{terms,privacy,healthConsent,marketingConsent}.ts, src/profile/useMyProfile.ts, src/navigation/**다. B에게 소유권을 명시적으로 배정하고 기존 작업자가 편집 중이면 완료/인계까지 변경하지 않는다. 법률 원문 수정은 4장의 문구 확인 절차를 따른다.
- 최종 단계에 src/screens/chat/**, src/screens/settlement/**, src/lib/settlements.ts, 관련 알림 UI/cache, 필요한 src/lib/rooms.ts를 인계받아 연결한다. 선행 작업자와 동시에 편집하지 않는다. mock만으로 최종 통합 완료라고 하지 않는다.
- src/lib/supabaseConfig.ts는 S1 목적으로 변경할 필요가 없으며 다른 작업자의 변경을 보존한다.

A는 B의 JS 파일을 편집하지 않고 B는 SQL/Edge를 편집하지 않는다. mock 계약과 실제 SQL 응답이 다르면 한쪽만 변경해서 숨기지 말고 먼저 이 계약을 조정한 뒤 양쪽을 함께 검증한다. SQL 검증에 필요한 PowerShell은 supabase/tests 안에 둔다.

## 14. 운영 반영의 개별 승인과 미확인 사항

개별 승인이 필요한 항목:

1. M1~M7 적용 대상·SQL identity·기존 데이터 삭제 범위를 명시한 원격 migration 적용.
2. pg_cron extension 추가/활성화, 일일 job 등록·변경·삭제. 존재뿐 아니라 job 성공 이력 검증.
3. 대체 외부 scheduler 등록/자격 정보 설정, s1-health-retention Edge Function 배포.
4. schedule-recommend의 gate 추가판 배포. Auth 설정/secret 변경이 필요하면 별건 승인.
5. 현재 문서와의 문구 차이를 해결한 원문·version/hash 공개, 구 클라이언트 전환 방침.

승인 후 migration/function identity 확인, 다중 사용자 격리와 실제 앱의 가입/재동의/계좌/철회, security advisors를 다시 검증한다. cron/Edge job 1회 성공만으로 일일 보관 처리나 앱 E2E 전체 성공으로 판단하지 않는다.

미확인: 원격 schema/데이터, 실제 pg_cron/pgTAP 가용성, 외부 scheduler, backup 파기 운영, 기존 데이터의 미분류 personal_data 키, 실기기 전체 경로, 독립 보안 검토. 마케팅 법령의 상세 해석은 이 명세에서 추가 검증하지 않았으며 승인된 ‘2년 재확인·현재 발송 없음’을 구현 요건으로 삼는다.

이 문서 작성 중에는 문서 외 파일을 변경하지 않았고 원격 접근·.env 읽기·SQL 적용·앱 테스트를 하지 않았다. 현재 원문 2건의 canonical hash만 로컬에서 계산했다.
