# S5 일부: 음식 프로필과 식당 추천 경로 복구 명세

작성 기준: 2026-10-17, `Develop`, HEAD `34a3367` 및 S1 미커밋 작업 트리. **구현 제안서이며 보안 승인·운영 반영 증거가 아니다.** 이 작업은 이 문서만 추가한다. 코드, 기존 문서, 마이그레이션, 원격 Supabase/Figma, `.env`는 변경하거나 접근하지 않았다. 실제 운영 권한 조회와 실기기 검증은 수행하지 않았다.

표기: **확정**은 위임자가 전달한 사용자 결정, **제안**은 이 문서의 구현 기본안, **보류**는 제품 결정 또는 독립 검토 후에만 활성화할 항목이다. 제안을 사용자 승인으로 취급하지 않는다.

## 1. 범위와 현재 근거

### 1.1 범위 / 비범위

- 범위: 음식 프로필 STEP 1·2, 가입 후 입력·프로필 편집·기존 사용자 안내, 레거시 취향게임/가입 일러스트 경로 제거, 새 카탈로그·저장 RPC, 서버가 수집하는 식당 후보, 건강정보의 서버 제외, 새 추천 계약과 회귀 테스트.
- 범위: 차단된 `meeting_midpoint`를 호출하지 않고 식당 추천을 이용하는 경로. 초기 복구는 **명시적으로 정한 공용 만남 지역**을 사용한다. 비공개 출발지를 이용한 자동 중간 지점은 별도 조건부 단계다.
- 비범위: S1 전체 재구현, 계정 삭제 S2, 정산·주문 변경, 캘린더 동기화, 건강 진단/안전 보증, 알레르기 지식 자동 생성, 운영 데이터 수집·크롤링, 기존 약관 원문 임의 수정, 외부 배포.
- 추천이 잘 된다는 이유로 기존 정밀 좌표 RPC의 실행 권한을 복구하지 않는다. 시간 추천 저장·방 stage 전환의 기존 TODO는 이 작업에서 해결됐다고 보고하지 않는다.

### 1.2 읽은 소스와 확인 범위

아래 줄은 작성 시점 기준이며 S1 동시 수정 후에는 심벌을 기준으로 다시 찾는다.

| 근거 | 확인 내용 / 구현 영향 |
|---|---|
| `docs/S1-design.md` §6.3, §8.10, §10.2 | 일반 취향/건강 저장소 분리, 건강 동의·revision 검사, 서버 제외 계약 |
| `supabase/migrations/20261017092000_s1_food_health_storage.sql:26` | 레거시 6개 boolean을 새 food 테이블로 복사한다. 이번 **이전하지 않음** 결정과 충돌 |
| 같은 파일 `:53`, `:70`, `:78` | food schema=1, 건강 배열 2개, 동의 잠금/저장 RPC. STEP 1 새 차원과 STEP 2 단일 선택을 아직 표현하지 않음 |
| `20261017091000_s1_consent_rpcs.sql:141` | 가입 트리거가 food 빈 행을 만듦. S5 기본값과 함께 검증 필요 |
| `20261017093000_s1_profile_visibility.sql:30` | 참가자 행의 출발지 사본 제거. 새 추천은 이 열들을 다시 채우면 안 됨 |
| `20261017095000_s1_terms_access_gate.sql` | 기존 사용자 데이터의 필수 약관 restrictive gate. 신규 테이블/RPC도 같은 경계 적용 |
| `20260906141801_contain_meeting_midpoint.sql:8` | 함수가 있으면 PUBLIC/anon/authenticated 실행 권한 회수 |
| `src/lib/placeCandidates.ts:43`, `src/lib/meetingPoint.ts:30` | 앱이 사용자 ID 목록과 본인 좌표로 RPC 호출, 권한 오류를 그대로 throw |
| `src/screens/schedule/ScheduleConfirmedScreen.tsx:80`, `src/screens/chat/ChatRoomScreen.tsx:265` | 일정·채팅 두 경로 모두 위 후보 생성에 의존 |
| `supabase/functions/schedule-recommend/index.ts:253`, `:325`, `:401`, `:614` | S1 방 권한 검사 후 앱 제공 후보를 사용. 형식 검사는 있으나 Tmap 유래/재료의 진위 검증은 아님 |
| 같은 파일 `:289` 부근 | 시간 제출이 없으면 전체 요청 실패. 식당 전용 요청도 일정에 묶인 문제를 분리해야 함 |
| `src/screens/profile/ProfileHomeScreen.tsx:42` | '음식 취향 매칭'은 `TasteGame`, 완료는 boolean like 개수에 의존 |
| `src/screens/signup/SignupPersonalScreen.tsx:55`, `SignupCalendarScreen.tsx:23`, `SignupTasteScreen.tsx:23` | 가입 일러스트 → 취향게임 → 약관 순서가 남아 있음 |
| `src/auth/pendingSignupProfile.ts:19`, `src/lib/profile.ts`의 `saveTastes` | 가입 대기 데이터와 저장 어댑터도 레거시 boolean을 다룸 |

운영 결함의 근거 수준: **메인이 운영 DB에서 authenticated 실행 권한 회수를 확인했다고 전달함**. 로컬 코드상 이 권한 상태라면 후보 생성이 실패하는 경로가 확인된다. 실제 운영 마이그레이션 일치·네트워크 오류·실기기 전체 체인은 이번에 확인하지 않았으므로 “운영 복구 완료”라고 할 수 없다.

`docs/WORKFLOW.md`의 구현/검증 절차와 `docs/figma-specs.md`를 읽었다. 두 문서의 과거 배포 상태 및 구 Figma 파일 `xBf3b09D6Bj1dTiCixt25e`의 220×486 좌표는 이번 Phone 화면의 근거가 아니다.

### 1.3 S1 의존성과 선행 수정 목록

| 의존 | S5 착수/반영 조건 |
|---|---|
| S1 문서·선택 동의 계약 | `get_consent_manifest`, `get_my_consent_status`, `set_optional_consent`, 본인 profile 잠금, health 1년 만료/철회·물리 파기 계약 확정 |
| S1 M3 food/health | 아래 schema v2 확장. S1 문서 §6.3·§11.2와 M3의 레거시 복사 결정을 **미이전**으로 조정할 책임은 S1 담당자에게 있음. 이 문서에서는 수정하지 않음 |
| S1 M4 공개 범위 | `origin=public`은 서버 계산 사용 허용일 뿐 타인 좌표 공개 동의가 아님. 참가자 사본 금지 유지 |
| S1 M6 및 별도 M7 활성화 | 로컬 스키마 존재와 현재 약관 bundle 활성화를 구분. `supabase/release/20261017100000_s1_activate_terms.sql` 보류와 release gate를 우회하지 않음 |
| S1 앱 gate | 가입 세션/필수 동의 완료 전 food/health 요청 없음. 동의 오류 시 본문·민감 캐시 제거 |
| S1 현재 Edge 변경 | `consentGate.ts`의 사용자 JWT 기반 필수 약관·방 확인 유지. admin client 생성 자체는 권한 검증이 아님 |

S1 검토로 이름·잠금 순서·응답이 바뀌면 먼저 본 문서의 계약을 맞춘다. S1 미검토 상태에서 S5 테스트 통과를 S1 보안 승인으로 대체하지 않는다. 이미 적용된 원격 migration은 다시 쓰지 않고 추가 migration으로 전환한다. 미적용 여부는 메인이 승인된 읽기 확인으로 판정한다.

## 2. 확정된 제품 결정과 화면 근거

1. 레거시 취향게임의 6개 boolean을 새 음식 프로필로 옮기지 않는다. 기존 사용자는 다음 실행 때 새 입력 안내를 받는다.
2. 취향게임 화면과 가입 일러스트 화면은 제거 대상이다.
3. 가입 약관의 건강정보 동의는 선택이다. 미동의 사용자는 STEP 2 진입 때 다시 묻고, 거절해도 기본 서비스를 이용한다.
4. 건강정보 원문은 Gemini에 보내지 않는다. 조건에 맞지 않는 후보는 서버에서 제외한다.
5. 주재료 데이터가 없으면 건강 필터를 완료로 표시하지 않는다.
6. 화면 기준은 Figma `euLZpuvJsmuOhVKwtDkdhJ` / `Phone` / `02 가입·음식 프로필`. STEP 1은 음식 종류·주재료·형태·매운맛. STEP 2는 알레르기 단일, 식단 유형 단일, 추가로 피할 것 복수. “상관없음”은 같은 그룹 안에서 배타 선택이다.

**Figma 상세: 메인이 노드 명세 제공.** 이번 도구 목록에 Figma 도구가 없었다. 화면별 node ID, option 전체 목록/문구, 기본 선택, STEP 1 복수 허용 범위, 최대 선택 수, CTA/skip 문구, 프레임 크기, 좌표, 컴포넌트 variant, 스크린샷은 미확인이다. 아래 카탈로그 예시는 시안에서 추출한 결과가 아니다. 구현자는 이 표를 메인에게 받아 코드/렌더/노드 대응표를 완성해야 한다.

| 화면/상태 | 필요한 Figma 인계 |
|---|---|
| 가입 약관·건강 원문 | Phone 노드, 선택 약관/전체 동의의 실제 상태, 원문 열기 |
| STEP 1 | 네 그룹의 option 라벨·선택 수·상관없음·저장/다음 |
| STEP 2 + 동의 시트 | 단일/복수 선택 노드, 동의 거절/입력 건너뛰기, 오류 |
| 완료·프로필 진입·기존 사용자 안내 | 완료 표시/편집 CTA, 안내 배너 또는 시트, 다시 안내 조건 |
| 추천 지역 선택·검증 미완료 카드 | 기존 화면 재사용 여부 및 신규 상태 노드 |

## 3. 저장 모델과 카탈로그

### 3.1 공통 규칙

- 라벨과 저장 코드를 분리한다. 코드는 ASCII `^[a-z][a-z0-9_]{0,63}$`, 번역/정렬을 바꿔도 의미를 바꾸지 않는다. 의미 변경은 새 코드/새 catalog version이다.
- 카탈로그는 DB가 기준이며 앱에 독립 상수 목록을 중복 관리하지 않는다. 응답은 version, schema version, group, code, label, sort_order, enabled, 선택 제약을 포함한다. 제출은 읽은 catalog version과 함께 한다.
- DB는 타입, 정확한 허용 키, null, 중복, 잘못된 category, 미등록/disabled 코드, 길이·개수, sentinel 혼합을 검증한다. 앱 검증은 UX용이며 서버 검증을 대신하지 않는다.
- 비활성 코드가 저장돼 있으면 읽을 때 자동 삭제하지 않고 본인에게 수정 필요로 표시한다. 수정 저장은 활성 코드로 전체 replace한다. 건강 규칙 매핑이 사라진 기존 코드는 안전 판정 근거로 사용하지 않는다.
- 본인 외 food/health SELECT는 허용하지 않는다. `profile_private.personal_data`, `participants`, Auth metadata, analytics에 음식/건강 프로필을 복제하지 않는다.

### 3.2 STEP 1: 비민감 음식 취향 schema v2

`public.profile_food_preferences`를 재사용한다. 최종 활성 상태는 `schema_version=2`, `preferences jsonb`, `revision bigint`, `updated_at`에 `completed_at timestamptz NULL`, `onboarding_seen_at timestamptz NULL`, `onboarding_snoozed_until timestamptz NULL`를 추가한 구조다. 시간은 서버만 정한다. 운영 준비 단계에서는 §8.1의 추가/활성화 분리 방식으로 schema v1을 잠시 유지한다.

제안 계약:

```json
{
  "cuisines": ["korean", "japanese"],
  "ingredients": ["any"],
  "forms": ["soup"],
  "spice": "mild"
}
```

| 필드 | 제안 선택/검증 | 예시 코드; 실제 seed는 노드 인계 후 확정 |
|---|---|---|
| `cuisines` | 1..16개, 복수, `any`와 다른 값 혼합 금지 | `korean`, `japanese`, `any` |
| `ingredients` | 1..32개, 복수, `any` 배타 | `beef`, `vegetable`, `any` |
| `forms` | 1..16개, 복수, `any` 배타 | `rice`, `noodle`, `soup`, `any` |
| `spice` | 단일 문자열 | `none`, `mild`, `medium`, `hot`, `any` |

수치 상한은 API 방어 상한 제안이다. 실제 화면 선택 상한은 노드 명세를 반영한 catalog constraint로 더 좁힐 수 있다. `spice=none`은 맵지 않은 취향, `any`는 제한 없음으로 구분한다. STEP 1 주재료 선택은 **선호**이며 알레르기나 금지 재료가 아니다. 건강 제외는 선호 점수보다 항상 우선한다.

`{}`는 아직 입력하지 않음 또는 명시적 전체 초기화만 표현한다. 부분 object, 빈 배열, 생략된 필드는 거절한다. 완전한 네 그룹 저장 때만 `completed_at`을 설정한다. 전부 `any`라도 사용자가 명시적으로 저장했으면 완료다. `completed_at`은 최초 완료 시각을 유지하고 초기화 때 null로 바꾼다. 동의하지 않은 STEP 2 때문에 STEP 1 완료를 취소하지 않는다.

카탈로그 `public.food_code_catalog`는 `(catalog_version, group_code, code)` PK, label/sort_order/enabled 및 그룹 제약을 가진다. FK로 JSON 전체를 검증하려 하지 않고 고정 schema 검증 + 카탈로그 조회 trigger/RPC로 검사한다. 테이블을 읽는 검증 함수를 IMMUTABLE로 선언하지 않는다.

### 3.3 STEP 2: 건강정보 schema v2

별도 `profile_health_preferences`와 `health_code_catalog`를 확장한다. S1의 동의 사건 결합·건강 만료 삭제를 그대로 사용한다.

| 저장 열 | v2 의미 |
|---|---|
| `schema_version` 추가 | 2, schema v1 행을 완료로 해석하지 않음 |
| `allergies text[]` 유지 | 선택한 알레르기 코드 0 또는 1개. 다중 알레르기 지원은 열린 질문 |
| `diet_type_code text NULL` 추가 | 식단 유형 단일. null은 명시적 '상관없음'을 저장한 행에서만 제한 없음 |
| `dietary_restrictions text[]` 유지 | '추가로 피할 것' 0..32개. 기존 의미와 새 코드 매핑을 검증하고 재사용 |
| `completed_at` 추가 | 세 그룹을 명시적으로 저장한 시각. 행 없음/초기 상태와 빈 조건 완료를 구별 |
| `consent_event_id`, `revision`, `updated_at` | S1과 동일, 동의 갱신/파기 경로가 새 열까지 처리해야 함 |

외부 v2 API는 `allergy_code: string | null`, `diet_type_code: string | null`, `additional_avoid_codes: string[]`로 반환한다. null/빈 배열은 **저장된 complete 응답에서만** 명시적으로 '상관없음'이다. 미입력 응답은 `status=not_started`, `completed_at=null`로 구별한다. 입력 화면에서는 각 그룹 `unanswered | any | selected` 상태를 갖고, unanswered 상태로 저장하지 않는다. UI sentinel `any`는 건강 카탈로그 코드로 저장하지 않고 null/빈 배열로 정규화한다.

`health_code_catalog.category`를 `allergy | diet_type | dietary_restriction`로 확장한다. 버전 관리는 별도 catalog release 메타데이터로 추가하고 기존 `(category,code)` 참조를 유지한다. 코드 예시는 `allergy=milk`, `diet_type=vegan`, `dietary_restriction=alcohol`; **운영 목록 또는 실제 재료 배제 규칙으로 승인된 값이 아니다.** 운영 seed에는 라벨, 관련 성분/재료 규칙 ID, 규칙 version, 출처/검토일이 있어야 한다. 테스트의 `test_allergy` 등은 운영 seed에 포함하지 않는다.

건강 단일 선택은 화면 계약을 따른 것이며 “이 목록만으로 모든 알레르기를 다룬다”는 의미가 아니다. 여러 알레르기가 있는 사용자의 입력 손실을 숨기지 않도록 §11의 제품 결정이 필요하다. 자유 입력 '기타'는 v1에 두지 않는다. 미지원 조건은 입력 가능하다고 보이지 않게 하고 필터 범위 밖임을 설명한다.

### 3.4 동의와 저장의 원자성

1. STEP 1은 인증+필수 약관만 요구한다. STEP 2는 `get_my_consent_status`로 현재 health 상태를 확인한다.
2. 미동의/만료/철회이면 원문·목적·기간을 보여 주고 `set_optional_consent(..., p_kind='health', p_source='food_step2')`를 호출한다. checkbox만 바꿔서는 입력을 열지 않는다.
3. grant 서버 성공 후에만 건강 입력/조회. 거절은 decline 제어 RPC를 사용하고 초안을 폐기한다. 활성 동의 사용자의 단순 “이번 입력 건너뛰기”는 withdraw가 아니다. 철회 CTA는 별도로 명시한다.
4. 건강 저장은 profile row → consent state → health row 순서로 잠그고 lock 획득 후 `clock_timestamp()`와 최신 grant event/revision을 검사한다. 동의 만료는 읽기·추천 시에도 검사하여 배치를 기다리지 않는다.
5. v2 health의 세 필드는 한 transaction으로 replace. 실패 시 부분 저장 없음. STEP 1 저장 후 STEP 2 실패는 STEP 1을 유지하고 그 사실을 표시한다.
6. 철회/거절은 동의 상태 변경과 건강 **행 전체** 삭제를 같은 transaction에서 처리한다. `diet_type_code` 등 새 열, 검토 결과 캐시, 진행 중 요청 무효화도 포함한다. 만료 후 재동의는 과거 원문을 되살리지 않는다.
7. 건강 초안은 컴포넌트 메모리에만 둔다. AsyncStorage, 가입 대기 payload, crash report, 로그에 쓰지 않는다. 로그아웃/계정 변경/백그라운드/동의 오류·철회·만료 때 입력과 화면 데이터를 지운다. 복귀 시 서버를 재확인한다.
8. `revision`, `consent_revision`은 JSON에서 10진 문자열. 자동 conflict 덮어쓰기 금지. timeout 후에는 GET으로 저장 결과를 확인하고 사용자에게 재시도를 제공한다. v2 저장은 같은 revision 재시도를 성공으로 위장하지 않는다.

## 4. 앱 흐름과 레거시 제거

### 4.1 가입·재진입

권장 흐름: 가입 개인정보 → 가입 약관(건강 선택 포함) → Auth/이메일 확인 → 필수 동의 서버 확정 → 개인 프로필 저장 → 음식 STEP 1 → STEP 2 동의/입력 → 홈. 가입 이전에는 건강값을 수집하지 않는다. 이메일 확인으로 앱을 나갔다 돌아와도 서버 상태에 따라 음식 입력 안내부터 재개한다.

- 기존 `SignupCalendar`/`SignupTaste` 일러스트를 건너뛰고 가입 약관으로 연결한다. 실제 캘린더 권한 요청은 해당 기능 진입 때 유지하며 가입 일러스트 삭제와 실제 연동 삭제를 혼동하지 않는다.
- 음식 프로필은 가입 필수 요건으로 올리지 않는 것을 제안한다. '나중에'를 허용하고 기본 추천/수동 검색을 사용할 수 있다.
- STEP 1 저장 전 뒤로가기에는 변경 폐기 선택, 저장 중에는 중복 제출 방지. 저장 성공을 받은 뒤 다음 단계로 이동한다.
- STEP 2에서 미동의면 선택 동의를 다시 묻는다. 거절해도 STEP 1 저장은 남고 홈/프로필로 돌아간다. 원문 조회 실패를 동의로 처리하지 않는다.
- `S1001`이면 S1 재동의 gate, `S1002`이면 manifest 새로 읽기 및 관련 체크 해제, `S1003`이면 건강 초안 삭제 후 선택 동의 안내, `S1004`이면 최신값을 다시 읽고 재입력한다.
- 필수 약관 갱신은 건강 동의를 자동 철회하거나 자동 갱신하지 않는다. 건강 grant는 가입 동의/선택 동의 API만 수행한다.

### 4.2 프로필과 기존 사용자

- '음식 취향 매칭' → `FoodProfileStep1`로 연결한다. 완료 후에도 '수정하기' 진입을 제공한다. 현재 완료 상태에서 CTA가 사라지는 문제를 함께 바꾼다.
- 프로필의 해당 항목 완료는 서버 `completed_at != null && schema_version=2`로 판단한다. like 개수나 건강 동의 여부로 계산하지 않는다. 건강 설정 상태는 본인 화면에서 별도로 표시한다.
- 기존 계정은 다음 로그인/앱 실행 후 필수 약관 gate가 accepted가 되면 미입력 안내를 한 번 표시한다. 콜드 스타트보다 gate 통과가 우선이다. 네트워크 실패는 미입력으로 추정하지 않는다.
- 제안: 안내를 본 시각은 서버에 저장하고 '나중에'는 7일 snooze. 안내 시트는 계정·session별 한 번, 프로필의 설정 CTA는 계속 유지한다. 실제 snooze 기간은 제품 결정 항목이다.
- 로그아웃/계정 전환 시 전 사용자의 안내 상태·food/health 초안·추천 응답을 제거한다. 서버 GET 실패 중 이전 계정 값을 그리지 않는다.

### 4.3 제거 순서와 호환성

1. 새 v2 계약과 앱 어댑터 준비 후 네비게이션을 전환한다. `TasteGame`, `SignupTaste`, `SignupCalendar` 및 일러스트 공용 컴포넌트의 참조를 전수 검색한다.
2. `src/screens/taste/TasteGameScreen.tsx`, `src/screens/signup/SignupTasteScreen.tsx`, `SignupCalendarScreen.tsx`, `SignupIllustrationScreen.tsx`는 참조가 없어지면 제거한다. 공용 캐릭터 이미지/에셋은 다른 화면 참조가 없는 파일만 제거한다. 약관의 캐릭터 장식 삭제 여부는 새 노드 명세에 따른다.
3. `SignupDraft.tastes`, pending signup의 6 boolean 직렬화/재적용, `profile.ts`의 `saveTastes` 및 food v1 adapter, `countLikedTastes` 기반 완료 표시를 없앤다. 예전 기기 대기 payload를 읽어도 tastes는 버리고 다른 가입 정보/동의 처리 순서는 보존한다.
4. `meetingPoint.ts`의 사용자 목록/본인 좌표 RPC 경로, `placeCandidates.ts`의 클라이언트 후보 수집, `tasteKeywords.ts`의 개인별 counts 계약을 교체한다. 범용 Tmap 장소 검색은 출발지·직접 장소 검색에도 쓰일 수 있으므로 사용처 확인 후 유지한다.
5. 과거 route/deep link는 새 음식 프로필 또는 가입 약관으로 안전하게 치환하고, 신규 화면으로 연결한 뒤 기존 route union/switch와 tests를 정리한다. 삭제된 import나 영구 호환 우회 경로를 남기지 않는다.
6. 구버전 v1 food/health 저장은 `S1008 CLIENT_UPDATE_REQUIRED`로 닫는다. v1 불린 입력을 v2로 자동 변환하거나 v2 데이터를 v1로 다운캐스트하지 않는다. 구버전 추천 body도 거부한다. 롤아웃 전 지원 버전 정책이 필요하다.

### 4.4 화면 상태와 접근성

선택은 radio/checkbox 의미와 `selected` 상태를 접근성 API에 제공한다. '상관없음'을 누르면 같은 그룹의 나머지를 지우고, 다른 값을 누르면 '상관없음'을 지운다. 그룹 간 선택은 영향을 주지 않는다. 초기 자동 선택으로 답변을 생성하지 않는다.

저장 중/불러오기/빈 카탈로그/카탈로그 변경/저장 실패 상태를 각각 표현한다. 오류는 해당 그룹 옆에 표시하고 스크린리더로 알린다. 제출 실패 시 요약/첫 오류로 접근 가능한 이동을 제공하고 토스트만 사용하지 않는다. 터치 영역 최소 44×44, 색 외 체크 표시, 큰 글꼴·작은 화면·키보드·SafeArea를 검증한다. 이 항목은 `ui-ux-pro-max`의 폼 오류·접근성 지침을 적용한 것이며 Figma 좌표 확인을 대신하지 않는다.

## 5. 위치와 취향 프라이버시를 지키는 추천 경로

### 5.1 위협 모델과 초기 복구 결정

공격자는 정상 인증 사용자일 수 있다. 2인 방에서 자기 위치를 알고, 자기 좌표를 바꾸거나 여러 방을 만들고, 멤버 추가/탈퇴 전후 결과를 비교할 수 있다고 가정한다.

정확한 평균 `m=(a+b)/2`를 반환하면 `b=2m-a`이다. 평균만 반올림해도 여러 질의의 경계를 겹치면 좁힐 수 있다. “3명 이상”, “좌표를 직접 반환하지 않고 근처 식당만 반환”, “요청마다 랜덤 노이즈”도 단독으로 비식별 보장이 아니다. 위치 기반 후보/순위/거리/이동시간 자체가 관측 경로다.

**제안하는 첫 출시 경로:** 모든 방에서 서버가 관리하는 공용 만남 지역/역의 catalog ID를 방장이 명시적으로 선택한다. 개인 출발지를 읽거나 자동으로 공용 지역 선택에 대입하지 않는다. 초기에는 정확한 개인 위치로 계산한 중심·거리·이동시간을 어느 경로에도 사용하지 않는다. 이 경로로 추천 복구와 음식 프로필을 먼저 검증한다. 자동 중간 지점은 §5.2의 별도 기능 flag로 닫아 둔다.

- `room_recommendation_settings`: room_id PK/FK cascade, `public_area_id`, revision, updated_at. 개인 출발지/주소/원본 위경도 저장 금지.
- `public_meeting_areas`: 검토한 역/상권의 ID, 표시명, 고정 검색 중심, 허용 반경/지역 경계. 자유 문자열 주소나 사용자가 보낸 좌표를 직접 저장하지 않는다. 지점의 공개 위경도는 개인 출발지와 무관하다.
- 방장도 현재 유효 방의 participant여야 변경할 수 있다. 다른 현재 멤버는 읽기만 한다. 유효 방은 S1의 `expires_at > server_now`를 따른다.
- 방 생성 전의 친구/초대 대상 ID로 추천하지 않는다. 실제 방 생성과 참가 확정 후 권한을 검증한다. 현재 멤버가 1명뿐이어도 공용 지역 경로는 가능하다.
- 지역이 없으면 `LOCATION_SELECTION_REQUIRED`. 오류를 catch해서 서울 임의 좌표, GPS, 다른 멤버의 출발지로 대체하지 않는다.
- 2인 방은 항상 이 경로다. 개인 위치를 한 번도 읽지 않는지 spy/SQL 권한 테스트로 검증한다.

### 5.2 자동 중간 지점의 조건부 설계

제품이 자동 중간 지점이 필요하다고 결정하면 독립 위치 프라이버시 검토 후 별도 단계로 구현한다. 아래 수치는 위협 검토용 제안이며 익명성 증명이 아니다.

1. 사용자 JWT로 현재 유효 방·멤버십·필수 약관 검사. 입력은 room_id만 받고 임의 `target_profiles`, subset, `self_latitude`/`self_longitude`를 받지 않는다.
2. 서버에서 같은 방의 현재 멤버 중 명시적으로 `origin=public`인 유효 출발지만 사용한다. 미설정/철회/미동의는 제외하되 누가 제외됐는지나 참여 인원수를 클라이언트에 주지 않는다.
3. **방 인원과 유효 기여 인원이 모두 3명 이상이어야 한다.** 그 미만은 공용 지역 선택으로 전환한다. 2인 평균에 노이즈를 붙이는 대안은 채택하지 않는다. 3명 이상도 공모에 안전하다고 주장하지 않는다.
4. 고정 투영계/격자 version을 정하고 각 출발지를 먼저 최소 2km 셀로 양자화한 뒤 서버 메모리에서 동일 가중 중심을 구한다. 이어 중심을 고정 공용 만남 지역 또는 더 거친 격자로 스냅한다. 위경도 소수 자릿수 반올림을 미터 단위 보호 폭으로 오해하지 않는다. 경계/서비스 지역 밖/유효하지 않은 좌표는 실패 처리한다.
5. 원본 평균/합계/분산/개인 셀/개인 거리/기여 인원은 저장·반환하지 않는다. 검색 제공자와 날씨 API에는 스냅된 공용 지점만 준다. 앱에는 `area_id`, 공개 중심, 대략적인 검색 영역만 반환한다.
6. 동일 방/멤버 구성/서버 관리 epoch에서 같은 결과를 고정한다. 사용자의 출발지 변경, 초대/탈퇴/방 재생성을 통한 재질의도 계정 단위 예산으로 제한한다. 제안 예산은 방·계정별 자동 계산 하루 1회, epoch 24시간이다. 새 request_id로 예산을 우회할 수 없어야 한다.
7. 멤버 변경·origin OFF·방 만료 시 기존 결과/티켓을 즉시 무효화하고 **다시 계산하지 않고 공용 지역 선택으로 전환**한다. 철회 후 cached centroid를 계속 쓰지 않는다.

남는 한계: 공모·다계정·인구가 적은 지역·공개된 다른 정보와의 결합은 격자화+제한만으로 제거되지 않는다. 서비스가 이 위협까지 보호해야 한다면 개인 출발지 자동 계산을 출시하지 않고 §5.1을 유지한다. 자동 계산을 켜는 결정은 초기 추천 복구 승인에 묶지 않는다.

### 5.3 취향 집계의 반환 범위

- **클라이언트와 Gemini에 취향 집계 API를 공개하지 않는다.** `taste_counts`, 득표 수/비율/히스토그램, 사용자 ID별 취향, 건강 코드·인원, 기여 인원, “누구 때문에 제외”는 반환 금지다. 2인 방에서는 합계에서 본인 값을 빼는 것만으로 상대 취향이 드러날 수 있다.
- 비민감 STEP 1은 DB 내부에서만 후보별 점수 계산에 사용한다. 각 차원에서 `any`/미입력은 중립, 유효한 명시 선택의 일치도를 계산하고 사용자 한 명의 기여를 동일하게 제한한다. 제안: 네 차원의 유효한 일치도 평균 → 참가자 평균을 내부 점수로 사용하며 동점은 public 후보 ID로 고정한다. 임의 사용자 subset 인자를 받지 않는다.
- 앱은 최종 식당과 일반적 이유(예: '선택한 만남 지역의 식당')만 받는다. 개인 취향 점수, 취향별 순위 근거, 제외 전후 목록·개수는 받지 않는다. 사용자 저장 프로필의 완료 여부도 타인에게 표시하지 않는다.
- 결과 순위가 바뀌는 사실에서 취향/건강 조건을 추측할 **잔여 위험**은 있다. 식별 필드를 없앤 집계가 곧 익명 데이터는 아니다. 강한 비추론 요구가 있다면 다른 멤버의 저장 취향을 사용하지 않고 방에서 명시적으로 공개한 공통 메뉴 선택만 사용해야 한다(§11). 이 문서는 “완전한 개인 식별 불가”를 승인하지 않는다.
- 작은 집단의 내부 집계를 꼭 외부로 내보내야 한다는 요구가 생기면 별도 개인정보 검토 대상이다. 단순 k명 threshold만 추가해 기존 `taste_counts`를 되살리지 않는다.

## 6. 서버 추천·재료 검증·Gemini 경계

### 6.1 새 처리 순서

```text
앱: room_id + request_id + purpose만 제출
  → schedule-recommend: JWT 진위 → 필수 약관 → 유효 방/현재 멤버
  → 사용자 JWT RPC: 요청 티켓 발급, 방/지역 version 결합
  → 서버 전용 RPC: 티켓 소유·만료 검증, 필요한 공용 검색 조건만 조회
  → Edge: Tmap 후보 수집·정규화·중복 제거(클라이언트 후보 사용 금지)
  → Edge: 건강/개인 취향과 무관한 후보를 Gemini에 순위 요청
  → Edge: 구조화 응답·ID/순위/개수 검증
  → DB: 현재 방/약관/동의 재검사 → 내부 취향 점수·건강 제외
  → 최종 재검증된 결과만 요청자 앱에 응답
```

Gemini에 보내기 **전에** 건강 조건으로 후보를 줄이면 목록의 변화가 건강 조건을 간접 전송할 수 있다. 권장안은 건강과 개인 취향에 독립적인 동일 후보 집합을 먼저 순위화하고, 서버에서 최종 제외/재정렬하는 것이다. 건강 조건으로 바뀐 후보 수를 근거로 Gemini를 다시 호출하지 않는다. 건강정보 원문은 DB 밖으로 꺼낼 필요가 없도록 설계한다.

후보 수는 서버 상한 12개 제안. Gemini는 이 전체 집합에 대한 순위를 반환하게 하고 서버가 제외 후 최대 3개를 선택한다. 제외 결과 3개 미만이면 그대로 반환하며 조건 완화나 가짜 후보 생성으로 채우지 않는다. 비민감 취향 일치도를 우선, 같으면 Gemini 순위, 같으면 고정 ID로 정렬하는 결정적 정책을 제안한다. 공급자 오류이면 `source=rules` 규칙 순위 대체를 명시하고, 이를 AI 성공이라고 표시하지 않는다.

### 6.2 후보와 재료의 신뢰 근거

- 검색은 Tmap 서버 응답에서 stable provider ID, 이름/주소/공개 POI 좌표/분류만 정규화한다. 서버가 검증한 provider ID 목록 외에는 추천·확정할 수 없다. 임의 URL/클라이언트 재료 metadata를 조회하지 않는다.
- Tmap의 업종/category는 주재료 증거가 아니다. 현재 코드의 `PlaceCandidate`에는 재료 필드가 없으므로 현재 데이터만으로 건강 필터 완료를 만들 수 없다.
- 제안 데이터: `private.place_menu_evidence`에 provider_place_id, menu_id, ingredient_codes, allergen_codes, recipe/재료 범위 completeness, 교차접촉 확인 상태, 출처 ID/검토일/만료일, evidence_version. `private.health_rule_catalog`에 health code → 금지 재료/성분·필요 증거 항목의 결정적 매핑. 개인 건강 행과 합쳐 저장하지 않는다.
- 재료/알레르기 mapping은 운영자가 검토한 제공 데이터만 수용한다. Gemini가 지어낸 재료나 식당 분류로 보충하지 않는다. 데이터 제공자·갱신 방식이 확정되지 않으면 초기 운영은 일반 추천과 '성분 정보 확인 필요' 상태만 제공할 수 있다.
- 판정은 메뉴 단위다. 한 메뉴의 자료로 식당 전체가 안전하다고 표시하지 않는다. 적격 메뉴가 있으면 그 메뉴 ID/증거 version과 함께 식당을 추천한다. 실제 식당명·주소는 서버 후보에서 조립한다.

### 6.3 건강 제외와 완료 상태

각 현재 멤버의 건강값은 현재 필수 약관 및 건강 grant가 유효하고 저장된 consent_event와 일치할 때만 사용한다. 미입력/미동의는 '제한 없음이 확인됨'이 아니다. health 상태 조회 장애는 미동의로 간주하지 않고 처리를 멈춘다. 단, 명시적 미동의 사용자는 건강 처리 없이 일반 서비스를 이용할 수 있다.

내부 후보 판정:

| 상태 | 의미 / 처리 |
|---|---|
| `excluded` | 검증된 증거와 적용 중 조건이 충돌. 최종 추천에서 제거; 사유/개수/대상 멤버 외부 반환 없음 |
| `verified_for_recorded_rules` | 필요한 재료·알레르기·식단 증거와 규칙이 모두 있고 기록된 조건과 충돌 없음. 안전 보증 문구 금지 |
| `unverified` | 주재료/소스/첨가물/교차접촉 등 해당 규칙에 필요한 자료 누락, 만료, 비활성 코드 또는 매핑 불완전 |

제안 정책: 적용할 건강 제한이 있으면 `unverified` 후보는 자동 추천에서 제외한다. 모두 빠지면 일반적인 `NO_VERIFIED_OPTIONS`와 직접 검색 동선을 제공한다. 직접 검색 결과는 별도 '확인되지 않은 장소' 목록이며 건강 추천 카드로 합치지 않는다. 이 선택이 타인의 건강 존재를 추측하게 할 수 있으므로 메시지에는 사유·누구의 조건인지 넣지 않고 §5.3 잔여 위험 검토를 거친다.

응답의 `evidence_status=verified|unverified`는 해당 메뉴의 **공개 자료 완전성**으로 정한다. 타인의 동의 상태나 조건 개수에서 만들지 않는다. 요청자 본인의 `my_health_filter=not_requested|not_started|applied|incomplete`만 별도 반환할 수 있다. 전체 방의 “건강 필터 완료” badge는 제공하지 않는다. `applied`는 본인의 유효한 명시 조건과 필요한 증거가 모두 검사된 경우뿐이다. 원문이 없거나 주재료가 없으면 적용 완료가 아니다. 빈 조건을 명시 저장한 경우는 `not_requested`다.

건강정보가 한 번이라도 사용된 진행 중 요청은 동의 revision/가장 이른 valid_until을 내부에 결합한다. 최종 확정 transaction에서 건강 grant·profile·food revision, 방 멤버/만료·지역 revision을 다시 검사한다. 달라지면 `S5003`으로 결과를 폐기한다. 철회/수정 이후 이전 결과를 자동 재사용하지 않는다. 다른 멤버의 가장 이른 건강 만료 시각은 응답에 싣지 않는다. 공개 결과 기한은 고정 60초로 제안하고, 내부 유효기간이 그 60초를 보장하지 못하면 일반적인 context 변경 오류로 결과를 발급하지 않는다.

앱은 `valid_until`을 지나면 숨기고, 로그아웃·재동의·계정 변경·방 이탈·백그라운드에서 결과 캐시를 버린다. 결과 선택 직전 `validate_my_recommendation_v2`로 재검사한다. 네트워크 응답과 화면 그리기 사이 변경을 완전히 제거할 수는 없으므로 “이미 전달한 화면까지 소급 회수”를 보장하지 않는다. TTL만으로 즉시 철회 검사를 대체하지 않는다.

### 6.4 외부 전송 allowlist

| 수신자 | 허용 | 금지 |
|---|---|---|
| Tmap | 공용 검색 중심·정해진 반경·일반 음식 검색어 | 개인 출발지, ID, 개인 취향/건강 조건을 반영한 검색어 |
| 날씨 API | 공용 지역 대표 좌표와 필요한 날짜 | 개인 좌표, 사용자 식별자 |
| Gemini 식당 순위 | 요청 내 임시 후보 ID, 공개 분류 코드, 공용 지역 기준 거리 구간, 서버 고정 선택 수 | 건강값/유추 조건, 개인 취향 원문·집계/점수, 사용자/방 ID, 출발지, 좌표, 자유 입력 meetingName/이름/주소, 제외 사유 |
| Gemini 시간 순위 | 임시 슬롯 ID, 필요한 요일/시간·날씨. 참석률·인원 비교는 가능한 한 서버에서 처리 | 개인별 일정, 이름/ID, 상세 일정 제목 |
| 앱 | 검증된 식당·메뉴/슬롯, 일반 이유, 공개 검색 지역, 본인 필터 상태, 만료 | 건강·취향별 counts, 개인 좌표/이동시간, 다른 사람 동의·완료 상태 |

Gemini의 `reason` 자유문구는 사용하지 않고 허용된 `reason_code`를 받아 앱 문구로 조립하는 것을 제안한다. provider ID는 요청 안에서만 쓰는 `p1...p12`로 치환하고 결과를 서버에서 역매핑한다. 공급자의 JSON schema 기능을 쓰더라도 로컬 검증을 생략하지 않는다. 모델명/가용성은 이번 문서에서 검증하지 않았으며 기존 설정을 임의 변경하지 않는다.

현재 `schedule-recommend/index.ts`의 provider error body 전체 로깅도 고정 오류 코드·HTTP status·소요시간으로 바꿔야 한다. 요청/응답 body, 인증 헤더, 프로필 값, 장소 검색에 들어온 자유문구, provider raw response는 로깅하지 않는다. API 키는 기존 승인된 서버 secret 저장소만 사용하고 클라이언트로 옮기지 않는다.

## 7. RPC·Edge 계약

### 7.1 공통

신규 v2는 `contract_version:2`, snake_case JSON, UTC ISO timestamp, revision 10진 문자열을 사용한다. PostgreSQL 오류는 exception `{code,message,details,hint}`이고 성공 JSON에 섞지 않는다. 응답은 단일 object이며 `.maybeSingle()`을 붙이지 않는다. 본인 API는 target user ID 인자를 받지 않는다. unknown key/과대 body/잘못된 UUID/NaN/음수 revision을 거부한다.

기존 S1 consent API의 이름·contract_version은 그대로 1이다. v2 food/health 저장은 전체 replace이며 JSON body 상한 8KiB 제안. body에 user ID, consent_event_id, completed_at을 넣어 서버 결정을 덮어쓸 수 없다.

### 7.2 클라이언트 RPC 목록

| RPC / 입력 | 성공 응답 핵심 | 권한/추가 조건 |
|---|---|---|
| `get_food_profile_catalog_v2()` | `{contract_version:2,catalog_version,food_groups,health_groups}`; code/label/제약/지원 범위 | 인증+필수 약관. 건강 코드 목록은 개인 건강값이 아님 |
| `get_my_food_preferences_v2()` | `{contract_version:2,schema_version:2,preferences,revision,completed_at,onboarding:{seen_at,snoozed_until}}` | 본인, 필수 약관 |
| `save_my_food_preferences_v2(p_catalog_version text,p_preferences jsonb,p_expected_revision bigint)` | 위 GET 형태, revision 증가 | 완전한 네 그룹 또는 명시 초기화 `{}` |
| `mark_food_profile_prompt_v2(p_action text,p_expected_revision bigint)` | food GET 형태 | `shown` 또는 `later`; 서버 시각으로 seen/snooze 기록, food revision 증가, 취향값은 변경하지 않음 |
| `get_my_health_preferences_v2()` | `{contract_version:2,schema_version:2,status,allergy_code,diet_type_code,additional_avoid_codes,revision,consent_revision,valid_until,completed_at}` | 인증+필수 약관+유효 health. 미입력 status=`not_started`, revision=`"0"` |
| `save_my_health_preferences_v2(p_catalog_version text,p_allergy_code text,p_diet_type_code text,p_additional_avoid_codes text[],p_expected_revision bigint,p_consent_revision bigint)` | health GET 형태, status=`complete`, revision 증가 | null 알레르기/식단=명시 상관없음, 추가 배열 필수. S1 동의 변경 RPC를 내부에서 대신 호출하지 않음 |
| `get_room_recommendation_settings_v2(p_room_id uuid)` | `{contract_version:2,public_area_id,area,revision}`; 미설정 null | 유효 방 현재 멤버 |
| `set_room_recommendation_area_v2(p_room_id uuid,p_public_area_id text,p_expected_revision bigint)` | 위 GET 형태 | 유효 방 현재 멤버이면서 방장; catalog의 활성 area만 |
| `begin_room_recommendation_v2(p_room_id uuid,p_request_id uuid,p_purpose text)` | `{contract_version:2,request_id,status,valid_until}` | 현재 멤버+필수 약관. purpose=`places`, `slots`, `both`; Edge가 사용자 JWT로 호출하며 직접 호출도 같은 검사 |
| `validate_my_recommendation_v2(p_request_id uuid)` | `{contract_version:2,status:"valid",valid_until}` | 원래 요청자만. 현재 모든 관련 revision/동의/멤버십 재검사. 결과 본문 재반환 안 함 |

카탈로그 요청과 저장 사이 버전 변경은 `S5001`. GET 실패와 빈 결과를 구별한다. health 비활성은 `S1003`이며 빈 health 성공값을 대신 주지 않는다. 카탈로그/본인 profile provisioning 누락을 자동 seed하는 사용자 RPC를 만들지 않는다.

### 7.3 내부 처리 RPC와 요청 수명

`private.recommendation_requests`: UUID ticket, caller_id(FK cascade), room_id(FK cascade), purpose, request payload fingerprint, status, created_at, expires_at, room/area revisions, 처리에 사용한 version vector 및 임시 결과 참조를 보관한다. health 원문·개인 좌표·provider prompt 저장 금지. version vector는 private 영역만, 사용자 ID 목록/동의 시각은 외부 응답 금지. ticket은 발급 후 고정 5분 만료 제안이다. 완성 결과는 확정 시각부터 고정 60초 유효하며 방·관련 동의가 이 기간 동안 유효할 때만 발급한다. 동의 만료 자체를 공개 TTL로 반환하지 않는다. payload fingerprint는 비민감 입력(room_id/purpose/area revision)만 대상으로 한다.

- `public.claim_recommendation_work_v2(p_request_id uuid)`: **service_role 전용**. 사용자 JWT로 만들어진 유효 ticket만 한 worker가 원자적으로 claim. caller ID를 인자로 받아 대리 요청을 생성하지 않는다. 성공은 공용 area, purpose, 서버가 계산한 최소 슬롯 후보·참석 집계와 불투명 작업 version이다. 개인 일정·건강/출발지 원문을 반환하지 않는다. 기존 `loadRoomAvailability` 계산을 이 제한된 경계 안으로 옮기거나 동일 권한의 전용 helper로 구현한다.
- `public.finalize_recommendation_work_v2(p_request_id uuid,p_candidates jsonb,p_model_ranking jsonb,p_source text)`: **service_role 전용**. `p_candidates={places:[최대 12개]}`이며 슬롯은 claim 때 DB에서 확정한 후보를 ticket으로 다시 찾는다. `p_model_ranking={places:[...],slots:[...]}`의 ID·순위를 각 후보와 검사한다. DB의 evidence catalog를 조회하여 내부 취향·건강 규칙을 적용하고 최신 권한/version을 재검사한 뒤 완성된 응답을 반환한다. source는 `gemini` 또는 `rules`. arbitrary SQL/URL/health body는 허용하지 않는다.
- 후보 JSON을 받을 수 있는 주체는 신뢰 worker뿐이며 그 RPC를 authenticated에 열지 않는다. 서비스 역할 자체가 신뢰 경계이므로 사용자 JWT를 검증하지 않고 service RPC에 전달하는 Edge 분기·테스트 bypass를 금지한다.
- 같은 caller/request_id + 같은 payload 재요청은 진행 중이면 동일 상태, 완료면 재검증 후 같은 결과. payload가 다르면 `S1007`. 다른 caller의 ticket은 일반 `NOT_ALLOWED`. 만료/무효 결과를 새 ID로 복원하지 않는다.
- orphan/완료 ticket은 최대 24시간 내 정리, API 사용은 expires_at에서 즉시 차단. 정리 job 미가동이 유효기간 연장을 의미하지 않는다. 원문 없는 결과라도 개인 조건에 따른 결과이므로 장기 로그/analytics에 남기지 않는다.

DB 건강 처리에는 짧은 transaction만 사용한다. Gemini/Tmap 네트워크 대기 중 DB 잠금을 유지하지 않는다. 최종 처리에서는 room 직렬화 잠금 → room row → 현재 profile들을 UUID 정렬 잠금 → consent/food/health → ticket 순서를 제안한다. 이는 **S1 모든 관련 RPC/퇴장/철회 경로의 실제 잠금 순서와 대조하여 확정할 항목**이다. `set_optional_consent`가 profile 잠금 후 room을 기다리는 역순을 만들지 말고, 철회 무효화는 finalization의 version 재검사와 충돌하지 않는 구조로 구현한다. 교착/갱신 경쟁 테스트 전 승인 금지.

S1의 `private.s1_lock_profile`/`has_active_health_consent` 등 본인 JWT에 묶인 helper를 service worker에서 그대로 호출하면 타인 조건 판정이 성립하지 않는다. finalization은 ticket의 검증된 현재 멤버 목록을 내부에서 순회하는 전용 helper를 사용한다. 그 helper는 명시 profile ID·grant event·서버 시각을 검증하되 사용자 EXECUTE를 주지 않는다. JWT를 타인으로 바꾸거나 S1 본인 helper의 검사를 제거하여 해결하지 않는다. 신규 정책 version, food/health/evidence/rule version이 바뀌어도 기존 결과 validate는 실패해야 한다.

### 7.4 Edge `schedule-recommend` v2

요청 예시:

```json
{
  "contract_version": 2,
  "request_id": "11111111-1111-4111-8111-111111111111",
  "room_id": "22222222-2222-4222-8222-222222222222",
  "purpose": "places"
}
```

`meetingName`, `placeCandidates`, 사용자 ID 목록, 개인 좌표, 건강/취향 필드는 허용하지 않는다. 추천 지역은 방 설정에서 읽는다. request_id는 멱등성 식별자일 뿐 인증 수단이 아니다.

응답 스키마(자리표시 설명이며 실제 값으로 검증 fixture를 작성):

```text
{
  contract_version: 2, request_id: UUID, valid_until: ISO8601,
  source: "gemini" | "rules", area: { id, label, latitude, longitude } | null,
  places_status: "ready" | "empty" | "not_requested",
  slots_status: "ready" | "empty" | "not_requested",
  place_recommendations: [{ place_id, menu_id: string|null,
    place: { name, address, latitude, longitude }, rank,
    reason_code, evidence_status: "verified"|"unverified" }],
  slot_recommendations: [{ slot_id, date, start_time, end_time, rank, reason_code }],
  my_health_filter: "not_requested"|"not_started"|"applied"|"incomplete"
}
```

- 공개 식당 POI 좌표와 공용 지역 좌표는 반환 가능하나 개인 출발지/평균 이동시간은 반환하지 않는다. 식당 순위 score는 내부값이며 반환하지 않는다.
- `purpose=places`는 일정 제출이 없어도 실행한다. `slots`는 begin/claim/finalize 모두 지역·식당·food/health 처리를 건너뛰며 area=null, place_recommendations=[], my_health_filter=not_requested를 허용한다. `both`에서 시간 후보만 없으면 `slots_status=empty`로 식당 결과는 유지한다. 식당 후보만 없으면 반대도 동일하다. `places`/`both`에서 공용 지역 자체가 미설정이면 먼저 S5002로 지역 선택을 요구한다.
- 카탈로그/재료 누락과 공급자 장애를 구별한다. 빈 결과에는 일반적인 이유 코드만 붙인다. raw 공급자 응답·usage·admin 오류 내용은 클라이언트에 전달하지 않는다.
- DB 권한/동의 재검사 실패는 부분 성공을 반환하지 않는다. 주체/방이 바뀐 지연 응답은 앱의 요청 generation 비교로 폐기한다.

### 7.5 오류와 상태 매핑

| SQLSTATE / symbol | Edge HTTP | 의미 / 앱 처리 |
|---|---|---|
| `42501 AUTH_REQUIRED` | 401 | 검증된 세션 없음; 로그인 |
| `42501 NOT_ALLOWED`, `P0002 RESOURCE_NOT_FOUND` | 403 | 타인/탈퇴/만료/없는 방은 같은 외부 접근 불가로 처리 |
| `22023 INVALID_INPUT` | 400 | 타입·unknown key·선택 수·sentinel 혼합 오류 |
| `23503 PROFILE_NOT_READY` | 409 | provisioning 대기; 빈 완료 처리 금지 |
| `S1001 TERMS_REQUIRED` | 403 | S1 gate로 이동·관련 캐시 제거 |
| `S1002 DOCUMENT_CHANGED` | 409 | 새 동의 문서 확인 |
| `S1003 HEALTH_CONSENT_REQUIRED` | 403 | 본인 건강 API 차단. 일반 취향/기본 서비스는 유지 |
| `S1004 REVISION_CONFLICT` | 409 | 최신값 조회 후 재입력, 자동 덮어쓰기 금지 |
| `S1006 CONSENT_CONFIGURATION_UNAVAILABLE` | 503 | 동의/권한 확인 실패. 미동의 또는 성공으로 간주 금지 |
| `S1007 IDEMPOTENCY_CONFLICT` | 409 | 같은 request_id의 다른 payload |
| `S1008 CLIENT_UPDATE_REQUIRED` | 426 | v1 schema/body/지원 종료 버전 |
| `S5001 CATALOG_CHANGED` | 409 | catalog 새로 읽고 변경된 선택 확인 |
| `S5002 LOCATION_SELECTION_REQUIRED` | 409 | 공용 지역 선택 UI |
| `S5003 RECOMMENDATION_CONTEXT_CHANGED` | 409 | 멤버/동의/프로필/지역/기한 변경, 이전 결과 폐기 |
| `S5004 RECOMMENDATION_EXPIRED` | 410 | ticket 만료, 권한 확인 후 새 요청 |
| `S5005 RECOMMENDATION_RATE_LIMITED` | 429 | 서버 예산 제한, Retry-After; 무한 재시도 금지 |
| `S5006 CANDIDATE_SOURCE_UNAVAILABLE` | 503 | 장소 제공자 실패. 직접 검색/재시도 안내 |
| `MODEL_UNAVAILABLE`, `MODEL_INVALID_RESPONSE` | 502/503 | Edge 전용 symbol. 검증된 규칙 대체 또는 명확한 오류 |

`NO_PLACES`, `NO_VERIFIED_OPTIONS`, `NO_AVAILABILITY`는 존재하는 정상 요청의 빈 결과 reason code이며 SQL 권한 오류와 섞지 않는다. 다른 멤버의 health 동의 오류를 그대로 호출자에게 전달하여 건강 상태를 밝히지 않는다. 새 SQLSTATE 충돌 여부는 구현 시작 시 전체 migration 검색으로 확인한다.

## 8. 마이그레이션과 보안 경계

### 8.1 마이그레이션 단위

실제 timestamp는 S1 확정 후 할당한다. 아래 이름은 작업 단위이며 이미 존재하는 SQL 파일이 아니다.

| 단위 | 내용 | 종료 조건 |
|---|---|---|
| F0 S1 정합성 선행 | 레거시 미이전 결정, release gate/지원 버전 정책 정합. 미적용 S1의 수정은 S1 담당자가 별도 처리 | 현재 S1 문서/SQL/앱 adapter 사이 충돌 목록 해소 |
| F1 `food_profile_v2_catalog_storage` | food/health 추가 열·카탈로그·버전별 제약, seed 분리. 준비 중에는 schema 1/2를 구별하여 허용하고 v1 값/기본값 유지 | fresh/기존 데이터 fixture 적용, 잘못된 JSON/코드 거부; 아직 v2 입력 활성화 안 함 |
| F2 `food_profile_v2_rpcs` | 본인 GET/SAVE/안내 RPC, 동의 trigger/파기 확장, RLS/grant. v2 기능은 서버 capability가 false면 차단 | 본인/타인/anon/service 직접쓰기 및 동시성 테스트 |
| F3 `recommendation_public_area` | 공용 지역 catalog, 방 지역 설정, 현재 멤버/방장 RPC | 2인/1인도 개인 좌표 접근 없이 설정·추천 준비 가능 |
| F4 `recommendation_worker_boundary` | private ticket/evidence/rule 저장소, begin/claim/finalize/validate, 정리 함수 | service 전용 권한·철회/퇴장 경쟁·provider payload 테스트 |
| F4a `food_profile_v2_activation` | 지원 앱 준비 후 v1 food 초기화·v2 기본값/제약 전환·구 RPC S1008·서버 capability 활성화를 한 transaction으로 실행 | legacy 건강 행 검사 통과, 동시 구버전 쓰기 차단, 전환 중 혼합 schema 노출 없음 |
| F5 선택 `private_origin_midpoint` | §5.2 자동 계산/예산/epoch; 기본 비활성 | 별도 사용자 결정·독립 검토·공격 테스트 후에만 반영 |

F4a 활성화 전환은 schema=1 행을 빈 schema=2로 바꾸고 완료 시각을 null로 둔다. 6 boolean의 true/false를 cuisine/ingredient로 추론하지 않는다. 새 가입 기본값도 schema=2/미입력으로 바꾼다. 로컬 S1 M3가 이미 복사한 데이터도 같은 전환으로 제거한다. 운영 적용은 파괴적 전환 항목을 명시해 별도 승인을 받는다. 테스트용으로 처음부터 v2를 활성화하는 fixture와, F1/F2 준비 상태에서 기존 S1 클라이언트가 계속 동작하는 upgrade fixture를 모두 둔다.

S1 health는 운영 카탈로그가 비어 있는 전제지만 실제 운영 행이 없다고 단정하지 않는다. 적용 전 값 없이 행 수/schema/category cardinality만 점검한다. v1 건강 행이 있으면 자동 단일 선택 변환을 금지하고 **전환 차단**한다. 데이터 보존·재입력·삭제 방식의 명시 승인을 받은 별도 migration으로 처리한다. 두 알레르기 중 첫 번째만 남기는 전환은 금지다.

이미 적용된 S1 migration의 해시/내용을 소급 수정하지 않는다. 카탈로그/증거 seed는 코드 스키마와 분리하여 승인한 목록·version·hash를 기록한다. rollback은 신기능 차단과 이전 안전 경계 유지이며 삭제한 취향·건강값 또는 `meeting_midpoint` 권한을 복원하지 않는다.

### 8.2 RLS / grants

| 객체 | 사용자 접근 | service 역할 |
|---|---|---|
| food row | SELECT: `profile_id=auth.uid()` AND 필수 약관. 직접 쓰기 없음, 본인 RPC만 | 직접 읽기/쓰기 불필요, 회수 |
| health row | SELECT: 본인 AND 필수 약관 AND 현재 유효 grant/event. 직접 쓰기 없음 | 직접 읽기/쓰기 회수. 제한된 finalization 함수 내부에서만 처리 |
| food/health/area catalog | authenticated SELECT: 활성 공개 항목 AND 필수 약관 | 운영 관리 절차 외 직접쓰기 회수 |
| room recommendation settings | SELECT: 유효 방 현재 participant AND 필수 약관 | 작업 RPC 내부 최소 열만 |
| private ticket/evidence/health rules | RLS ENABLE, PUBLIC/anon/authenticated policy·grant 없음, private schema 미공개 | 테이블 raw grant 대신 정해진 RPC EXECUTE만 |

각 public 신규 테이블에 restrictive 필수 약관 policy를 추가한다. authenticated 정책 선언만으로 타인 접근을 허용하지 않는다. table-level SELECT/UPDATE와 column-level grant를 둘 다 조사하고 먼저 회수한 뒤 필요한 권한만 부여한다. 뷰, Realtime publication, SQL 함수 wrapper, 구 RPC도 우회 경로로 테스트한다. food/health/ticket을 Realtime 공개 payload에 추가하지 않는다.

### 8.3 함수 규칙

- 가능하면 invoker를 사용한다. 테이블 직접쓰기 차단 아래의 제한된 본인 mutation 또는 private server projection에만 SD를 사용하고 함수별 이유를 주석으로 기록한다.
- SD는 `SET search_path=''`, `SET timezone='UTC'`, fully qualified 객체명, 고정 SQL. 사용자 SQL/열 이름/URL 인자 없음. auth.uid null·본인·현재 membership·방 유효성을 함수 안에서 확인한다.
- 모든 함수는 정확한 signature로 PUBLIC/anon/authenticated/service_role EXECUTE를 먼저 회수한다. 본인/방 client RPC는 authenticated만, worker RPC는 service_role만, helper/trigger는 필요한 내부 실행만 부여한다. default privileges에 의존하지 않는다.
- service_role 전용 함수는 `auth.uid()`가 없다는 것을 일반 사용자 허용으로 해석하지 않는다. 역할 확인과 유효한 user-created ticket을 함께 요구한다. 클라이언트 `caller_id`를 신뢰하지 않는다.
- owner 권한/상속 역할/함수 overload 전체를 독립 검토한다. permission denied를 없애려고 RLS를 완화하거나 구 midpoint 실행을 grant하는 수정은 거절한다.
- API 응답·예외 details·NOTICE·감사 로그에 건강값/출발지/타인 동의 metadata를 넣지 않는다. new table FK의 profile/room 삭제는 cascade로 S2 인계하고 개인 이름/이메일 사본을 만들지 않는다.

## 9. 구현 작업 분할과 파일 소유권

아래는 **후속 구현 배정안**이다. 이번 문서 작업에서는 작업자를 생성하거나 코드 변경을 수행하지 않았다. DB와 앱 각각 한 명의 작성자를 두고 최대 두 구현 작업자가 병행한다. 보안·건강 데이터 경계는 주 구현 자격의 작업자에게 맡긴다.

| 작업자 | 단독 소유 파일/범위 | 책임 |
|---|---|---|
| DB 작업자(서버 담당) | 신규 `supabase/migrations/*s5*`, `supabase/functions/schedule-recommend/**`, 신규 `supabase/functions/_shared/*s5*`, `supabase/tests/s5*`, 필요한 `supabase/release/*` | 카탈로그/저장 RPC, Edge 후보 수집·최종 검증, RLS/grant, server unit/SQL/HTTP fixtures, 로컬 upgrade |
| 앱 작업자 | `src/foodProfile/**` 신규, `src/screens/foodProfile/**` 신규, `src/lib/foodProfile.ts`·`src/lib/recommendation.ts` 신규, `src/lib/profile.ts`·`placeCandidates.ts`·`meetingPoint.ts`·`tasteKeywords.ts`·`format.ts`, `src/profile/useMyProfile.ts` | 타입·strict parser·본인 저장, 공용 지역 선택/추천 client, 기존 어댑터 제거 |
| 앱 작업자(동일 작성자) | `src/auth/SignupDraftProvider.tsx`, `pendingSignupProfile.ts`, `completePendingProfile.ts`, `AuthProvider.tsx`, `src/navigation/**`, `src/screens/signup/**`, `src/screens/taste/**`, `src/screens/profile/ProfileHomeScreen.tsx`, `src/screens/schedule/**`, `src/screens/chat/ChatRoomScreen.tsx`·`ChatRoomSheets.tsx`, `App.tsx`, 관련 `tests/**`, `scripts/ui-preview/s5*` | 가입/기존 사용자/프로필/일정·채팅 두 추천 경로, 캐시 무효화, 렌더·회귀 |
| 메인 / S1 담당자 | S1 기존 migration·문서·consent 모듈의 변경 조율, `package.json`·공용 설정 충돌 조정 | S1 정합성 선행 결정, 필요한 파일의 작성자를 한 명으로 지정 |
| 독립 검토자 | 수정 금지; 위 diff와 SQL/HTTP/앱/렌더 결과 | 위치·건강·권한 경계와 rollout 순서 검토 |

공유 계약은 본 문서의 RPC 이름/정확한 파라미터/JSON example/error 목록으로 고정하고 DB 작업자가 synthetic fixtures를 앱 작업자에게 제공한다. source와 seed 외 비밀정보는 전달하지 않는다. S1 미커밋 파일을 덮어쓰거나 원복하지 말고 최신 diff를 먼저 확인한다. 동일 파일 변경이 필요하면 기존 소유자에게 인계하고 병렬 편집하지 않는다.

## 10. 검증과 단계별 완료 기준

### 10.1 다중 사용자·공격 테스트

모든 fixture는 가상 사용자 A/B(같은 방), C(외부), D(초대만), E(탈퇴), F(방장이나 participant 없음), anon, service worker를 포함한다. 원격 계정/개인정보를 테스트에 복사하지 않는다.

| 분야 | 필수 사례와 기대 결과 |
|---|---|
| 본인 격리 | A food/health를 B/C/같은 방장/친구/anon이 GET·직접 SELECT·뷰·RPC 우회로 읽지 못함. service raw table 접근도 거부 |
| 필수 약관 | pending/오류/버전 변경에서 food/health/방설정/begin/Edge 차단. 철회 제어는 S1 예외대로 동작 |
| 건강 상태 | not_asked/declined/withdrawn/expired 읽기·저장 거절. 정확한 valid_until 경계·잠금 대기 후 만료·만료 배치 중 재동의 |
| revision/원자성 | 두 기기 동시 food 저장, health 저장 vs 철회, grant 재결합 vs 만료 배치. 한 요청 성공·다른 conflict, 삭제한 payload 복구 없음 |
| 선택/카탈로그 | unknown/disabled/다른 category, null 원소, 중복, 다차원 배열, 과대 배열·body, 부분 JSON, any 혼합, spice 다중 입력 거절 |
| 빈 상태 | 미입력과 명시 any 완료 구별; health 무조건 빈 배열 성공 처리 금지; STEP 2 거절 후 STEP 1 유지 |
| 레거시 upgrade | 6 boolean 유무와 true/false 조합 모두 v2 미입력. 건강 legacy 다중값 발견 시 migration 차단. old pending signup이 tastes를 복구하지 않음 |
| 방 격리 | C/D/E/F/만료/없는 방/위조 room_id 동일 접근 거부. 현재 멤버인 방장만 지역 변경 |
| 2인 위치 | 타인 출발지를 바꾸어도 공용 지역 후보는 동일. profile_private 위치 읽기 0회, midpoint RPC 호출 0회. 좌표·거리·contributor_count 응답 없음 |
| 조건부 자동 위치 | 두 기여자·privacy OFF·없는 좌표는 fallback. 자기 좌표 반복 변경/subset/여러 방/탈퇴 재가입·공모 시도, 캐시와 quota 우회 테스트. 보안 미달이면 기능 비활성 유지 |
| 취향 집계 | raw counts·사용자별 score·health key가 응답/prompt/log에 없음. 본인 값을 빼는 공격과 결과 차분의 잔여 위험을 검토 결과에 명시 |
| worker 경계 | authenticated의 claim/finalize 거절; 위조 ticket·다른 caller·expired·재사용 payload 차이 거절; UUID guess로 결과 접근 불가 |
| 진행 중 철회 | provider를 지연시킨 동안 B 동의 철회/만료·방 이탈·food 수정·origin OFF/지역 변경 → 이전 결과 finalize/validate 실패; UI에 늦은 결과 재등장 없음 |
| 건강 제외 | known 충돌 제거, 미확인 재료/규칙/교차접촉/증거 만료에서 완료 표시 없음. 빈 자료를 안전으로 해석하지 않음 |
| 외부 데이터 최소화 | 같은 공용 후보에 건강값만 바꿔도 Gemini/Tmap request body 동일. 건강으로 provider 재호출/선택 개수 변경 없음. 응답/오류 로그 secret·건강 원문 없음 |
| 모델 오류 | 잘못된 JSON, 없는/중복 ID, 순위 누락/초과, 악성 문자열, timeout/429/5xx에서 검증되지 않은 결과 반환 없음 |
| 추천 회귀 | places는 일정 없이 성공, slots는 식당 없이 성공, both 부분 empty 처리. 채팅·일정 경로 모두 새 계약 사용 |
| 수명/삭제 | 유효기간·계정 변경·방 삭제·profile 삭제·retention 정리, RLS와 table/column/function grant catalog 전체 검사 |

### 10.2 앱·렌더·전체 체인

- 음식 입력, 저장·취소·재진입, '상관없음' 배타, 단일/복수 선택, 뒤로가기, 프로필 완료 후 수정, 기존 사용자 다음 실행 안내·snooze를 검증한다.
- 가입 건강 체크 on/off, 이메일 확인 대기, 다른 계정 로그인, 문서 변경, 네트워크 재시도, STEP 2 동의 거절/철회/만료 시 건강 원문이 기기에 남지 않는지 확인한다.
- Figma 각 화면의 node ID·좌표 대응표와 실제 렌더 스크린샷을 함께 비교한다. 실제 폰트·작은 화면·큰 글꼴·스크린리더·터치 영역을 확인한다. fixture 스크린샷만으로 실기기 성공을 주장하지 않는다.
- AI 체인은 **Auth → Edge 호출 → Tmap 후보 → provider HTTP 응답 → 구조화 parsing → 서버 후보/건강/권한 최종 검증 → 앱 rendering**을 각각 증거로 남긴다. rules fallback과 Gemini 성공을 구분한다.
- 관련 기존 tests(`tasteKeywords`, `pendingSignupProfile`, `profileD`, `chatE`, 일정/route/auth/consent)를 새 계약에 맞춰 갱신하고, S1 gate·삭제·동의 회귀를 유지한다. 모의 RPC 성공만으로 실제 RLS 통과를 판단하지 않는다.

### 10.3 진행 순서와 완료 판정

| 단계 | 완료 기준 / 다음 단계 조건 |
|---|---|
| 0 계약 확정 | S1 충돌 해소, Phone 노드·카탈로그 인계, §11의 출시 차단 질문 결정. 미결 항목은 feature flag로 닫힘 |
| 1 로컬 DB | fresh + legacy upgrade + RLS/grants + 동의/저장 동시성 테스트 통과. 원격 SQL 미실행 |
| 2 앱 음식 프로필 | 두 STEP/가입·기존 사용자·편집 흐름과 폐기/재시도 테스트, 노드-렌더 검증 통과 |
| 3 추천 복구 | 공용 지역 기반 일정/채팅 추천, 서버 후보·provider 최소화·건강 불완전 표시·수동 fallback 통과. 정밀 midpoint 실행은 계속 차단 |
| 4 통합 품질 | 비밀정보/원격 없이 로컬 격리환경 focused tests 및 비례적인 `npm run quality` 통과. 실행이 원격/env에 의존하면 메인에게 전제 보고 후 격리환경에서 수행 |
| 5 독립 검토 | DB/Edge/앱 diff와 실제 테스트 결과를 검토자에게 제공. 보안·건강·위치·원격 전환 경계 지적 해결 후 메인 최종 승인 |
| 6 운영 반영 | 아래 개별 외부 변경 승인 후에만 실행. 반영 식별자와 다중 사용자/E2E/advisor 재검증까지 끝나야 운영 완료 |

권장 rollout: F1~F4 DB 확장을 비활성 상태로 준비 → 새 Edge contract 준비 → 앱 capability 확인/새 화면 배포 → F4a 활성화 및 구버전 차단. 공개 capability는 비민감한 지원 contract 목록/활성 여부만 반환하며 제품 데이터 접근 gate를 우회하지 않는다. food v1 데이터 제거와 구 API 차단은 유지보수/지원 버전 전환 계획과 함께 실행한다. DB만 먼저 바뀌어 기존 가입 자동 `saveTastes`가 깨지는 공백을 허용하지 않는다. 복구 실패 시 안전한 수동 장소 선택으로 전환하며 권한을 되돌리지 않는다.

### 10.4 운영 반영의 개별 승인 항목

1. **DB migration별 적용**: F1~F4 및 F4a 활성화의 파일명·hash·대상 프로젝트·변환/삭제 내용. S1 레거시 복사 변경과 v1 데이터 초기화도 별도 명시한다.
2. **카탈로그/재료 evidence seed 또는 운영 데이터 write**: 목록·version·출처·건수·삭제 영향. 제품의 미이전 결정은 임의 운영 삭제 실행 권한이 아니다.
3. **`schedule-recommend` Edge 배포**: 코드/contract 식별자·지원 앱 버전·fallback·rollback 계획.
4. **secret/Auth/API 권한·설정 변경**: 필요할 때만 정확한 항목별 승인. secret 값은 승인 문서/로그/프롬프트에 쓰지 않는다.
5. **ticket 정리 등 cron/scheduler 등록**: 주기·실행 주체·예산·실패 경보. S1 건강 파기 job도 별도 운영 승인 없이는 등록하지 않는다.
6. **새 앱 공개 배포·feature flag 활성화·구버전 종료**: food v2, health filter, 추천 v2를 구분. 자동 중간 지점 F5는 추가 승인 및 독립 검토가 필요하다.
7. **운영 테스트 데이터 생성/삭제·provider 호출 비용**: synthetic 계정과 대상 범위를 승인받고 테스트 흔적 정리까지 포함한다.

적용 후 migration/function identity·hash/권한, 두 사용자 이상 격리, 두 추천 진입점 E2E, 건강 철회/만료 재검사, 보안 advisors 재실행 결과를 기록한다. 배포 로그 또는 provider 200 하나만으로 서비스 성공을 주장하지 않는다. 커밋·푸시·PR·Figma 변경은 각각 사용자가 요청하기 전에는 수행하지 않는다.

## 11. 사용자 결정이 필요한 열린 질문

확정된 미이전·선택 동의·건강 원문 미전송 결정은 다시 묻지 않는다. 아래는 그 결정을 실제 동작으로 구체화해야 하는 부분이다.

| 질문 | 권장안 / 영향 | 결정 시점 |
|---|---|---|
| 자동 중간 지점 없이 공용 만남 지역 선택으로 우선 복구할 것인가? | **권장: 먼저 복구.** 2인 방은 계속 공용 지역. 비공개 출발지 자동 계산은 별도 승인 단계로 유지 | 추천 구현 시작 전 |
| 추천 결과를 통한 취향/건강 추측 위험까지 금지해야 하는가? | 권장: 개인별/집계 공개 금지와 제한을 명시하고 독립 검토. 강한 비추론이 필요하면 **방 공개 메뉴 선호 + 본인만 건강 필터**로 범위를 줄이며 공동 건강 제외 결과 공유는 하지 않음 | 공동 개인화 활성화 전, 출시 차단 |
| STEP 1의 실제 선택 옵션/복수 상한/매운맛 단계는 무엇인가? | Phone 노드에서 확정한 코드표를 기준으로 하고 문서 예시를 운영 seed로 쓰지 않음. 메인이 노드 명세 제공 | catalog seed/화면 구현 전 |
| 단일 알레르기 선택이 여러 알레르기 사용자를 충분히 표현하는가? | 권장: 다중 알레르기를 담을 수 있는 UX로 시안 조정. 유지한다면 미지원 범위를 명시하고 전체 알레르기 필터 완료 문구 금지. 확정 전에는 전달받은 단일 선택 계약으로만 설계 | 건강 UI 공개 전 |
| 재료 증거는 어디에서 얻고 누가 검토·갱신하는가? | 권장: 검증된 메뉴/성분 공급원과 version/유효기간을 정함. 없으면 일반 추천만 출시하고 건강 필터 완료는 비활성 | 건강 필터 활성화 전, 출시 차단 |
| 증거가 부족한 식당은 어떻게 보여 줄 것인가? | 권장: 건강 조건 적용 시 자동 추천에서 제외, 직접 검색에서 '성분 확인 필요'로 분리. 편의 때문에 category로 안전을 추정하지 않음 | 건강 추천 구현 전 |
| 음식 입력은 가입 필수인가, 기존 사용자 재안내 주기는? | 권장: 선택, 다음 실행 안내 1회 + '나중에' 7일 snooze, 프로필 진입 상시 제공. STEP 2 거절로 가입 막지 않음 | 앱 흐름 구현 전 |
| 공용 지역 변경 권한과 검색 반경은? | 권장: 현재 멤버인 방장이 변경, 모든 멤버가 확인. 지역별 검토 반경을 catalog에서 고정하며 일반 초기 제안은 2km | 지역 catalog 확정 전 |
| v1 건강 데이터가 실제로 남아 있거나 구버전 앱이 많으면? | 권장: 값 없는 inventory부터 확인. 건강 데이터 자동 축약 금지, 전환 시점·재입력/보존/삭제·지원 앱 버전을 별도 결정 | 원격 migration 승인 전 |
| Gemini 장애 시 규칙 기반 추천을 허용할 것인가? | 권장: 서버 검증·건강 제외를 동일 적용하고 `source=rules` 표시. AI 성공률과 분리 집계 | Edge/앱 계약 확정 전 |

## 12. 이 문서 작업의 검증 기록

- 로컬 Git branch/HEAD/status, S1 문서와 20261017 migration, midpoint 권한 회수 SQL, 음식/가입/추천 사용처, WORKFLOW/Figma 문서를 읽어 근거를 대조했다.
- 문서의 UTF-8·줄 끝 공백·JSON 예시 파싱·코드 블록/표 열 구조를 검사했다. Git status 대조에서 이번 추가 파일은 이 문서이며 기존 S1 변경은 유지했다. `git diff --check`는 기존 tracked 변경에서 공백 오류 없이 통과했으며, 신규 untracked 문서는 별도 구조 검사로 확인했다.
- 원격 Supabase/Figma, `.env`, 운영 사용자 데이터는 접근하지 않았다. Figma 도구가 없어 화면 상세는 인계 요청으로 남겼다.
- 이번 산출물은 신규 문서 한 개다. 코드/SQL/앱 변경이나 기능 테스트·`npm run quality`, 실기기 검증은 수행하지 않았다. 테스트 목록은 후속 구현의 완료 조건이다.
- 위치 보호·건강 처리·권한 설계는 독립 보안 검토 **전** 제안이다. 이 문서 작성만으로 보안 또는 운영 출시를 승인하지 않는다.
