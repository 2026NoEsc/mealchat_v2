# S4 구현 명세: 일정 저장과 방장의 약속 확정

작성: 2026-10-19. 조사 기준: 로컬 `Develop`, 구현 기준 `HEAD ca88baf`. **§12의 일곱 제품 결정은 사용자 권장안 승인으로 확정됐다. 구현·보안 승인·운영 반영 증거는 별도 검증한다.** DB/Edge와 앱 작업자가 소유 범위별로 구현한다. 원격 Supabase, `.env`, 인증 파일, 실제 사용자 데이터에는 접근하지 않았다.

진행 순서: S1 → S5 일부(음식 프로필·공용 지역 추천) → **S4** → S3(방 생명주기) → S2(계정 삭제) → S5 나머지·S6·S7. S1 `17ad858`, S5 일부 `729dffa`의 완료·운영 미반영 상태는 작업 요청의 전제다. 로컬 코드와 과거 WORKFLOW 문구만으로 운영 상태를 확정하지 않는다.

## 1. 목적과 유지할 계약

1. 추천 화면에서 고른 시간 구간을 서버에 저장하고 모든 화면에서 같은 시간대·포맷 함수를 사용한다. 시간 선택은 약속 전체 확정과 구별한다.
2. 식당 후보 확정, 약속 단계 변경, 시스템 메시지를 **한 DB 트랜잭션**으로 처리한다. 전원이 투표해도 자동 확정하지 않고 현재 participant인 방장만 명시적으로 확정한다.
3. 일정 제출, 제출 인원 판정, 단계 전환을 같은 방 잠금 아래 처리한다. `profile_id IS NULL`인 레거시 표시 행은 제출·투표 정족수에서 제외한다.
4. 이름 오류와 후보 상한 오류를 서로 다른 코드로 반환한다. 기존 API도 우회 경로가 되지 않도록 보강한다.
5. S1 필수 약관 gate, 공개 범위, 정산 계좌의 요청·고정 수취인·공개 종료 계약은 유지한다. S4 응답·이벤트에는 계좌·건강·개인 출발지를 넣지 않는다.
6. S5의 공용 지역, 방장 공용 음식 종류, STEP 1 내부 집계, ticket 재검증을 유지한다. `menu`라는 기존 투표 kind와 `confirmed_menu`는 현재 **식당**을 뜻한다. 음식 메뉴 단계 신설이나 이름 변경은 S5 나머지에서 한다. `meeting_midpoint` 재개방, 건강 필터, 시간 추천 v2 신설은 하지 않는다.

S3의 메이트 나가기·초대 코드 TTL/실패 제한·방 삭제 정책, S2 계정 삭제, S6 정산 모델, S7 알림/신고를 구현하지 않는다. 기존 join/accept/leave 및 정산 경로에 필요한 잠금·revision 연계는 S4 경쟁 방어에 한해서만 변경한다. 사용자 추가 결정: 새 정산은 약속 확정 뒤에만 시작한다. confirmed 또는 appointment_confirmed_at이 있는 settling/done에서는 새 bill을 허용한다. 확정 증거 없는 레거시 settling/done은 기존 미완료 정산 재시도만 유지하고 새 bill은 거절한다. NULL-profile 표시행은 새 정산 수취인·정족수에서 제외한다.

## 2. 현재 상태 진단과 근거

아래 줄 번호는 `729dffa` 기준이며 실제 구현 시 최종 함수 정의를 다시 확인한다. 특히 오래된 migration만 고치면 뒤의 S1 재정의가 변경을 덮어쓴다.

| 근거 | 확인한 상태 / S4 조치 |
|---|---|
| `src/screens/schedule/ScheduleConfirmedScreen.tsx:107-123` | `chosen`은 화면 상태에만 있고 `advanceRoomStage('place')`만 호출한다. 선택 시간 저장+전환 RPC로 대체한다. |
| `src/screens/schedule/ScheduleDetailScreen.tsx:68-77`, `src/lib/rooms.ts:404-435` | 방 생성 당시 7일 뒤 날짜를 `meeting_date`로 넣으며 선택 시간과 관계없다. `confirmed_slot`은 nullable text이고 생성 시 `is_confirmed`와 결합된다. `meeting_date`를 실제 약속 시각으로 추정하면 안 된다. |
| `src/components/ui/MeetingCard.tsx:8-15`, `src/components/RoomRow.tsx:18-25`, `src/screens/chat/RoomDetailScreen.tsx:66` | ISO/text 혼합값을 각자 파싱하거나 그대로 표시하며 기기 시간대에 의존한다. 시간 미정 처리도 분산돼 있다. |
| `src/screens/chat/VotingSheet.tsx:123-160` | 방장 UI는 있지만 `confirm_room_vote` → `advance_room_stage('confirmed')`가 분리돼 있다. `voteSaved` 및 저장된 식당으로 두 번째 호출만 재시도한다. |
| `supabase/migrations/20260903140000_auto_confirm_on_full_vote.sql`, `20260906134305_rpc_concurrency_rehardening.sql:155-200` | 전원 투표 자동 확정의 도입·재정의 이력이다. 이를 삭제한 것만으로 현재 계약이 바뀌지 않는다. |
| `supabase/migrations/20261017095000_s1_terms_access_gate.sql:655-700` | 최신 `toggle_vote`도 전원 투표 시 최다 득표 라벨로 `stage/is_confirmed/location_name`을 바꾼다. `confirmed_menu_item_id`나 방장의 명시 확정 증거는 기록하지 않는다. |
| 같은 S1 migration `:706-862` | `confirm_room_vote`는 멤버십만 검사하고 방장 여부·정확한 stage를 검사하지 않는다. 정족수는 실제 사용자만, strict majority와 배열 순서 tie-break를 사용한다. time 확정은 `is_confirmed=true`, menu 확정은 별도 저장이다. |
| 같은 S1 migration `:867-918` | `advance_room_stage`는 owner만 확인하고 잠금·멤버십·만료·제출 완료 검사 없이 임의의 더 높은 단계로 이동한다. `done` 호출로 만료까지 변경할 수 있다. |
| `src/screens/chat/ScheduleSheet.tsx:174-223`, 같은 S1 migration `:921-1000` | 앱은 저장 직전 stage를 재조회하지만 서버 제출 함수는 stage를 검사하지 않는다. 상태 RPC는 NULL profile 행도 반환하고 UI는 모든 행에 `every(submitted)`를 적용한다. |
| 같은 S1 migration `:939-946,993-996` | 제출은 최대500칸 길이 외 검증이 약하고, 빈 배열은 미제출로 취급한다. S4는 빈 배열을 철회로 유지한다(확정). |
| 같은 S1 migration `:440-445,479-484`, `src/screens/chat/VotingSheet.tsx:40-41` | 빈/긴 이름과 종류별30개 초과가 모두 `22023`. UI가 이를 전부 상한 초과로 해석한다. |
| `src/lib/voting.ts:77-92` | 정족수는 NULL profile 행을 제외하지만 후보별 voters는 제외하지 않는다. 서버 판정과 앱 표시를 함께 맞춰야 한다. |
| `supabase/migrations/20260823072701_harden_settlement_invitation_events.sql:924-955` | rooms UPDATE는 차단했지만 INSERT에는 `is_confirmed/confirmed_slot`이 허용되고 일치 여부만 확인한다. 새 방에 확정값 주입을 막아야 한다. |
| `supabase/migrations/20261017095000_s1_terms_access_gate.sql:1-19`, `20261017091000_s1_consent_rpcs.sql:28-33` | RLS restrictive gate와 SD RPC의 `private.require_current_terms_consent()`가 별도 방어다. 신규/교체 RPC 모두 유지한다. |
| `supabase/migrations/20261017093000_s1_profile_visibility.sql:35-37` | 현재 participant SELECT 열에 `schedule`이 포함된다. 상태 RPC가 타인 슬롯을 숨긴다는 사실만으로 DB 전체의 일정 비공개를 주장할 수 없다. S4는 접근 범위를 추가하지 않으며 이 기존 노출의 재설계는 별도 검토 사항이다. |
| `supabase/migrations/20260908120000_settlement_stage_transitions.sql:18-62`, `20261017094000_s1_settlement_disclosure.sql:130-184` | 이전 정산 트리거는 scheduling/place에서도 settling으로 이동했다. 사용자 추가 결정에 따라 새 migration에서 confirmed 또는 방장 확정 증거가 있는 done의 새 bill INSERT만 settling으로 전환하고 두 생성 RPC의 공용 core에 S4008/SETTLEMENT_REQUIRES_CONFIRMATION guard를 둔다. 방 advisory→room→bill 순서는 유지한다. |
| `supabase/functions/schedule-recommend/index.ts:871-907,981-1028` | 유지 중인 시간 추천은 schedule을 읽고 인원을 `rows.length`로 센다. 연속 칸 전체에 가능한 사람은 교집합으로 계산하므로 0명 구간도 생길 수 있다. 레거시 인원 제외 및 저장 시 독립 검증이 필요하다. |
| `src/lib/scheduleSlots.ts:26-75,130-179` | 격자는 기기 로컬 날짜를 사용하며 `parseSlotLabel`은 연도 없는 라벨을 가까운 미래로 추정한다. 영속값 이전이나 새 시간 저장에 이 추정을 사용하지 않는다. |

워크플로·디자인 참조: `docs/WORKFLOW.md:25,67,166`의 상태는 날짜가 붙은 과거 기록이다. `docs/figma-specs.md:62-71`은 화면/시트 매핑 근거이며, 이번의 “약속 확정은 식당 정하기에서 방장만”은 사용자 작업 지시를 우선한다. Figma 원격 노드는 이번에 조회하지 않았다.

## 3. 확정된 상태·제품 정책

### 3.1 상태 전이

| 현재 | 행위 | 서버 결과 |
|---|---|---|
| `scheduling` | 본인 일정 제출/수정/빈 배열 철회 | 본인 schedule만 변경. stage 유지 |
| `scheduling` | 방장이 시간 선택 후 식당 단계로 이동 | 실제 사용자 전원 제출 재검사 → 시간 저장과 `place` 전환 원자 처리 |
| `scheduling` | 추천 없이 식당 단계로 이동 | 전원 제출 검사는 동일. 시간은 null 유지하고 `place`로 전환; UI에서 시간 미정 명시 |
| `place`, 구조화 시간 미선택 | 본인 일정 제출/수정/철회 | 본인 schedule만 변경. 시간 선택 뒤 제출 불가 |
| `place` | 방장이 시간 선택/수정 | 시간만 저장. `place` 유지. 이미 제출된 일정 자료에서 직접 선택 가능 |
| `place` | 멤버 후보 추가/삭제/투표 | 기존 권한 조건과 후보 제한 유지. 자동 확정 없음 |
| `place` | 방장 최종 확정 | 유효 시간 + 서버가 계산한 과반 최다 득표 식당 → 식당/단계/메시지 원자 저장 |
| `confirmed`, `settling`, `done` | 일정·후보·투표 변경 또는 새 확정 | 거절. 동일 성공 요청 재시도는 부수 효과 없는 조회로 처리 |
| 기존 정산 경로 | 정산 생성/수취인 완료 | 새 bill은 confirmed 또는 방장 확정 증거가 있는 settling/done에서 생성. 기존 진행 중 bill 재시도·수취인 완료는 기존 규칙. 일반 단계 API는 정산을 대신하지 않음 |

확정 정책: 전원 제출은 **일정 제공을 마쳤다는 뜻**이며 전원 참석 보장이 아니다. 최종 선택 구간 전체에 최소1명의 실제 참가자가 가능해야 한다. 전원 공통 시간만 강제하지 않는다. 시간 없이 `place` 진입은 허용하지만 **새 최종 확정에는 구조화된 시간이 필요**하다. 선택 시간 변경은 최종 확정 전까지 방장에게만 허용한다. 이 정책들은 §12의 사용자 승인으로 확정됐다.

정족수 집합은 현재 방의 `participants.profile_id IS NOT NULL`인 행이다. 초대 대기자는 포함하지 않고, 필수 약관 미동의 멤버는 임의로 정족수에서 제외하지 않는다. 빈 집합은 전원 제출/과반 달성이 아니다. 익명 표시 행은 삭제하지 않고 “일정 제출 대상 아님”으로 표시할 수 있다. 식당 확정은 이 집합의 `floor(N/2)+1`표 이상인 최다 득표 후보만 허용한다. 복수 후보 투표와 동률 시 `voting_items` 배열 순서 우선은 현재 동작을 유지한다. 전원 투표를 별도 확정 조건으로 요구하지 않는다.

### 3.2 시간·날짜 형식

- 저장: `meeting_starts_at timestamptz`, `meeting_ends_at timestamptz`, `meeting_time_zone text`. S4 허용 zone은 `Asia/Seoul` 하나. `timestamptz`만으로 원래 IANA zone은 보존되지 않으므로 별도 열을 둔다.
- RPC 입력은 정확히 `{starts_at,ends_at,time_zone}` 또는 허용된 경우 JSON null. 두 시각은 날짜·초·`Z` 또는 `±HH:MM` offset을 포함한 ISO 8601 문자열. offset 없는 시각, 연도 없는 라벨, infinity, 날짜 자동 보정, unknown key는 거절한다. 같은 순간의 다른 offset 표기는 UTC로 정규화한다.
- 추천 `date/startTime/endTime`는 한국 현지 시각으로 해석해 명시적 `+09:00`를 붙여 전송한다. 추천 라벨/순위/참석률은 저장 인자가 아니다. 예: `2026-10-20T18:00:00+09:00`~`19:00:00+09:00` → `09:00:00Z`~`10:00:00Z`.
- 확정 범위는 기존 격자대로 KST 같은 날짜 11:00~21:00, 정각, 최소1시간, 시작<종료. 시작은 잠금 획득 뒤 `clock_timestamp()`보다 미래, 종료는 기존 `expires_at` 이하여야 한다. 과거 시각·만료 이후 약속을 자동 보정하거나 방 수명을 연장하지 않는다.
- 가용 시간 키 `YYYY-MM-DD-H`(11..20)는 하위 호환을 위해 유지하되 뜻을 KST로 고정한다. 실제 달력 검증, 1차원 배열, null 원소/중복 거절, 최대500칸, 허용 시간·만료 범위 검증. 저장 배열은 정렬한다. 새 요청은 과거 칸을 제거해 제출하며 서버도 과거 칸을 거절한다.
- 제출 판정은 현재 시점에 유효한 미래 칸이 1개 이상 있는지로 통일한다. 기존 잘못된/지난 칸은 DB에서 조용히 날짜를 추정하거나 삭제하지 않고 조회 시 집계에서 제외한다. `submitted_at`만 있고 빈 배열이면 미제출이다.
- 모든 JSON 시각은 UTC ISO 문자열로 반환한다. `meeting_date`는 구조화된 시간을 저장할 때 KST 시작 날짜로 동기화하되, null 시간인 기존 방의 값은 유지하고 확정 날짜로 사용하지 않는다. `expires_at`·`settled_at`은 S4 시간 저장/확정으로 변경하지 않는다.
- 앱 공통 순수 함수 `src/lib/meetingTime.ts`에 입력 정규화와 `formatMeetingTime`을 둔다. 홈 행·채팅 카드·방 상세·일정 시트·최종 확인창·STEP3가 동일 DTO를 사용한다. 한국 시간 기준임을 표시하고 기기 timezone/언어 변경에도 약속 날짜가 바뀌지 않아야 한다.
- 구조화 시간이 없으면 scheduling은 “시간 확정 전”, 나머지는 “시간 미정”. 레거시 text가 있으면 “이전 시간 표기”로만 원문 표시하며 확정 가능한 구조화 시간으로 승격하지 않는다. 절대 `meeting_date`, 오늘, 자정, parseSlotLabel 추정 연도를 대입하지 않는다.

## 4. 추가 저장소와 원자성

### 4.1 테이블 변경

| 대상 | 신규 열 / 제약 |
|---|---|
| `public.rooms` | `meeting_starts_at`, `meeting_ends_at`, `meeting_time_zone` nullable. 모두 null 또는 모두 non-null, 유한 시작<종료, zone allowlist. 과거 허용 여부는 CHECK가 아니라 쓰기 RPC에서 판정한다. |
| `public.rooms` | `s4_revision bigint NOT NULL DEFAULT 0 CHECK (s4_revision>=0)`; JSON에서는 10진 문자열. `appointment_confirmed_at timestamptz`, `appointment_confirmed_by uuid REFERENCES profiles(id) ON DELETE SET NULL` nullable. 새 원자 확정만 설정. 계정 삭제로 by가 null이 될 수 있으므로 영구 쌍 CHECK를 만들지 않는다. |
| `private.s4_requests` | `(actor_id,request_id)` PK, `room_id` FK, `operation`, 정규화 입력의 `payload_hash`, `applied_revision`, `created_at`. actor/room 삭제 CASCADE. RLS 활성, 앱/worker table grant 없음. 원본 일정·식당 이름·전체 응답은 중복 보관하지 않는다. |

`s4_revision`은 시간·stage·후보·투표·제출 일정·현재 멤버 구성/owner가 바뀔 때 증가한다. 이름/아바타/채팅/읽음/추천 안내·건강 변경은 증가시키지 않는다. 새 S4 writer뿐 아니라 남겨 둔 legacy writer, join/accept/leave, 정산의 stage writer에도 동일 방 잠금 아래 revision 증가를 연결한다. 계좌 공개·고정 수취인 계약은 유지하며, 정산 시작 단계와 NULL-profile 수취인 제외는 승인된 추가 결정으로 보강한다. 구현 전 실제 writer 목록을 SQL catalog와 migration으로 대조하고 누락을 테스트한다. 트리거로 보완할 경우 **participant row를 잠근 뒤 뒤늦게 room advisory lock을 얻는 역순**을 만들지 않는다. 같은 논리 변경의 정확한 증가량은 계약하지 않고 단조 증가만 보장한다.

새 시간 저장 시 기존 `confirmed_slot`에는 UTC 시작시각 문자열만 서버가 써서 구앱이 읽을 수 있게 한다. 새 앱은 구조화 구간을 우선한다. `confirmed_time_item_id`는 새 시간 저장에서 null; 레거시 텍스트 time 투표와 섞지 않는다. 시간만 선택한 상태에서는 `is_confirmed=false`; 최종 식당 확정에서만 true로 바꾼다. 과거 전체 행에 stage/is_confirmed CHECK를 일괄 적용하지 않는다.

### 4.2 공통 잠금·검증 순서

1. `auth.uid()` 및 S1 필수 약관 확인. 호출자/방장 ID를 입력으로 받지 않는다.
2. 기존과 동일한 `pg_advisory_xact_lock(hashtextextended(room_id::text,0))` → room `FOR UPDATE` → 필요한 현재 profile 행을 UUID 순서로 잠금 → participant/요청 ledger 순서. 정산 경로는 기존 room→bill 순서를 유지하고 S4가 bill을 먼저 잠그지 않는다.
3. 대기 후 `clock_timestamp()`로 만료와 시간 유효성을 다시 읽고, 현재 participant·방장·필수 약관을 재검사한다. 같은 방 변경자 모두 이 순서를 사용해야 한다. 요청자의 profile 잠금은 S1 동의 writer와 직렬화하기 위한 것으로, 건강 데이터는 읽지 않는다.
4. idempotency ledger를 검사한다. 동일 actor/request/정규화 인자면 성공한 작업을 다시 수행하지 않는다. 다른 room/operation/payload/revision이면 `S1007`. 서로 다른 방에서 같은 actor/request가 경합하는 경우 PK 충돌 후 승자 행을 재조회해 동일 규칙을 적용한다.
5. 새 요청은 `p_expected_revision`과 room revision 비교 → stage와 행위별 조건을 다시 계산 → 저장/이벤트/revision/ledger를 같은 트랜잭션에서 완료한다. 중간 실패는 모두 rollback한다.
6. 성공 재시도도 현재 약관·멤버십·방 유효성 검사를 생략하지 않는다. replay는 현재 상태와 원 적용 revision을 반환한다. 정산으로 이미 전진한 방을 confirmed로 되돌리지 않는다. 삭제·탈퇴 뒤에는 과거 성공 응답도 노출하지 않는다.

ledger는 방 수명 동안 유지하며 S4에 별도 cron을 추가하지 않는다. 실제 일정 변경(submit) 이력만 actor당 전체 1,000행·방당 `1,000 × greatest(5, 현재 실제 참가자 수)`로 제한한다. 참가자 최대 수를 새로 도입하지 않고 현재 인원에 비례해 방 상한을 확보한다. 방장 시간 선택(select)·확정(confirm)은 두 상한에서 제외한다. 신규 변경 요청의 상한 오류는 S4011이며 상태/이벤트/ledger는 무변경이다. 성공 ID replay는 상한 검사보다 먼저 처리한다. 정규화한 일정·방장 선택 시간이 현재 저장 내용과 같거나 동일 후보가 이미 최종 확정됐으면 각 core의 권한·stage·시간 검사 및 revision 검증 뒤 applied/현재 revision을 반환하고 새 ledger 행을 만들지 않는다. 이 무변경 요청 ID는 저장되지 않으므로 S1007/replayed 보장은 ledger에 기록된 변경 요청에 적용된다. 무변경 요청 뒤 revision이 바뀌면 같은 입력의 재시도도 S4005로 재조회가 필요하다. 임의 기간 삭제로 오래된 ID를 재실행하지 않으며 방/계정 삭제 CASCADE가 공간을 회수한다. timeout은 성공 여부 불명이다. 앱은 payload·request_id를 그대로 유지해 재시도하거나 상태를 재조회하며 새 request_id로 자동 덮어쓰지 않는다. 충돌 후 사용자가 최신 상태를 확인해 다시 결정할 때만 새 ID를 만든다.

상태 및 availability 조회는 STABLE 호출 그래프의 한 statement snapshot으로 제출수·후보·revision을 반환한다. 읽기는 advisory/row 쓰기 잠금을 얻지 않고 동의·멤버십·만료를 검사하며 다른 멤버의 프로필·동의 쓰기를 막지 않는다. 외부 HTTP 호출은 없다. S5 provider 대기 중 DB 잠금을 유지하지 않는 계약을 그대로 지킨다.

## 5. 공개 RPC 계약

새 이름은 아래로 고정하고 overload하지 않는다. `RETURNS jsonb`, 성공은 단일 object, UTC 시각, bigint는 10진 문자열이다. 인자의 누락/null 허용 범위를 구별한다. UUID 인자 캐스팅 단계 오류는 PostgreSQL/PostgREST의 `22P02`이며 앱에서는 INVALID_INPUT으로 처리한다. 함수 내부 타입·형식·음수 revision·8KiB 초과 JSON·unknown key는 `22023/INVALID_INPUT`. 사용자에게 DB 원문 오류를 표시하지 않는다.

### 5.1 지원 여부·조회

| RPC | 입력 | 반환 / 권한 |
|---|---|---|
| `get_s4_capabilities` | 없음 | 아래 capability. authenticated + S1 gate |
| `get_room_s4_state` | `p_room_id uuid` | 아래 RoomDecisionState. 현재 방 멤버 |
| `preview_room_meeting_time_v1` | `p_room_id uuid, p_starts_at text, p_ends_at text, p_time_zone text` | `{eligible_count:number,available_count:number,all_available:boolean,revision:string}`. 현재 방 멤버, 읽기 전용 STABLE |

`get_s4_capabilities()` → `{contract_version:1,atomic_confirmation:true,structured_meeting_time:true,owner_confirmation:true,availability_stage_guard:true,time_zones:["Asia/Seoul"],requires_time_for_confirmation:true}`.

authenticated + S1 gate 필수. 모든 S4 writer/compat wrapper 교체가 완료된 활성화 migration에서만 함수를 공개한다. S1/S5 지원 여부와 S4를 동일시하지 않는다. 이 응답은 데이터 읽기 권한이나 동의 완료를 대신하지 않는다.

`get_room_s4_state(p_room_id uuid)` → 다음 `RoomDecisionState`:

```ts
type RoomDecisionState = {
  contract_version: 1;
  room_id: string;
  revision: string;
  stage: 'scheduling' | 'place' | 'confirmed' | 'settling' | 'done';
  server_time: string;
  meeting_time: { starts_at: string; ends_at: string; time_zone: 'Asia/Seoul' } | null;
  time_status: 'selected' | 'unset' | 'legacy_unverified';
  legacy_time_label: string | null;
  restaurant: { item_id: string | null; label: string } | null;
  confirmation_status: 'none' | 'legacy_partial' | 'legacy_confirmed' | 'legacy_settlement_unverified' | 'owner_confirmed';
  availability: {
    eligible_count: number; submitted_count: number; all_submitted: boolean;
    members: { participant_id: string; name: string; avatar_color: string;
      eligible: boolean; submitted: boolean }[];
    my_slots: string[]; others_slots: string[];
  };
  voting: { eligible_count: number; leading_item_id: string | null;
    leading_votes: number; required_votes: number };
  permissions: { can_submit: boolean; can_select_time: boolean; can_confirm: boolean };
};
```

권한은 유효한 현재 participant만. `others_slots`는 기존 cells와 같은 타인 가능 칸의 합집합이며 이름/ID별 슬롯을 추가하지 않는다. 익명 집계나 “바쁜 시간”으로 표현하지 않는다. NULL profile 행은 members에 eligible=false로만 표시하고 나머지 집계·others_slots에서 제외한다. permissions는 화면 힌트이며 mutation에서 모두 재검사한다. 미지/타방/만료는 `42501/NOT_ALLOWED`로 통일한다. 목록은 capability 확인 후 rooms 신규 열을 명시 SELECT하여 N+1 호출을 피하고, mutation 진입 시 상태 RPC로 최신 revision을 얻는다.

`time_status`는 구조화 구간 존재 시 selected, 구조화 구간 없이 기존 confirmed_slot이 있으면 legacy_unverified, 둘 다 없으면 unset이다. `confirmation_status`는 appointment_confirmed_at 존재 시 owner_confirmed, 그 증거 없이 confirmed이면 legacy_confirmed(방장 확정 증거 없음), settling/done이면 legacy_settlement_unverified(이전 정산·약속 확정 여부 확인 불가), place에 confirmed_menu가 있으면 legacy_partial, 나머지는 none이다. restaurant는 confirmed_menu를 우선 반환하고, 과거 자동확정 방의 location_name만 있으면 UI의 기존 장소 표기로만 유지한다. location_name만으로 restaurant 확정 객체를 만들지 않는다.

#### 직접 선택 구간의 참석률 미리보기

`preview_room_meeting_time_v1(p_room_id uuid,p_starts_at text,p_ends_at text,p_time_zone text)`는 선택 RPC와 같은 명시적 offset의 ISO 문자열과 `Asia/Seoul`을 받는다. null/누락은 허용하지 않는다. 문자열 형식·zone 오류는 22023, KST 같은 날 11~21시 정각·1시간 이상·미래·방 만료 범위를 벗어나면 S4006이다. 시간 선택과 같은 공통 시간 검증·슬롯 정규화 함수를 사용한다.

분모 eligible_count는 현재 실제 멤버(profile_id IS NOT NULL) 수이며 초대 대기자·NULL 표시행은 제외한다. 분자 available_count는 **구간의 모든 1시간 칸에 연속 참석 가능한 같은 멤버** 수다. 빈/지난/잘못된 일정은 가능자로 세지 않는다. `all_available = eligible_count > 0 && available_count === eligible_count`. 가능자 0명도 정상 조회 결과이며 실제 선택은 S4006으로 거절한다. 응답은 위 네 필드뿐이고 개인 이름·식별자·슬롯은 포함하지 않는다.

S1 필수 약관·현재 멤버십·만료를 검사하며 방장 외 멤버도 조회할 수 있다. 비멤버/미지/만료 방은 42501. stage나 전원 제출 조건은 조회를 막지 않는다. STABLE statement snapshot으로 인원과 revision을 함께 읽으며 advisory/room/profile 쓰기 잠금을 얻지 않고 이력·방·일정·이벤트도 변경하지 않는다.

앱은 직접 구간을 바꿀 때 이 RPC 결과의 가능자/전체 인원과 참석률을 표시한 뒤 방장의 선택을 받는다. `available_count=0`이면 선택을 허용하지 않는다. 요청 구간이 바뀐 뒤 도착한 옛 미리보기는 버리고, 저장에는 **표시한 미리보기의 revision과 같은 구간**을 보낸다. S4005이면 재조회·재확인이 필요하며 최신 revision만 붙여 이전 집계를 자동 저장하지 않는다. 미리보기는 저장 권한/성공 보장이 아니고 실제 선택 RPC가 잠금 뒤 전원 제출·시간·가능 인원을 다시 검사한다. 기존 others_slots 합집합으로 연속 참석 인원은 복원할 수 없고 모든 가능한 구간을 상태 응답에 미리 싣는 비용도 피하기 위해 별도 RPC를 둔다.

### 5.2 일정 제출

`submit_room_availability_v1(p_room_id uuid,p_slot_keys text[],p_expected_revision bigint,p_request_id uuid)` → `{contract_version:1,outcome:"applied"|"replayed",applied_revision:string,state:RoomDecisionState}`.

- 본인 participant만 수정. scheduling 또는 구조화 시간이 아직 없고 명시 확정 증거가 없는 place에서 허용한다. 빈 배열은 제출 철회이며 submitted=false. 인자 null은 빈 배열로 암묵 변환하지 않고 거절한다.
- 입력은 §3.2 검증 후 현재 `participants.schedule={slots:[...],submitted_at:UTC}`에 저장한다. 기존 Edge의 읽기 형식을 보존한다.
- 같은 요청 replay는 timestamp/revision을 갱신하지 않는다. 새 요청이 현재 슬롯과 같으면 실제 데이터 변화 없이 완료할 수 있다.
- 제출과 단계 전환의 선후 관계는 방 잠금으로 결정한다. 먼저 저장된 변경으로 revision이 달라졌으면 뒤 요청은 우선 `S4005`. 최신 revision으로 다시 시도해도 시간 선택/최종 확정 뒤 제출은 S4003, scheduling에서 철회 뒤 전환은 S4004다. 시간 없이 place로 이동했다면 시간 선택 전까지 제출/수정을 허용한다. 성공 직후 화면을 닫아도 부모 상태는 갱신한다.

### 5.3 시간 선택 및 식당 단계 진입

`select_room_meeting_time_v1(p_room_id uuid,p_time jsonb,p_expected_revision bigint,p_request_id uuid)` → 동일 mutation 응답.

- 현재 participant인 방장만. `scheduling`에서는 전원 제출을 서버에서 확인하고 시간 저장과 `place` 전환을 묶는다. `p_time=null`은 시간 미정으로 `place` 진입할 때만 허용한다.
- `place`에서는 non-null 시간 선택/수정을 허용한다. 이미 선택된 시간을 null로 지우는 기능은 이번 범위에 넣지 않는다. `confirmed/settling/done`은 변경 불가.
- 서버는 최신 eligible schedule로 선택 구간의 칸을 확인한다. 매 칸이 실제 제출에 존재하고 전체 구간을 계속 참석할 수 있는 사람이 최소1명이어야 한다. 추천에 표시됐다는 앱 주장만으로 통과시키지 않는다. AI 상위3개와 동일해야 한다는 제약은 없으며 직접 선택도 같은 검증을 통과한다.
- STEP3 추천을 가져오기 전에 상태 revision을 읽어 결과에 연결한다. provider 대기 중 일정/멤버가 바뀌면 저장이 revision 충돌로 실패하고 새 추천/직접 선택을 유도한다. 최신 revision만 몰래 붙여 오래된 추천을 자동 저장하지 않는다.
- 저장은 `meeting_*`, `meeting_date`, `confirmed_slot`, stage, revision, ledger를 함께 반영한다. 시간 선택만으로 “약속 확정” 메시지는 만들지 않는다.

### 5.4 식당·약속 원자 확정

`confirm_room_appointment_v1(p_room_id uuid,p_restaurant_item_id uuid,p_expected_revision bigint,p_request_id uuid)` → 동일 mutation 응답.

검사: 현재 멤버인 방장 → `place` → 구조화 시간 존재/시작이 미래/만료 범위 → 후보가 이 방의 `kind='menu'`인지 → NULL profile 제외 최신 득표/정족수 → strict majority 및 배열 순서로 정한 최다 후보 일치. 이름·인원·득표·stage·confirmed_by를 입력받지 않는다.

한 트랜잭션에서 다음을 반영한다.

- `confirmed_menu_item_id`, `confirmed_menu`, `confirmed_menu_at`, `location_name`을 동일 후보로 설정.
- `stage='confirmed'`, `is_confirmed=true`, `appointment_confirmed_at/by`를 서버 시각·caller로 설정.
- revision/ledger와 시스템 메시지 1개. 메시지는 “약속을 확정했어요”와 저장된 시간·식당만 포함하며 `event_key='appointment-confirmed:<room_id>'`를 사용한다. 기존 unique event_key 방어와 함께 테스트한다.

동일 후보·동일 저장 시각의 이미 완료된 확정은 부수 효과 없이 성공으로 취급할 수 있다. 다른 후보로의 재확정은 `S4009`. 새 request이면서 revision이 오래됐으면 먼저 `S4005`로 새 상태 확인을 요구한다. 동일 성공 request replay는 revision/stage 조건보다 먼저 판정하되 권한 검사는 먼저 한다.

### 5.5 오류 코드

| SQLSTATE / symbol | 의미 / 앱 처리 |
|---|---|
| `42501/AUTH_REQUIRED`, `42501/NOT_ALLOWED` | 로그인 또는 접근 불가. 타방 존재·방장/메이트 세부 원인 노출 없음 |
| `S1001/TERMS_REQUIRED`, `S1006/CONSENT_CONFIGURATION_UNAVAILABLE` | S1 gate로 복귀/재시도. legacy fallback 금지 |
| `S1007/IDEMPOTENCY_CONFLICT` | 같은 request ID의 다른 요청. 자동 재시도 중단 |
| `22023/INVALID_INPUT`, `22P02`(UUID 인자 바인딩) | 타입·형식·지원하지 않는 kind/zone 등 일반 입력 오류 |
| `S4001/CANDIDATE_LIMIT_REACHED` | 종류별30개 상한. 기존 후보 삭제 안내 |
| `S4002/CANDIDATE_LABEL_INVALID` | POSIX [:space:] 양끝 정리 후 빈 값/char_length>120 또는 원문 제어문자 포함. 이름 수정 안내 |
| `23505/CANDIDATE_ALREADY_EXISTS` | 현재의 대소문자 무시 중복 정책 유지 |
| `S4003/ROOM_STAGE_CONFLICT` | 지금은 제출/선택/투표 불가. 상태 새로고침 |
| `S4003/ROOM_MEMBERSHIP_CLOSED` | `hint=operation=membership`. settling/done에서 코드 참가·초대 생성·수락 불가. 초대/참가 UI를 닫고 상태 새로고침 |
| `P0002`(정산 생성) | 방 만료 또는 방장 확정+30일 절대 상한 경과. 기존 만료 처리 사용 |
| `S4004/AVAILABILITY_INCOMPLETE` | eligible 0명 또는 전원 미제출. 상태의 제출 인원 표시 |
| `S4005/ROOM_REVISION_CONFLICT` | 일정/멤버/투표 등이 변함. 재조회 후 사용자 재결정 |
| `S4006/MEETING_TIME_INVALID` | 과거·만료 이후·범위 불일치. 선택/확정에서는 전체 구간 가능자 없음도 포함. preview는 가능자 0명을 정상 반환 |
| `S4007/MEETING_TIME_REQUIRED` | 최종 확정 전에 시간 선택 필요 |
| `S4008/VOTE_REQUIREMENT_NOT_MET` | `hint=operation=vote_confirmation`. 약속 확정 RPC: 후보 없음/다른 방/식당 아님/과반 미달/최다 아님 |
| `S4008/SETTLEMENT_REQUIRES_CONFIRMATION` | `hint=operation=settlement`. 정산 생성 RPC: 약속 확정 전 새 정산 불가. 방장·일반 멤버 모두 적용 |
| `S4009/APPOINTMENT_ALREADY_CONFIRMED` | 다른 내용으로 재확정 불가 |
| `S4010/LEGACY_RESELECTION_REQUIRED` | 구조화 불가한 time 후보·식별 불가한 식당 등. 최신 앱에서 재선택 |
| `S4011/REQUEST_LIMIT_REACHED` | 일정 변경 이력 actor1,000/방1,000×max(5,실제 인원) 상한. 방장 시간 선택·확정 및 동일 일정 재제출은 제외. 신규 변경 자동 재시도 중단. 성공 ID replay·조회 가능 |

`add_voting_item`의 시그니처/uuid 반환은 유지하되 S4001/S4002를 적용한다. 이름은 POSIX [:space:] 양끝을 정리하고 원문에 [:cntrl:] 또는 U+200B–200C, U+200E–200F, U+202A–202E, U+2060–2064, U+FEFF가 있으면 S4002로 거절한다. U+3164·U+115F·U+1160·U+2800·U+00AD·U+034F 및 공백·U+200D만 조합한 보이지 않는 이름도 거절한다. U+200D(ZWJ)는 눈에 보이는 이모지 조합에 허용한다. 레거시 후보 확정도 같은 검사로 메시지 주입을 차단한다. 이름 검사를 상한 검사보다 먼저 하여 둘 다 위반하면 S4002. JS 길이는 서버 Unicode 문자 수와 다를 수 있으므로 클라이언트 검증을 최종 근거로 삼지 않는다. 모든 DB 오류의 details/hint는 입력 원문 없이 반환한다. S4008은 message 문자열 대신 위 고정 operation hint로 분기한다.

### 5.6 정산 생성 추가 결정

create_room_settlement_v2와 레거시 create_room_settlement는 같은 private core의 현재 약관·멤버십·만료·방 잠금 뒤 S4008/SETTLEMENT_REQUIRES_CONFIRMATION을 검사한다. 새 bill은 confirmed 또는 appointment_confirmed_at IS NOT NULL인 settling/done에서 생성한다. 확정 증거 없는 레거시 settling/done은 새 bill이 거절되며 기존 미완료·미닫힌 bill 수정/재시도만 기존 권한·수취인 규칙을 유지한다. scheduling/place에 열린 bill이 있는 극단적 레거시 방도 정산 수정은 거절하고 운영 전 집계로 식별한다. 방장도 확정 전 우회할 수 없고 확정 뒤에는 기존처럼 실제 멤버가 정산을 시작할 수 있다. 트리거는 confirmed 또는 방장 확정 증거가 있는 done의 **새 bill INSERT**에서 settling으로 이동한다. 재정산은 settled_at=NULL로 이전 완료 카운트다운을 해제하고 expires_at=min(새 bill.created_at+7일, 최초 appointment_confirmed_at+30일)로 설정한다. 7일은 미완료 송금 처리 시간을 주며, 30일 절대 상한은 연속 재정산으로 방 보관 기한을 계속 연장하는 것을 막는다. 첫 confirmed 정산의 기존 방 기한도 방장 확정+30일을 넘기지 않는다. 활성 bill 수정/재시도는 기한을 바꾸지 않는다. 모든 열린 bill의 수취인이 완료되면 새 clock_timestamp()를 settled_at에 기록하고 expires_at=min(완료 시점+24시간, 최초 방장 확정+30일)로 설정한다. 방장 확정 증거 없는 레거시 방의 완료 기한은 기존 +24시간이다. 완료된 true 재시도는 기한을 연장하지 않는다. 기존 계좌 공개 종료·수취인 snapshot은 유지한다. 과거 방·정산 데이터는 보존하고, 확정 증거 없는 정산 stage는 legacy_settlement_unverified로 표시한다. 이 새 enum을 앱 runtime parser와 카드·정산 UI에 반영해야 한다.

기한이 지나면 미완료 bill이 있어도 기존 delete_expired_rooms가 방과 부속 참가·메시지·초대를 정리할 수 있다. bill의 room_id는 FK ON DELETE SET NULL로 분리되고 bill·수취인 snapshot·송금 완료 상태는 보존된다. 정산 완료 여부를 임의 변경하거나 계좌 공개를 임의 연장/종료하지 않는다. 원래 수취인은 기존 S1 권한으로 방 삭제 뒤에도 송금 정보 조회와 완료 처리를 할 수 있고, 전원 완료 시 계좌 공개가 닫힌다. 방 복구·정산 취소·채무 면제를 뜻하지 않는다.

## 6. 기존 RPC·RLS·grant와 우회 차단

### 6.1 기존 호출의 처리

| 기존 API | S4 서버에서의 동작 |
|---|---|
| `toggle_vote(uuid,uuid) → boolean` | 서명 유지. `place`에서 menu 투표만 변경하고 자동 확정 블록 제거. scheduling의 legacy time 투표는 보존하되 약속 확정에 사용하지 않는다. 그 밖의 stage 거절. 같은 toggle을 네트워크 오류 후 무조건 재호출하지 않는다. |
| `add_voting_item` / `remove_voting_item` | 후보·표 수정에 같은 stage/멤버십/만료 잠금 적용. 삭제는 기존 작성자 또는 방장만. 확정 식당 삭제 금지, 후보 삭제 시 해당 표 정리와 revision을 함께 반영. |
| `confirm_room_vote(uuid,uuid) → void` | menu는 새 원자 확정의 private core를 호출하는 호환 wrapper. 방장/시간/과반 조건은 동일. 이미 확정된 같은 식당은 no-op. time 라벨은 구조화 불가하므로 S4010; 방장 외에는 우선 NOT_ALLOWED. |
| `advance_room_stage(uuid,text) → text` | scheduling→place는 새 core의 null 시간 진입으로 연결하며 전원 제출 검사. place→confirmed 단독 변경 금지. 단, legacy 부분 확정에 유효 candidate ID가 있으면 같은 원자 확정 core로 복구 가능. 이미 원자 확정된 방의 후속 confirmed 호출은 현재 stage 반환 no-op. settling/done을 이 RPC로 새로 만들지 못한다. |
| `set_my_availability(uuid,text[]) → void` | 기존 시그니처/default 유지, 새 검증·stage 잠금 core 사용. 구클라이언트의 default/명시 null은 기존처럼 빈 배열 철회로 처리하되 신규 RPC는 null 금지. expected revision이 없는 구앱은 마지막 저장 우선이나 시간 선택 후 저장은 불가. 구조화 시간 없는 place에서는 본인 일정 수정 가능. |
| `room_availability_status` | 기존 반환형 유지. eligible 행만 반환하고 제출 판정은 새 규칙과 동일. 새 앱의 전체 표시행/제출 인원은 상태 RPC 사용. |
| `update_settlement_amount(uuid,integer)` | 미사용 우회 RPC의 함수 정의는 보존하되 PUBLIC/anon/authenticated EXECUTE 회수. 정상 정산 생성·수정은 기존 guarded core 사용. 폐쇄된 bill의 total_amount 변경은 내부 writer에서도 S1005로 차단. |
| `join_room_by_code` / `create_room_invitation` / `accept_room_invitation` | 현재 신원·약관 및 기존 코드/메이트/초대 대상 권한 검사 유지. 같은 방 advisory/row 잠금 뒤 settling/done이면 S4003, hint=operation=membership로 거절. 기존 accepted 초대 재수락도 거절. 정산 단계 전이와 업그레이드에서 pending 초대는 expired/responded_at으로 정리해 목록 반복 노출을 막고 accepted/declined/expired 행은 보존한다. scheduling/place/confirmed의 정상 참가·초대 멱등성 유지. |
| `room_availability_cells` | 서명 유지, 유효 멤버·만료·약관 재검사. NULL profile/잘못된/지난 칸 제외. 가능 칸 합집합 뜻 유지. |

compat wrapper는 새 public RPC를 별도 HTTP로 호출하지 않고 같은 트랜잭션의 private core를 사용한다. 구호출에 없는 request_id를 안정적인 재시도 키인 것처럼 임의 생성하지 않는다. 확정/단계는 현재 저장 상태 기반 자연 멱등성, 제출은 동일 슬롯 비교를 사용한다. 이후 요청이라도 권한·약관 재검사는 동일하다.

후보·투표 guard는 stage와 새 최종 확정 증거를 기준으로 통일한다. place에 남은 legacy confirmed_menu_item_id 또는 예전 time 확정의 is_confirmed=true만으로 모든 투표를 막지 않는다. 반대로 confirmed/settling/done은 is_confirmed 값이 잘못되어 있어도 변경 불가다. scheduling의 time 후보 추가/삭제/투표는 기존 자료 보존용으로만 허용하고 time 확정 API는 S4010으로 닫는다. scheduling→place 시 기존 is_confirmed를 false로 정규화하되 과거 완료 방을 되돌리지 않는다.

### 6.2 ACL 및 무결성

- 새/교체 public RPC는 필요한 제한된 데이터 조작 때문에 SD를 사용하되 `SET search_path=''`, 객체명 완전 수식, `SET timezone='UTC'`, 명시 신원·약관·현재 멤버·방장 검사. 동적 SQL 없음. 공통 데이터 검증 helper는 가능한 SECURITY INVOKER.
- 정확한 함수 시그니처별 PUBLIC/anon/authenticated/service_role EXECUTE를 일단 회수하고 **앱 endpoint만 authenticated**에 재부여한다. private core/ledger/trigger는 앱·service_role에 공개하지 않는다. 기존 S5 worker 전용 ACL은 변경하지 않는다. `CREATE OR REPLACE`가 기존 ACL을 안전하게 정리한다고 가정하지 않는다.
- rooms/participants 기존 RLS와 S1 restrictive policy 유지. 신규 public 테이블은 만들지 않는다. 새 열의 SELECT는 기존 관계·gate 안에서만 가능. 신규 열 INSERT/UPDATE는 부여하지 않는다. private ledger는 RLS ENABLE, 사용자 정책/직접 읽기·쓰기 권한 없음.
- rooms 직접 UPDATE/DELETE 차단을 유지하고 table/column grant를 모두 확인한다. 생성 시 기존 앱이 보내는 `is_confirmed=false,confirmed_slot=null` 열 권한은 유지할 수 있으나 INSERT WITH CHECK를 `stage='scheduling'`, 구조화 시간·확정 metadata null, `is_confirmed=false`, `confirmed_slot IS NULL`로 강화한다. 명시 stage/새 열 쓰기는 권한 자체가 없어야 한다.
- 새 방 생성 AFTER INSERT의 owner participant 등록과 revision 초기화를 검증한다. 생성 트랜잭션의 새 room row는 외부에 아직 보이지 않는 bootstrap 예외로 처리하며, 일반 경로에서 잠금 순서를 거꾸로 재사용하지 않는다.
- 정산 테이블/계좌 RPC, 개인 공개 스위치, S5 settings/catalog·worker·ticket 테이블 grants는 넓히지 않는다. `TO authenticated`만으로 멤버십을 대체하지 않는다. `private.is_room_member` 하나에 의존하지 않고 room expiry와 현재 participant를 잠금 뒤 명시 확인한다.

## 7. 마이그레이션 단위와 데이터 이전

과거 migration은 수정하지 않는다. 실제 파일은 구현 때 `supabase migration new <name>`으로 생성하여 S5 마지막 migration 이후 순서를 확보한다. 구현 파일은 `20261019022001_s4_meeting_time_storage.sql`, `20261019022005_s4_decision_core.sql`, `20261019022010_s4_activate_atomic_decisions.sql`, 별도 NULL 수취인 수정 `20261019022100_fix_settlement_null_participants.sql`, 정산 guard `20261019022110_s4_confirmed_settlement_boundary.sql`, 참석률 조회 `20261020010000_s4_meeting_time_preview.sql`, 재정산 lifecycle `20261020020000_s4_settlement_restart_lifecycle.sql`, 최종 금액 경계·초대 정리 `20261020030000_s4_revoke_update_settlement_amount.sql`이며 아래 논리 단위와 대응한다.

| 단위 | 내용 | 통과 조건 |
|---|---|---|
| M1 `s4_meeting_time_storage` | nullable 시간/확정 증거, revision, private ledger와 ACL. 기존 행은 기본값/null 유지 | S1+S5 fixture upgrade, 기존 문자열·stage·정산·만료 불변 |
| M2 `s4_decision_core` | 상태/제출/시간/확정 core와 신규 API 생성. 이 단계에서는 앱 EXECUTE 미부여 | 역할별 SQL 테스트, 멱등성·원자 rollback, 고정 search_path |
| M3 `s4_activate_atomic_decisions` | 자동 확정 제거, 모든 legacy wrapper·stage guard·revision writer 연계·생성 RLS 강화, 앱 EXECUTE와 capability 공개를 한 트랜잭션으로 활성화 | 모든 쓰기 우회·정족수·동시성·신구 앱 조합 검증 |
| 별도 NULL 수취인 수정 `20261019022100` | 새 정산 snapshot에서 NULL-profile 표시행 제외·NULL 비교 안전화. 기존 bill/수취인 보존 | 실제 멤버 1/2명 + NULL 표시행 정산·공개 종료 |
| 정산 경계 보강 `20261019022110` | confirmed 또는 방장 확정 시각이 있는 settling/done에서 새 정산, 증거 없는 이후 단계는 기존 진행 중 bill 재시도만 유지, 트리거 전환 제한 | v1/v2·방장/일반 멤버의 확정 전 거절·후 허용·재정산, 과거 데이터 보존 |
| 참석률 조회 `20261020010000` | 무잠금 STABLE 구간 집계 RPC와 선택/조회 공통 시간 검증. 데이터 변경 없음 | 다중 사용자·구간 경계·개인 정보 무반환·ACL catalog·읽기/쓰기 비차단 |
| 재정산 lifecycle `20261020020000` | 새 재정산에서 done→settling, 7일 재정산·확정+30일 절대 상한; 완료 후 24시간도 절대 상한 적용. 유효 기한이 남은 결함 사례만 복구 | cleanup·다른 열린 bill·solo·재시도·migration 재실행·계좌 종료 보존 |
| 최종 경계·초대 정리 `20261020030000` | 미사용 금액 RPC EXECUTE 회수, 폐쇄 bill 금액 보호, settling/done pending 초대 expired 정리 | ACL/실제 호출 거절·정상 수정/재정산·수취인/계좌 보존·이전 초대 정리 및 accepted 무변경 |

M1/M2는 additive 준비 단계이며 capability를 공개하지 않는다. M3 중간 상태를 외부에 노출하지 않는다. migration 사이에 새 앱이 capability만 보고 미완성 core로 진입할 수 없어야 한다. S1 보류 활성화 파일(M7)은 `supabase/release` 절차 그대로 두고 S4가 게시/동의를 대신 활성화하지 않는다.

이번 정산 보강의 운영 승인·검증 목록은 위 8개 파일 전체다. 마지막 보강은 미사용 update_settlement_amount의 PUBLIC/anon/authenticated EXECUTE 회수, 폐쇄 bill 금액 변경의 S1005 차단, settling/done 전이 및 기존 방의 pending 초대 expired 정리를 포함한다. 기존 S4 capability가 있다는 사실만으로 뒤의 NULL/정산 guard·참석률 조회까지 적용됐다고 판단하지 않는다. 마지막 migration identity와 실제 함수 정의·권한을 확인한다.

20261020020000은 **appointment_confirmed_at이 있는 done + 공개 종료 전 미완료/빈 수취인 bill**, 또는 과거 구현의 무기한 settling 재정산만 복구한다. 최초 조회와 advisory/room 잠금 뒤 모두 expires_at>clock_timestamp()인 방만 대상으로 하며 만료 방은 되살리지 않는다. done 방은 min(가장 오래된 열린 bill.created_at+7일, 최초 확정+30일)이 이미 지났어도 복구하지 않는다. 과거 무기한 settling은 단계 변경 없이 원래 상한으로 기한만 단축하며 그 상한이 과거이면 즉시 만료 대상으로 둔다. 복구 기한은 이 원래 시각들을 사용하며 배포 시각으로 새 기한을 만들지 않는다. 기존 완료 bill·계좌·수취인·방장 확정 증거는 재작성하지 않는다. 미확인 레거시 done과 실제 완료 방은 보존하며 재실행은 무변경이다.

운영 전 s4_legacy_place_inventory.sql은 시간 미선택 place·확정 전 열린 bill 외에 expired_owner_confirmed_done_with_open_bill(복구 제외 건수), rooms_with_nonfinite_expiry를 읽기 전용 집계한다. 새/복구된 재정산의 expires_at는 유한 ISO 시각이다. 앱 파싱 형식 변경은 없으며 settling의 기한은 재정산 보관 상한, done의 기한은 완료 후 정리 기한으로 구분한다. Edge는 남아 있는 비유한 만료를 유효한 방으로 취급하지 않는다.

### 7.1 기존 방별 처리

| 기존 데이터 | 이전/복구 정책 |
|---|---|
| confirmed/settling/done | 새 lifecycle migration의 위 결함 복구 대상만 예외. 그 외 현재 stage·식당·투표·만료·정산 그대로. `appointment_confirmed_at/by`를 backfill하지 않는다. 시간 없거나 불명확해도 과거 확정을 취소하지 않는다. confirmed는 legacy_confirmed, 정산 stage이면서 명시 확정 증거가 없으면 legacy_settlement_unverified로 구분한다. 정산 단계만으로 약속 확정을 추정하지 않는다. |
| scheduling | 구조화 시간 null, revision 초기화. 제출 가능한 실제 사용자로 정족수 재계산. 기존 slots를 KST 규칙으로 읽되 유효하지 않은 값은 집계 제외하고 재제출 안내. |
| place, 식당 확정 없음 | 기존 후보/표 유지. 방장이 시간 선택 후 원자 확정 가능. 기존 `location_name`만으로 식당 확정 성공을 인정하지 않는다. |
| place, confirmed_menu와 유효 menu item ID 있음 | `legacy_partial`. 자동 stage 변경 없음. 방장이 시간과 식당을 확인해 원자 확정. 최신 과반/최다 조건을 다시 검사하고 충족되지 않으면 표 변경을 허용한다. legacy 식당 저장 흔적만으로 투표를 영구 잠그지 않는다. |
| place, confirmed_menu 있으나 candidate ID 없음/불일치 | label 동일성만으로 ID를 지어내지 않는다. 상태에 legacy_partial 표시, 방장이 실제 후보를 재선택하고 현재 득표로 확정하면 옛 흔적을 함께 교체한다. |
| 과거 자동 확정으로 stage만 confirmed이고 menu ID 없음 | 이미 확정된 방으로 보존. label로 새 ID나 방장 확인 증거를 만들어 넣지 않는다. |

이전 시간 문자열의 offset 포함 ISO 시작값만으로 종료 시각을 추정하지 않는다. `meeting_date`가 최초 방 만료 기준 날짜일 수 있으므로 연도 추정 근거로 쓰지 않는다. 검증 가능한 시작·종료·zone 세 가지 근거가 있는 행만 **별도 승인된 이전 작업**에서 변환할 수 있다. 기본 S4 migration은 시간 backfill 0건이다.

새 식당 선택이 성공하면 과거 부분 확정 라벨은 새 canonical 값으로 바뀌지만 기존 시스템 메시지는 삭제/조작하지 않는다. 화면은 현재 방 상태를 우선하고, 예전 “메뉴 확정” 메시지가 최종 확정 증거가 아님을 구별한다.

### 7.2 롤백

신규 열/ledger를 drop하거나 S1/S5 이전 스키마로 되돌리지 않는다. 문제 발생 시 S4 mutation을 중지하고 읽기·재시도 안내 상태로 두는 forward fix를 우선한다. `toggle_vote` 자동 확정 및 잠금 없는 stage 함수를 복원하면 이미 형성한 보안·정합성 계약이 깨진다. capability 제거로 새 앱이 자동 legacy mutation으로 내려가도록 만들지 않는다. 원자 확정된 방을 place로 되돌리거나 정산 계좌 공개를 재개방하지 않는다. 실제 역마이그레이션·데이터 보정은 대상/영향/검증을 별도 승인받는다.

## 8. 앱 변경 목록과 화면 흐름

| 파일/화면 | 변경 |
|---|---|
| `src/lib/roomDecisions.ts` 신규 | S4 probe, 응답 runtime 검증, 상태/제출/시간/확정 API, request ID 관리와 오류 매핑. unknown 응답은 실패로 취급 |
| `src/lib/rooms.ts` | RoomSummary에 nullable 구조화 시간·revision·확정 증거 추가. legacy/S4 SELECT projection 분리. createRoom의 시간 주입 제거, 실제 약속일과 생성 기한 구별 |
| `src/lib/meetingTime.ts` 신규, `scheduleSlots.ts`, `roomFormat.ts` | KST 날짜/칸/시간 변환과 공통 표시. 확정 시각용 기기 로컬 파싱·라벨 연도 추정 제거. 개인 캘린더의 시간 정책을 무관하게 일괄 변경하지 않음 |
| `src/lib/availability.ts`, `src/lib/voting.ts` | S4 상태·mutation 분기. eligible 필터를 득표 분자/분모 모두 적용. legacy 22023은 일반 후보 입력 실패로 표시, S4001/S4002만 구체 안내 |
| `ScheduleDetailScreen.tsx` | 기존 방 생성 유지. 생성 기한은 KST 날짜 변환으로 일관되게 계산하되 7일 정책 자체는 S3로 넘김. 아직 선택되지 않은 meeting_date를 약속 확정으로 보이지 않게 함 |
| `ScheduleTimeScreen.tsx` | KST 격자·서버 제출 상태/오류. 빈 배열 철회 흐름은 명시 버튼 또는 확인 안내. 선택 완료 후 서버 성공에만 이동. S4 지원 시 전원 미제출이면 기다리는 상태와 채팅 진입 제공 |
| `ScheduleConfirmedScreen.tsx`, `scheduleTypes.ts`, `scheduleState.ts` | chosen 전체 구간 저장. 성공 응답 후에만 식당 시트로 이동. loading/전원 미제출/오래된 추천/지원 불가 분리. 직접 시간 선택은 기존 격자 재사용, AI 실패가 시간 선택을 영구 막지 않음 |
| `ScheduleSheet.tsx` | 서버 all_submitted 사용, NULL profile은 대상 아님 표시. 저장 전 재조회는 UX 보조일 뿐 서버 원자성 주장 금지. 전원 제출 뒤 방장 CTA를 STEP3 시간 선택으로 연결하고, 추천 없이 place로 가는 선택은 명시 안내. place에서는 방장에게 시간 선택/수정 진입점 제공 |
| `VotingSheet.tsx` | S4는 원자 확정 1회. 시간 미정이면 시간 선택 진입점, 과반 미달/충돌이면 최신 상태 표시. 전원 투표 완료는 “방장 확인 대기”. legacy 두 호출·부분 성공 retry는 pre-S4 분기에서만 유지 |
| `ChatRoomScreen.tsx` | 구조화 시간·서버 상태 전달, 최종 성공/Realtime/재접속에서 invalidate/refetch. 이벤트 중복 도착으로 확정 메시지를 추가 작성하지 않음 |
| `ChatRoomSheets.tsx` | 정산 시트의 기존 생성·계좌·고정 수취인 흐름 유지. stage가 정산으로 전진하면 열려 있던 S4 시트를 닫거나 읽기 전용으로 전환; generic advance로 정산 단계를 쓰지 않음 |
| `MeetingCard.tsx`, `RoomRow.tsx`, `RoomDetailScreen.tsx`, 최종 PlanConfirmation | 동일 `formatMeetingTime` 사용. “선택된 시간”과 “약속 확정” 구별. 구조화 null/legacy label/종료시각·timezone 표시 통일 |
| `ScheduleHomeScreen.tsx` 및 홈/채팅 목록 소비자 | 실제 방 시간 표시를 쓰는 경로만 공통 formatter 적용. 현재 개인 일정 캘린더의 별도 데이터를 방 meeting_date로 대체하지 않음 |

시간 추천 Edge의 기존 v1 경로는 eligible 사용자만 분자/분모에 넣고 KST 유효 칸·과거 칸을 정규화하도록 최소 보강한다. 구조화 저장 시 DB가 참석 가능 여부를 다시 판정하므로 provider 결과만으로 확정하지 않는다. S5 v2 `purpose='places'`, `slots_status='not_requested'`, `evidence_status='unverified'`, `my_health_filter='not_requested'`는 유지한다. S4 RPC 사용에 새 Edge 배포 완료를 필수 조건으로 삼지 않으며 직접 선택 경로를 제공한다. S4 활성화 시 S5 추천 context의 room fingerprint에 stage·선택 시간·appointment_confirmed_at을 추가한다. provider 대기 중 이 결정이 바뀌면 기존 S5003으로 결과를 폐기한다(응답 필드/새 오류 없음; 단순 투표나 안내 탭만으로 추천을 무효화하지 않음).

## 9. 앱 선배포 호환 전략

지원 상태는 backend별 `unknown | legacy | s4 | error`. 세션/사용자 전환과 backend 변경 시 캐시를 분리·폐기하고 재접속/foreground/재시도로 probe한다. 로그아웃 시 방 데이터/request cache를 비운다. 한 번 S4를 확인한 backend가 RPC 오류를 내면 자동 legacy 강등하지 않고 장애로 처리한다.

| 조합 | 동작 |
|---|---|
| 새 앱 + S1 이전 서버 | 기존 S1 legacy 게이트 계약을 그대로 적용. S4는 미지원이며 기존 room projection/기존 두 호출 흐름만 사용. 새 시간 저장 성공을 표시하지 않음 |
| 새 앱 + S1 또는 S1+S5, S4 없음 | 약관 완료 후 S4 probe에서 정확한 함수 부재만 legacy로 분류. 선택 시간 저장은 미지원 안내. 기존 식당 확정 retry 유지 |
| 새 앱 + S4 | S4 조회/원자 mutation 사용. capability의 bool/버전을 검증하고 일부 기능만 누락된 응답은 실패 처리 |
| 구앱 + S4 | 기존 서명 유지, 자동 확정 없음. menu 확정 wrapper는 원자 처리, 후속 advance는 no-op. 시간 미정/legacy time은 S4007/S4010으로 안전하게 중단되며 최신 앱의 시간 재선택 필요 |
| 새 앱 + probe timeout/401/403/5xx/잘못된 JSON | 미지원으로 해석하지 않는다. 재시도/로그인/약관 안내, mutation 차단. schema cache 지연도 이미 S4 확인했다면 장애 취급 |

최초 probe의 `get_s4_capabilities`에 대한 **정확한 함수 부재**(`PGRST202`, 서버가 명시적으로 반환한 해당 signature의 `42883`)만 legacy 증거로 인정한다. 내부 helper 부재·일반404는 아니다. capability는 있는데 mutation이 없는 상태는 배포 불완전이며 legacy로 우회하지 않는다. 구서버에 없는 열을 기본 rooms SELECT에 넣지 않는다.

pre-S4에서 선택한 추천 시간을 로컬만 저장해 확정값처럼 보여 주지 않는다. 미지원 안내 후 기존 “추천 없이 식당 정하기”로 이어 가며 time=null을 유지한다. 자동 확정이 남은 구서버의 결과도 새 앱이 방장 확정이라고 주장하지 않는다. **앱 선배포 호환은 구서버에서 S4 보장을 제공한다는 뜻이 아니다.**

구앱의 모든 새 기능 완료까지 보장하지는 않는다. 특히 시간 없는 방의 최종 확정에는 업데이트가 필요하므로 운영 활성화 전에 최소 베타 버전과 업데이트 안내가 준비돼야 한다. 사라진 시스템 메시지 응답이나 mutation timeout 뒤에는 상태 재조회/동일 ID 재시도로 복구하고 “식당만 저장 성공” 상태를 S4 UI에서 만들지 않는다.

## 10. 다중 사용자·동시성·앱 검증 계획

아래는 구현 검증의 요구 목록이다. 실제 실행 결과·통과 수·미검증 범위는 `supabase/tests/S4-A-REPORT.md`에 기록한다. fixture는 전부 가상 데이터다. SQL source 검사만으로 SQL 실행·동시성을 대체하지 않는다.

### 10.1 DB 권한/데이터 테스트

- A 방장+participant, B 같은 방 메이트, C 다른 방, D 초대 대기, E 탈퇴, F participant 없는 owner, NULL profile 표시행, anon, 약관 pending, service_role로 실제 JWT 역할을 전환한다. GET/제출/선택/확정/legacy wrapper 전부 검사한다.
- 방장 없는 멤버의 확정, owner ID 위조, 다른 방 candidate, 없거나 만료된 방, 접근 불가 room ID, 타인 request replay는 거절하고 부수 효과 0건. public/private 함수 ACL, table/column ACL, RLS gate, 고정 search_path를 catalog로 검증한다.
- INSERT에 확정 시각·is_confirmed=true·stage 주입, rooms 직접 UPDATE, participant 일정/표 직접 UPDATE, private ledger 읽기/쓰기, trigger/core 직접 실행이 차단되는지 검사한다. 정상 구형 createRoom(false/null)도 통과해야 한다.
- eligible 0/1/2/3명, NULL profile 여러 행, NULL profile의 가짜 표, 초대 대기, 빈 제출 철회, 지난 슬롯만 남은 제출, 실제 사용자 미제출에 대한 all_submitted 및 majority를 검사한다.
- 잘못된 윤일/2월30일/offset 누락/다른 zone/종료<=시작/자정 경계/UTC 날짜와 KST 날짜 차이/과거·만료 시각 정확한 경계, 다차원/null/중복/501칸/빈 배열/UTF-8 이름 경계를 검사한다.
- 전원 투표에도 stage가 place이고 메시지 0건, 방장 명시 확정에만 식당/시간/stage/확정 증거가 일치하고 메시지1건. strict majority, 동률 배열 순서, no vote, 다른 최다 후보, 삭제된 후보 검사.
- 확정 UPDATE 이후 메시지 INSERT 직전에 의도적 오류를 일으켜 전부 rollback되는지 확인한다. 같은 request·다른 payload/다른 operation/다른 room, 같은 식당 재시도, 다른 식당 재확정, 재시도 이후 settling/done에서 시간/만료/정산 데이터가 그대로인지 검사한다.
- M1 준비 상태, M2 비공개 상태, M3 활성화 상태 및 S1+S5→S4 upgrade fixture를 검증한다. 각 레거시 방 유형의 문자열·stage·표·정산·만료 보존과 backfill 0건을 확인한다.

### 10.2 실제 다중 세션 경쟁 테스트

PowerShell에서 격리 로컬 DB 연결 두 개 이상과 명시 barrier/lock 대기를 사용한다. 실제 순서를 관찰하지 않은 순차 호출을 경쟁 테스트라고 보고하지 않는다.

| 경합 | 허용 결과 |
|---|---|
| 마지막 제출/철회 vs scheduling→place | 먼저 잠금을 얻은 결과를 뒤 요청이 재검증. 시간 선택 뒤 schedule 수정 없음; 시간 없이 place 진입 시 제출 허용 |
| 두 방장 기기의 다른 시간 선택 | 한 요청 성공, 다른 요청 revision 충돌. 식당 단계에 예전 시간 덮어쓰기 없음 |
| 마지막 투표 vs 방장 확정 | 표 먼저면 최신 revision/득표로 재결정; 확정 먼저면 표 변경 거절. 자동 확정 0건 |
| 후보 삭제/추가 vs 확정 | 잠금 순서대로 한 일관된 결과. 지워진 후보 확정이나 orphan vote 없음 |
| join/accept vs 전원 제출·과반 확인 | 새 멤버가 먼저면 정족수/revision 반영. 전환이 먼저면 이미 저장한 시간은 유지하고 새 멤버는 제출 불가 안내. 최종 식당 확정은 그 시점 멤버 기준 |
| leave/방 닫기 vs S4 저장 | 권한/존재 재검사. 사라진 방에 ledger/메시지 잔존 없음 |
| 동일 request 병렬 재시도 및 다른 방에서 ID 충돌 | 한 부수 효과, 충돌 요청은 S1007, 메시지1건. PK 충돌을 성공으로 오인하지 않음 |
| 약관 재동의/유효성 변경 또는 방 만료 중 lock 대기 | 잠금 뒤 최신 gate/시각 적용. 실패 요청에 상태 변화 없음 |
| 정산 생성/완료 vs 시간 선택·확정 | 확정 전 새 정산은 S4008. 최종 확정 뒤 정산 시작만 허용. 기존 정산 완료가 먼저면 S4 변경 거절. stage 후퇴·계좌 재공개·deadlock 없음 |
| S5 settings/추천 begin/finalize vs S4 확정 | 공통 방 잠금 순서 준수, provider 대기 중 잠금 없음. S5 context 재검증 및 개인정보 최소화 불변 |

현재 `leave_room`은 방장 방 닫기 기능이므로 메이트 나가기 경쟁을 구현됐다고 주장하지 않는다. S3/S2가 participant 삭제·profile FK 변경을 추가할 때 S4 revision/잠금 계약을 다시 검증해야 한다.

### 10.3 앱·회귀·완료 조건

- `meetingTime`, `scheduleSlots`, API 응답 검증/오류 매핑/지원 여부 조합 단위 테스트. 서울·UTC·미국 기기 timezone에서 같은 약속 문자열을 확인한다. 일반22023을 후보30개 초과로 오인하지 않아야 한다.
- 기존 `tests/scheduleV3.test.js`, `tests/chatScheduleV3.test.js`, `tests/scheduleSlots.test.ts`, `tests/votingLeader.test.ts` 회귀. S1 약관·공개/정산 계좌 및 S5 음식/건강/추천 테스트도 재실행한다.
- 렌더/상호작용: 새 방→초대 수락→각자 제출→추천/직접 시간 선택→식당 후보 추가→전원 투표에도 대기→방장 확인→홈/채팅/상세/시트가 같은 시간→앱 재시작 후 유지. 일반 메이트에게 확정 CTA 없음, 강제 RPC도 거절.
- 추천 없음·구서버·probe 실패·상한/긴 이름·철회·만료·응답 유실·시트 닫기·중복 탭·두 기기·부분 확정 레거시 복구를 실제 화면에서 확인한다. 기존 API/신규 API 모드를 각각 실행한다.
- 구현 완료 시 비례적인 focused test 후 `npm run quality`, 로컬 SQL fresh reset/upgrade 및 실제 다중 세션 스크립트. fixture/mock 화면 성공과 실제 Auth/DB/Edge/provider E2E는 분리 기록한다. remote 미실행이면 명시한다.
- 보안·권한·데이터 경계 변경이므로 구현 diff와 테스트 결과로 독립 코드 검토 및 최종 승인을 거친다. 이 설계 문서만으로 보안 수용·출시 완료를 선언하지 않는다.

## 11. 작업 분할과 운영 승인

### 11.1 파일 소유권

| 작업자 | 단독 소유 범위 | 전달물 |
|---|---|---|
| DB 작업자 | 신규 `supabase/migrations/*_s4_*.sql`, 신규 `supabase/tests/s4_*.sql`, `supabase/tests/s4_concurrency.ps1`, S4 DB 보고서; 시간 추천 보강이 필요한 `supabase/functions/schedule-recommend/**`와 관련 Edge 테스트 | 정확한 RPC/오류/JSON fixture, ACL 목록, 이전 fixture, SQL/동시성 결과와 파일:줄. 기존 S1/S5 migration 수정 금지 |
| 앱 작업자 | §8의 `src/lib`, `src/screens/schedule`, `src/screens/chat`, 관련 `src/components` 파일과 앱 `tests/**` | capability 분기·화면·formatter, focused/quality 결과, 실제 화면 흐름·시간대 증거. DB/Edge 파일 수정 금지 |
| 조정/검토 | 계약 변경 승인과 diff 확인. `docs/S4-design.md` 계약 변경은 조정자가 한 명의 문서 작성자에게 맡김 | 계약 차이·범위 밖 문제·독립 보안 검토 기록 |

현재 구현은 §12 확정 → §5 RPC 고정 → DB/앱 각 소유 범위 구현 → 통합 검증 순서다. 동일 파일에 두 작성자를 배정하지 않는다. 앱/DB가 병렬 진행하더라도 새 응답 field/에러 코드 변경은 문서에 먼저 합의한다.

### 11.2 운영 반영 전에 따로 승인할 항목

1. 대상 프로젝트와 정확한 migration 목록(M1~M3 및 필요한 S1/S5 선행 migration), 기존 원격 history drift 처리. read-only linked inventory와 legacy 분류 **집계**는 별도 운영 점검에서 확인한다. 실제 행 개인정보를 보고서로 복사하지 않는다.
2. S1 보류 약관 활성화/법률 원문 정합성 승인. S4 migration이 이를 대신 승인하지 않는다.
3. 원격 schema/RPC/grant/RLS 변경 실행, 예외적인 legacy 시간 backfill/데이터 보정, 역마이그레이션. 기존 방을 자동으로 확정/미확정으로 바꾸는 배치 승인과 혼동하지 않는다.
4. 시간 추천 Edge 보강 배포와 실제 provider 비용 호출. DB 배포와 별개로 승인하고, S5 v2 식당 경로가 유지되는지 검증한다.
5. 앱 베타/공개 릴리스·최소 지원 버전·업데이트 안내. commit/push/PR도 사용자 명시 요청 전에는 하지 않는다.

승인된 반영 뒤에는 migration/function identity·실제 ACL 확인, 다중 사용자 격리, 앱 실제 왕복 저장/재접속, S1 계좌 종료·S5 추천 회귀, security advisor를 다시 확인한다. cron/Auth 설정/secret 변경은 S4에 필요하지 않으며 추가하지 않는다.

## 12. 사용자 확정 결정 (7건 모두 권장안 승인)

| 확정 항목 | 사용자 확정 결정 | 적용 계약 |
|---|---|---|
| 시간 없이 식당 단계/최종 확정을 허용할까? | `place` 진입은 허용, **최종 확정에는 시간 필수**. 구앱은 필요 시 업데이트 안내 | `requires_time_for_confirmation`, S4007, 구앱 호환 범위. 시간 미정 확정 허용 시 명시 확인 UI/별도 플래그 필요 |
| STEP3와 일정 시트 모두 전원 제출 뒤 진행할까? | eligible 실제 사용자 전원 제출을 두 진입점에 동일 적용. 초대 대기자는 제외 | 현재 STEP3의 조기 전환은 막힘. 미동의/장기 미응답 멤버 제외는 S3 정책 없이 임의로 추가하지 않음 |
| “가능한 시간 없음”도 제출 완료로 볼까? | S4에서는 현행대로 빈 배열=철회/미제출. 필요하면 별도 `unavailable` 상태를 후속 설계 | 별도 상태 도입 시 schema·정족수·교집합 없음 UX를 함께 변경해야 함 |
| 추천 선택 구간은 전원이 가능해야 할까? | 전체 구간 가능자 최소1명, 참석률 확인 후 방장이 선택. 전원 공통만 강제하지 않음 | DB 시간 검증, 추천/직접 선택 UI. 부분 참석 허용을 명확히 안내 |
| 식당 확정의 과반/최다/동률 규칙을 유지할까? | strict majority + 최다 + 배열 순서 tie-break 유지. 방장이 무투표 임의 후보 확정 불가 | 단순 “방장만”과 다른 제품 정책이므로 임의 완화 금지 |
| 시간대와 선택 범위는? | S4는 `Asia/Seoul`, 기존11~21시 정각·같은 날짜. 최종 확정 전 방장만 수정 | 해외/DST/자정 넘김/분 단위는 별도 확장. 단일 시각 저장으로 종료를 잃지 않음 |
| legacy 시간·부분 확정 처리에 동의하는가? | 시간 자동 backfill 없음. 완료 방 보존, 진행 방은 방장 재선택/현재 투표 재검증 | 원문 기반 일괄 추정 또는 과거 자동확정을 방장확정으로 인정하지 않음 |

2026-10-19 사용자 지시로 위 7개 권장안을 모두 확정했다. 제품 결정을 다시 묻지 않고 §5 계약으로 구현한다. 운영 접근·배포·커밋 승인은 포함하지 않는다.

## 13. 초기 설계 작성 시 확인 범위 (구현 전 기록)

로컬 AGENTS, S1/S5 명세, WORKFLOW/Figma 로컬 문서, S4 관련 앱·최신 migration·Edge 소스를 대조했다. `git diff --no-index --check -- NUL docs/S4-design.md`에서 공백 오류가 없었고, Git status로 신규 문서와 기존 S1-release 변경만 있음을 확인했다. SQL 실행, 앱 테스트, `npm run quality`, 실제 UI, 원격 migration/ACL, 실제 provider, 독립 보안 검토는 이번에 수행하지 않았다. 설계가 구현됐거나 운영에 적용됐다는 결론은 내리지 않는다.

공식 기술 참고: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)의 SD search_path/EXECUTE 제한, [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)의 row/advisory lock과 잠금 순서 원칙을 확인했다. 이는 위 프로젝트별 계약의 설계 근거이며 실행 검증을 대신하지 않는다. Supabase changelog markdown은 도구의 content-type 제한으로 읽지 못했으며, 실제 구현 전에 관련 변경과 로컬 CLI 버전을 재확인한다.
