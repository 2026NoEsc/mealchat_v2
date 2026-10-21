# S5 일부: 음식 프로필 저장과 공용 지역 식당 추천 계약

확정 기준: 2026-10-18, Develop S1 `17ad858` 이후(현재 문서 커밋 `a20ce8d`). 사용자 결정과 추가 답변을 반영한 DB·Edge/앱 공유 계약이다. 운영 반영·배포·커밋 승인이 아니다. `docs/S5-figma-spec.md`의 실제 노드/라벨을 따른다.

## 1. 0단계 확정 결정

1. 초기 식당 추천은 현재 participant인 방장이 catalog에서 명시적으로 고른 공용 만남 지역 주변이다. 개인 출발지·정밀 `meeting_midpoint`·자동 평균/이동시간은 읽거나 재개방하지 않는다. 자동 중간 지점은 별도 승인 단계다.
2. 공동 추천에는 현재 방 멤버의 **STEP 1 비민감 취향만 DB 내부에서 집계**한다. 미입력/schema v1 멤버는 제외하고 아무도 없으면 일반 추천이다. 앱에는 최종 결과만 반환한다. 인원수·개인별 값·집계치·점수는 반환하지 않는다. Gemini에는 식별자·인원수 없는 상위 코드 키워드만 보낸다.
3. 방장의 공용 음식 종류 선택은 선택 기능이며 개인 취향 집계보다 우선한다. 빈 배열은 집계/일반 추천으로 돌아감을 뜻한다.
4. 2인 방에서는 최종 순위나 상위 키워드로 상대 STEP 1 취향을 추정할 수 있는 잔여 위험을 **비민감 취향에 한해 사용자 수용**했다. 집계를 익명화했다고 주장하지 않는다. 키워드는 worker→Gemini 전용이며 앱 RPC에는 반환하지 않는다.
5. STEP 2는 본인 저장/조회만 한다. **공동 추천에서 본인 것을 포함한 건강 행·건강 동의 상태를 조회하거나 제외에 사용하지 않는다.** 향후 건강 필터는 본인에게만 적용하며 별도 재료 공급원 검토/승인 후 구현한다.
6. 검증된 메뉴/재료 공급원 전까지 일반 추천만 한다. `evidence_status=unverified`, `my_health_filter=not_requested` 고정. '알레르기 고려', 건강 적용/완료 badge·안전 보증은 금지한다.
7. 음식 프로필 전체는 선택 입력이며 STEP 2 거절/건너뛰기로 가입·일반 추천을 막지 않는다. 알레르기는 Figma대로 **복수 선택**이다. 건강 동의는 S1 API로 명시하고 거절·철회·1년 만료 시 행 전체 파기를 유지한다.
8. Gemini 실패/timeout/429/잘못된 JSON/후보 밖 ID는 검증된 서버 후보의 규칙 순위로 대체하고 `source=rules`로 구분한다. Tmap 자체 실패·권한 재검사 실패는 성공으로 위장하지 않는다.
9. 레거시 tastes/6 boolean은 schema v2로 이전하지 않는다. 기존 v1 행은 v2 GET에서 미입력으로 보며, 사용자가 새 값을 명시 저장할 때만 v2로 바뀐다. 기존 S1 신규 저장 경로는 v1 행에서 공존하고 v2 행 덮어쓰기는 S1008로 차단한다.

### 1.1 이번 범위와 제외

범위: catalog 67항목 확정, food/health v2 저장/조회/안내, 공용 지역/방장 선택, user ticket→service worker→최종 재검증, Tmap 서버 후보·Gemini 최소화·rules fallback, 로컬 SQL/Edge 검증.

제외: 앱/가입/Auth 파일 수정, 일정 슬롯 추천 v2(`slots`/`both`), 자동 중간 지점, 건강 추천 필터·재료 evidence 수집/크롤링, 자유 텍스트 기타 입력, 글로벌 v1 종료/파괴적 활성화, 원격·cron·secret·배포·커밋. 기존 시간 추천 코드는 유지하되 새 v2 계약의 purpose는 `places`만 허용한다. v1 추천 body로 식당 후보를 보내는 경로는 새 추천에서 쓰지 않는다.

## 2. 카탈로그와 선택 코드 확정

`catalog_version=s5-food-2026-10-18-v1`. code는 아래 Figma 초안의 ASCII 코드를 그대로 확정하고 label을 보존한다. schema는 v2이고 개인 건강 의미/재료 제외 규칙을 이 코드만으로 확정하지 않는다.

- `cuisine`→`cuisines`: 1..8개, `any`는 배타 sentinel.
- `preferred_ingredient`→`ingredients`: 0..12개, 빈 배열은 제한 없는 선호. `any` 코드를 만들지 않는다.
- `food_form`→`forms`: 0..9개, 빈 배열은 제한 없음. `noodles`, `stew_hotpot` 등 아래 코드를 사용한다.
- `spice`: 아래 5단계 중 하나 또는 명시적 null(선호 없음). `very_hot`을 `any`로 해석하지 않는다.
- 건강: `allergy_codes` 0..15개 복수, `avoided_food_codes` 0..8개 복수, `diet_type_code` 단일/null, `additional_avoid_codes` 0..1개. 모든 배열은 중복·null 원소·다차원 금지다.
- `none`은 건강 UI 제어 코드다. API에는 allergies/avoided 빈 배열, diet null로 정규화하고 sentinel 자체를 저장하지 않는다.
- `other_input` 3항목은 catalog에 **enabled=false/support=unavailable**로 수록한다. 입력 UI/자유문자 저장은 이번 범위가 아니다.
- '못 먹는 음식'도 건강 동의에 묶인 STEP 2 저장소로 분류한다. 일반 선호로 유추해 STEP 1이나 provider body에 섞지 않는다.
- 전체 `{}`는 food 미입력/명시 초기화다. 저장된 완전한 네 필드는 사용자가 명시 확인한 선호이며 null/빈 배열도 중립 선택으로 저장된다. 자동 기본값 저장 금지.

### 2.1 확정 코드표 (Figma §5, 67항목)

| 범주 (확정 group_code) | 라벨 원문 | 확정 코드 |
|---|---|---|
| 음식 종류 (`cuisine`) | 한식 | `korean` |
| 음식 종류 (`cuisine`) | 일식 | `japanese` |
| 음식 종류 (`cuisine`) | 중식 | `chinese` |
| 음식 종류 (`cuisine`) | 양식 | `western` |
| 음식 종류 (`cuisine`) | 동남아 | `southeast_asian` |
| 음식 종류 (`cuisine`) | 기타 세계음식 | `other_world` |
| 음식 종류 (`cuisine`) | 분식 | `snack_food` |
| 음식 종류 (`cuisine`) | 상관없음 | `any` |
| 주재료 · 육류 (`preferred_ingredient`) | 소고기 | `beef` |
| 주재료 · 육류 (`preferred_ingredient`) | 돼지고기 | `pork` |
| 주재료 · 육류 (`preferred_ingredient`) | 닭고기 | `chicken` |
| 주재료 · 육류 (`preferred_ingredient`) | 양고기 | `lamb` |
| 주재료 · 해산물 (`preferred_ingredient`) | 생선 | `fish` |
| 주재료 · 해산물 (`preferred_ingredient`) | 새우·게 등 갑각류 | `crustaceans` |
| 주재료 · 해산물 (`preferred_ingredient`) | 조개류 | `shellfish` |
| 주재료 · 해산물 (`preferred_ingredient`) | 오징어·문어 | `squid_octopus` |
| 주재료 · 기타 (`preferred_ingredient`) | 계란 | `egg` |
| 주재료 · 기타 (`preferred_ingredient`) | 두부·콩 | `tofu_soy` |
| 주재료 · 기타 (`preferred_ingredient`) | 채소 | `vegetables` |
| 주재료 · 기타 (`preferred_ingredient`) | 치즈·유제품 | `cheese_dairy` |
| 음식 형태 (`food_form`) | 밥 | `rice` |
| 음식 형태 (`food_form`) | 면 | `noodles` |
| 음식 형태 (`food_form`) | 국물·탕 | `soup` |
| 음식 형태 (`food_form`) | 찌개·전골 | `stew_hotpot` |
| 음식 형태 (`food_form`) | 구이 | `grilled` |
| 음식 형태 (`food_form`) | 튀김 | `fried` |
| 음식 형태 (`food_form`) | 볶음 | `stir_fried` |
| 음식 형태 (`food_form`) | 찜 | `steamed` |
| 음식 형태 (`food_form`) | 샐러드·가벼운 식사 | `salad_light_meal` |
| 매운맛 (`spice`) | 전혀 못 먹음 | `not_spicy` |
| 매운맛 (`spice`) | 조금 매운 정도 | `mild` |
| 매운맛 (`spice`) | 보통 | `medium` |
| 매운맛 (`spice`) | 매운 음식 좋아함 | `hot` |
| 매운맛 (`spice`) | 아주 매운 음식도 좋아함 | `very_hot` |
| 알레르기 (`allergy`) | 계란 | `egg` |
| 알레르기 (`allergy`) | 우유·유제품 | `milk_dairy` |
| 알레르기 (`allergy`) | 땅콩 | `peanut` |
| 알레르기 (`allergy`) | 견과류 | `tree_nuts` |
| 알레르기 (`allergy`) | 밀 | `wheat` |
| 알레르기 (`allergy`) | 메밀 | `buckwheat` |
| 알레르기 (`allergy`) | 대두·콩 | `soy` |
| 알레르기 (`allergy`) | 생선 | `fish` |
| 알레르기 (`allergy`) | 새우 | `shrimp` |
| 알레르기 (`allergy`) | 게 | `crab` |
| 알레르기 (`allergy`) | 조개류 | `shellfish` |
| 알레르기 (`allergy`) | 오징어 | `squid` |
| 알레르기 (`allergy`) | 소고기 | `beef` |
| 알레르기 (`allergy`) | 돼지고기 | `pork` |
| 알레르기 (`allergy`) | 닭고기 | `chicken` |
| 알레르기 (`allergy`) | 기타 직접 입력 | `other_input` |
| 알레르기 (`allergy`) | 알레르기 없음 | `none` |
| 못 먹는 음식 (`avoided_food`) | 회·날생선 | `raw_fish` |
| 못 먹는 음식 (`avoided_food`) | 내장 | `offal` |
| 못 먹는 음식 (`avoided_food`) | 곱창·막창 | `intestines` |
| 못 먹는 음식 (`avoided_food`) | 고수 | `cilantro` |
| 못 먹는 음식 (`avoided_food`) | 소고기 | `beef` |
| 못 먹는 음식 (`avoided_food`) | 해산물 | `seafood` |
| 못 먹는 음식 (`avoided_food`) | 유제품 | `dairy` |
| 못 먹는 음식 (`avoided_food`) | 육류 전체 | `all_meat` |
| 못 먹는 음식 (`avoided_food`) | 기타 직접 입력 | `other_input` |
| 못 먹는 음식 (`avoided_food`) | 없음 | `none` |
| 식단 유형 (`diet_type`) | 식단 제한 없음 | `none` |
| 식단 유형 (`diet_type`) | 채식 (고기 · 생선을 먹지 않음) | `vegetarian` |
| 식단 유형 (`diet_type`) | 비건 (동물성 음식을 먹지 않음) | `vegan` |
| 식단 유형 (`diet_type`) | 페스코 (생선 · 해산물은 먹음) | `pescatarian` |
| 추가로 피할 것 (`additional_avoid`) | 돼지고기 제외 | `exclude_pork` |
| 추가로 피할 것 (`additional_avoid`) | 기타 직접 입력 | `other_input` |

## 3. 저장·권한·잠금

S1 `profile_food_preferences`/`profile_health_preferences`를 추가 migration으로 확장한다. 기존 S1 migration과 보류 M7은 수정하지 않는다. schema 1/2를 구별하며 v1 food는 v2 미입력이다. 건강 v1 행은 자동 축약/변환하지 않고 v2 저장으로 덮어쓰기 전에 S1008로 재입력/전환 안내한다. 빈 v1 행은 삭제 후 새 입력 가능하다.

food에 `completed_at`, `onboarding_seen_at`, `onboarding_snoozed_until`, `catalog_version` 추가. 완료는 schema2이고 preferences가 완전한 object인 경우에만 서버 시각으로 설정한다. 최초 완료 시각 유지, `{}` 초기화 시 null. 안내 `later`는 7일 snooze다.

health에 schema/catalog version, `avoided_food_codes`, `diet_type_code`, `completed_at` 추가. allergies는 기존 배열, additional_avoid는 기존 dietary_restrictions 열을 v2에서 재사용한다. 동의 사건 결합·만료·재동의 rebind·물리 삭제는 새 열까지 포함한다. 유효 재동의의 event-only rebind는 비활성 catalog를 재검증해 전체 동의를 실패시키지 않는다.

본인 쓰기는 profile row→consent state→health/food row 잠금, 대기 뒤 `clock_timestamp()`로 검사한다. 방 처리는 S1 room advisory→room row→현재 profile들을 UUID 순서로 잠금→ticket 순서다. S1 health/food writer는 room lock을 요구하지 않으므로 역순 대기가 없다. 외부 HTTP 대기 중 DB 잠금은 유지하지 않는다.

신규 public 테이블은 RLS ENABLE과 restrictive 필수 약관 정책을 둔다. profile row는 본인 SELECT, 직접 쓰기 없음. 방 설정은 현재 유효 participant만 SELECT, 현재 participant인 방장만 RPC 변경. catalog는 인증+필수 약관 뒤 공개 항목 조회. service_role은 private ticket/raw profile SELECT를 받지 않고 worker RPC EXECUTE만 받는다. 모든 SD 함수는 `search_path=''`, 명시 ACL, identity/멤버십 검사를 가진다. 새 Realtime 공개는 없다.

## 4. RPC 계약 (앱 작업자 고정 계약)

성공은 단일 object, `contract_version:2`, UTC ISO, bigint revision은 10진 문자열. unknown key/null/과대 body(8KiB)/잘못된 UUID/음수 revision은 22023. 본인 ID·consent_event_id·완료 시각을 사용자 인자로 받지 않는다. S1 consent API는 contract_version=1 그대로다.

| RPC / 정확한 인자 | 성공 object / 조건 |
|---|---|
| `get_food_profile_catalog_v2()` | `{contract_version:2,catalog_version,food_groups:[{group_code,selection,min,max,sentinel,options:[{code,label,enabled}]}],health_groups:[동일],capabilities:{food_v2:true,health_storage_v2:true,health_filter:false,automatic_midpoint:false,recommendation_purposes:["places"]}}` |
| `get_my_food_preferences_v2()` | `{contract_version:2,schema_version:2,catalog_version,requires_update,preferences,revision,completed_at,onboarding:{seen_at,snoozed_until}}`; v1/행 없음은 `{}`·completed_at=null, 존재 row revision은 유지 |
| `save_my_food_preferences_v2(p_catalog_version text,p_preferences jsonb,p_expected_revision bigint)` | 위 GET. 전체 네 필드 replace 또는 `{}`; CAS revision 증가. 입력 예: `{cuisines:["korean"],ingredients:[],forms:["noodles"],spice:"mild"}` |
| `mark_food_profile_prompt_v2(p_action text,p_expected_revision bigint)` | food GET, shown/later만. revision 증가, 선호값은 유지 |
| `get_my_health_preferences_v2()` | `{contract_version:2,schema_version:2,catalog_version,requires_update,status:"not_started"|"complete",allergy_codes:[],avoided_food_codes:[],diet_type_code:null,additional_avoid_codes:[],revision,consent_revision,valid_until,completed_at}`; 본인 유효 health 필수 |
| `save_my_health_preferences_v2(p_catalog_version text,p_allergy_codes text[],p_avoided_food_codes text[],p_diet_type_code text,p_additional_avoid_codes text[],p_expected_revision bigint,p_consent_revision bigint)` | 위 GET, 명시 저장 status=complete. 배열 필수, diet null 허용. S1 선택 동의 API를 대신 호출하지 않음 |
| `get_public_meeting_areas_v2()` | `{contract_version:2,areas:[{id,label,latitude,longitude,radius_m}]}`; 운영은 별도 검토한 catalog만 |
| `get_room_recommendation_settings_v2(p_room_id uuid)` | `{contract_version:2,public_area_id,area,public_cuisines:[],revision}`. 미설정 area=null, revision="0" |
| `set_room_recommendation_area_v2(p_room_id uuid,p_public_area_id text,p_expected_revision bigint)` | 위 GET, 현재 participant인 방장만. 활성 catalog ID만, 좌표/자유 주소 입력 금지 |
| `set_room_public_cuisines_v2(p_room_id uuid,p_cuisines text[],p_expected_revision bigint)` | 위 GET. 방장만; 0..7개 음식 종류, any 금지. 빈 배열=개인 STEP1 내부 집계 |
| `begin_room_recommendation_v2(p_room_id uuid,p_request_id uuid,p_purpose text)` | `{contract_version:2,request_id,status:"pending"|"working"|"complete",valid_until,result:null|최종응답}`; purpose="places"만 |
| `validate_my_recommendation_v2(p_request_id uuid)` | `{contract_version:2,status:"valid",valid_until}`; 원 요청자만, 현재 권한/context의 읽기 전용 시점 검사(방 advisory·멤버/티켓 쓰기 잠금 없음) |

### 4.1 Worker 전용 (service_role EXECUTE만)

- `claim_recommendation_work_v2(p_request_id uuid)`: `{contract_version:2,request_id,area,keywords:[],work_token}`. user-created ticket만 한 번 claim. keywords는 활성 catalog 코드 최대 5개, counts/프로필 ID/건강/개인 위치 없음. 앱 RPC에서 이 object를 반환하지 않는다.
- `finalize_recommendation_work_v2(p_request_id uuid,p_work_token uuid,p_candidates jsonb,p_model_ranking jsonb,p_source text)`: candidates는 `{places:[{id,name,address,latitude,longitude,cuisine_codes:[]}]}` 최대12, ranking은 임시 후보 ID 문자열 전체 순열, source gemini|rules. worker가 Tmap에서 검증한 후보만 허용. 최종 반환/저장 전에 최신 context 검사.
- `fail_recommendation_work_v2(p_request_id uuid,p_work_token uuid)` service 전용: 획득한 token으로 Tmap 실패를 terminal failed로 기록. idempotent, 완료 ticket 취소 불가. 해당 ID는 권한·문맥·TTL이 유효한 동안 begin 재시도에서 S5006(만료 후 S5004).
- `cleanup_recommendation_requests_v2(p_limit integer)` service 전용: 생성 후 24시간 경과 ticket 삭제. job 등록 없음.

### 4.2 Ticket·내부 집계·수명

UUID request_id는 caller·room·purpose에 결합한다. 같은 caller/ID/payload 재시도는 같은 상태·완성 결과, 다른 payload는 S1007, 다른 caller는 42501. 다른 방/만료/초대만/탈퇴/participant 없는 방장도 42501 NOT_ALLOWED로 통일한다.

private ticket은 room/member IDs·필수 동의/명시 입력된 v2 food preferences·catalog_version·area/catalog version의 hash만 context로 보관한다(건강/위치 원문 없음). 생성 5분 만료, 완성은 확정 시각부터 고정60초. caller/방의 약관·멤버십·STEP1/지역·catalog 변경 시 S5003, 만료는 S5004. shown/later 안내 상태·그에 따른 저장용 revision 증가는 추천 context에 포함하지 않는다. 미입력 v1 행 생성/기존 v2 행의 안내 탭 모두 추천을 무효화하지 않는다. 현재 멤버의 건강/출발지 수정·철회는 공동 일반 추천과 무관하므로 결과/키워드에 영향을 주지 않는다.

내부 STEP1 집계는 멤버별 동일 기여 상한, 미입력/any 중립, 코드별 기여도를 내부 계산한다. 방장 public_cuisines가 비어 있지 않으면 우선 사용한다. 서비스 keyword 응답은 최대5개 코드만. 최종 후보는 검증된 cuisine 일치도를 내부 집계 점수로 우선 정렬하고 Gemini 순위, ID 순으로 tie-break한다. 재료/형태/매운맛은 후보에 검증된 분류가 없으면 점수를 추측하지 않는다.

계정 전체 ticket 생성 예산(분당5회, 하루100회)과 별도 방 예산(분당30회, 하루1000회)을 검사하며 새 request ID로 무한 우회할 수 없다. claim 토큰은 단일 worker에 결합하고 finalize 재사용/다른 토큰은 거절한다.

## 5. Edge schedule-recommend v2

입력은 정확히 `{contract_version:2,request_id:UUID,room_id:UUID,purpose:"places"}`(8KiB). meetingName/후보/사용자 ID/좌표/건강/취향 body는 거절한다. Auth wrapper의 서명 검증+caller 대조→S1 필수 동의→사용자 JWT begin→service claim→Tmap→Gemini/rules→service finalize 순서다. 구 legacy 식당 추천 입력은 S1008/426이다. 동시 요청이 이미 working이면 HTTP 202와 begin object/Retry-After:1을 반환하고 같은 request_id로 다시 확인한다. 기존 시간 전용 body는 placeCandidates=[]일 때만 기존 경로를 유지한다.

Tmap은 고정 공식 around endpoint에 catalog 공용 좌표·반경·일반 '음식' 분류만 보낸다. 건강이나 개인 키워드로 검색 횟수/후보를 바꾸지 않는다. stable provider ID/이름/주소/유한 POI 좌표를 검증하고 반경 밖·중복·비음식 결과를 버린다. 임의 URL이나 앱 후보를 조회하지 않는다.

Gemini에는 p1..p12 임시 ID, 공개 cuisine 분류와 식별자 없는 상위 키워드만 보낸다. 방/사용자 ID, counts, 좌표·주소·가게 이름·meetingName, 건강 원문/상태, provider raw response는 보내거나 로그로 남기지 않는다. 전체 ID 순열만 받아 검증하며 자유 reason 문구는 쓰지 않는다. 키 없음/timeout/429/5xx/악성 응답은 검증된 후보를 rules로 정렬한다.

응답: `{contract_version:2,request_id,valid_until,source,area:{id,label,latitude,longitude,radius_m},places_status:"ready"|"empty",slots_status:"not_requested",place_recommendations:[{place_id,menu_id:null,place:{name,address,latitude,longitude},rank,reason_code:"PUBLIC_AREA_RECOMMENDATION",evidence_status:"unverified"}],slot_recommendations:[],my_health_filter:"not_requested"}`. 최대3개. 빈 후보면 places_status=empty. 숫자 점수·인원수·keywords·context hash·work_token·개인 건강은 반환 금지.

외부 provider 대기 뒤 방/약관/food/지역 version을 다시 확인하고 실패하면 결과를 폐기한다. 앱은 TTL·계정 전환·로그아웃·재동의·방 이탈·백그라운드에서 캐시를 지우고 선택 직전 validate RPC를 호출한다.

같은 request_id의 claim 경합에서 패배하면 원래 사용자 JWT로 begin을 한 번 재조회한다. working이면 202+Retry-After:1, complete이면 결과200, 권한/동의 오류이면 그 오류를 유지한다. provider를 중복 호출하지 않는다.

TMAP_API_KEY 부재·공백은 claim 전에 S5006/503 + new_request_required:false로 응답한다(서버 설정 복구 후 같은 ID 재사용 가능). claim 뒤 Tmap 실패는 token으로 failed를 기록하고 S5006/503 + new_request_required:true로 응답한다. 해당 ID의 begin 재시도도 권한·문맥·TTL이 유효하면 S5006이며(만료 후 S5004), 새 시도는 새 request_id를 사용하고 호출 제한을 적용한다. 실패 기록 RPC 자체가 실패해도 새 ID 필요 표시는 유지하며 기존 working TTL은 5분이다. 불확실한 finalize 전송 실패는 완료 여부를 추측하지 않고 같은 ID로 begin 재조회할 수 있다. 검증된 재료 정보가 없으므로 결정적 규칙 점수는 공개 POI의 음식 종류 일치만 사용하며 재료·매운맛 일치를 보장하지 않는다.

## 6. 오류 고정

| SQLSTATE / message | Edge HTTP | 처리 |
|---|---|---|
| 22023 INVALID_INPUT | 400 | unknown key·타입·선택·body |
| 42501 AUTH_REQUIRED / NOT_ALLOWED | 401 / 403 | 미인증 / 타인·초대·탈퇴·없는/만료 방 동일 |
| 23503 PROFILE_NOT_READY | 409 | provisioning 대기 |
| S1001 TERMS_REQUIRED | 403 | S1 재동의 |
| S1003 HEALTH_CONSENT_REQUIRED | 403 | 본인 STEP2만 차단, 기본 서비스 유지 |
| S1004 REVISION_CONFLICT | 409 | 다시 조회, 덮어쓰기 금지 |
| S1006 CONSENT_CONFIGURATION_UNAVAILABLE | 503 | 안전하게 닫기 |
| S1007 IDEMPOTENCY_CONFLICT | 409 | 같은 ID 다른 입력 |
| S1008 CLIENT_UPDATE_REQUIRED | 426 | v2 행에 v1 접근 / 미지원 목적·body / 변환 불가 건강 v1 |
| S5001 CATALOG_CHANGED | 409 | 새 catalog 조회 |
| S5002 LOCATION_SELECTION_REQUIRED | 409 | 방장 지역 선택 |
| S5003 RECOMMENDATION_CONTEXT_CHANGED | 409 | 늦은 결과 폐기 |
| S5004 RECOMMENDATION_EXPIRED | 410 | 새 요청 |
| S5005 RECOMMENDATION_RATE_LIMITED | 429 | 제한 대기 |
| S5006 PLACE_PROVIDER_UNAVAILABLE | 503 | Tmap 설정/장애. Edge new_request_required:false는 claim 전 설정 오류로 동일 ID 재사용, true는 claim 후 실패/실패 재조회로 새 ID 필요. 빈 성공/가짜 후보 금지 |

## 7. 지역 catalog와 운영 경계

운영 지역은 검토한 공용 중심·반경 catalog만 쓴다. 실제 운영 seed 목록은 별도 승인이 필요하다. 로컬 seed에는 명백한 local-dev 서울 도심 예시만 제공하고 이를 자동 운영 게시하지 않는다. 새 지역의 기본 반경은 2km, 좌표/지역목록 검토 없이 검색 범위를 임의 확대하지 않는다.

M7은 supabase/release에 그대로 둔다. 새 S5 migration은 S1 뒤 추가하며 로컬 reset은 M1~M6+S5+S1 local-dev seed다. S1의 정합성/원격 승인·Edge DB 이후 배포 순서와 pg_default_acl explicit grant 규칙을 유지한다. 어떤 cron/외부 job/원격 write도 migration에 숨기지 않는다.

## 8. 검증·완료 기준

- 가상 A/B 같은 방, C 외부, D 초대만, E 탈퇴, F participant 없는 방장, pending, anon/service를 실제 SQL JWT 역할로 검증한다. 본인/방 RLS와 table/function/column ACL·fixed search_path·midpoint 회수를 검사한다.
- 카탈로그 67개·allergy 복수, partial/unknown/disabled/sentinel/null/중복/다차원/과대 입력, catalog version·CAS·첫 저장·초기화·snooze를 검증한다.
- 건강 미동의/철회/정확한 만료 경계/재동의 rebind/동시 save·철회/retention 파기와 S1 선택 거절 후 STEP1 유지. v1 health 자동 축약 금지.
- room/area owner 권한, 1인/2인, 지역 없음, private origin 변경 무영향, 건강 변경 무영향, STEP1/멤버/지역/동의 변경의 finalize·validate 실패를 검사한다.
- ticket caller 소유·위조/재사용 payload·worker ACL·만료·토큰·rate limit·삭제 cascade·24시간 cleanup을 검사한다. 공급자 대기 중 실제 DB 잠금은 없다.
- Tmap 서버 수집·반경/POI 검증, Gemini allowlist 및 건강 전송0, timeout/429/invalid JSON/ID 순열 실패→rules, 최종 DB 오류 시 성공 응답 금지. 실제 handler 분기를 mock provider로 검증한다.
- fresh local reset, S1→S5 upgrade·legacy 무이전, 관련 S1 회귀를 전환 전/공존 경로에서 검증. source/hash·검증 수·미실행과 미확인 사항을 supabase/tests/S5-A-REPORT.md에 기록한다.
- 앱/실기기/실제 provider 비용 호출은 별도 작업·증거다. DB/Edge 작업 완료를 배포·앱 복구 완료로 주장하지 않는다. 보안 경계는 메인의 독립 검토 뒤 수용한다.

## 9. 확정 결정과 남은 운영 항목

이전 열린 제품 질문은 §1·2로 확정했다. 미확정은 운영 지역 catalog 목록, 검증된 재료 공급원/개인 건강 필터의 후속 출시, 앱·provider 실제 E2E, 운영 날짜·개별 배포 승인이다. 이 항목은 기본값으로 활성화하지 않는다.
