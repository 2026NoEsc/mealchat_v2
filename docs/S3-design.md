# S3 구현 명세: 방 생명주기·메이트 나가기·초대

작성·결정 승인: 2026-10-21. 확인 기준: 로컬 `Develop`, `HEAD 2a99831`, 최초 작성 시작 시 Git 변경 없음. **사용자는 D1 A, D2 A, D3~D12의 권장안을 승인했다.** §12가 승인된 제품 정책이며 본문은 그 구현 계약이다. 이번 수정 시작 시 이 문서만 untracked였다. 구현·독립 보안 검토·운영 반영 승인은 별개다. 이 작업의 산출물은 이 문서 하나이며 코드·마이그레이션·다른 문서는 변경하지 않는다.

진행 순서: S1 공개·동의·약관 → S5 일부 → S4 일정·식당 확정 → **S3** → S2 계정 삭제 → S5 나머지·S6 정산·S7 알림·신고. S4 `25cc26e`·`2a99831` 완료·운영 미적용은 작업 요청의 전제다. 원격 이력은 조회하지 않았으므로 배포 상태를 독립 검증한 주장은 아니다.

## 1. 범위와 유지할 계약

범위는 일반 메이트 나가기, 방장 위임/방 종료, 초대 코드 발급·만료·재발급·시도 제한·최소 미리보기, 방 생성 수명 상한(R2), 단계별 만료·삭제 실행, 앱의 S3 지원 감지와 P04 연결이다. D6 A에 따라 M01 초대 웹·딥링크·카카오 전용 공유는 이번 출시에서 제외한다. R1 시스템 메시지 위장 회수는 베타 사용 근거 확인 후 S3에서 처리한다.

다음 경계는 유지한다.

1. S1 필수 약관 gate와 프로필 공개 범위, 정산 생성 때 고정한 수취인·계좌 공개 종료 계약을 보존한다. 방 나가기는 계정 탈퇴가 아니며 프로필이나 기존 정산 수취인을 삭제하지 않는다.
2. S4의 명시적 방장 확정, `s4_revision`, 방 단위 잠금, 정산 확정 전 시작 금지, `settling/done` 신규 참가 금지(S4003)를 유지한다. 완료 방의 재정산 허용과 최초 확정 시각은 위임으로 초기화하지 않는다.
3. `20261020040000`의 송금 완료 후 금액·분모·송금 목적지 잠금을 유지한다. 나가기·위임·삭제로 금액을 재분배하거나 미완료자를 완료 처리하지 않는다.
4. S5 공용 지역·STEP 1 집계·ticket 재검증을 유지한다. 탈퇴자의 취향을 새 공동 추천에 사용하지 않고, 건강·개인 출발지 정보를 초대나 나가기 응답에 넣지 않는다.
5. S2의 사용자 결정: 본인이 방장인 진행 중 방 또는 본인이 포함된 미완료 정산이 있으면 계정 삭제를 막고, 정산까지 끝난 방은 허용한다. 계정 탈퇴 후 남은 기록은 “탈퇴한 메이트”와 금액 보존이다. S3는 이 계정 삭제·익명화를 구현하거나 기존 FK가 이를 보장한다고 주장하지 않는다.

제외: 계정 삭제 실행, 정산 취소/면제/재분배·새 정산 모델, 강퇴·차단·신고, 알림 채널/푸시, 새 메뉴 추천, 운영 적용, Figma 수정. 정산 취소 시안은 S3 구현 근거로 사용하지 않는다. 법률 문구는 기술 계약과의 불일치를 제시할 뿐 법률 적합성을 승인하지 않는다.

## 2. 현재 상태와 근거

아래 파일:줄은 위 HEAD에서 확인했다. 과거 문서의 “구현 완료”와 실제 앱/서버 상태를 구분한다.

| 근거 | 현재 상태 / 설계에 미치는 영향 |
|---|---|
| `docs/S4-design.md:16`, `supabase/tests/S4-A-REPORT.md:45`·`:46` | S3로 나가기·초대 TTL/실패 제한·삭제 정책을 이관. R1 메시지 위장, R2 생성 수명 상한 부재가 후속 과제다. |
| `src/lib/rooms.ts:388`·`:394`, `supabase/migrations/20261017095000_s1_terms_access_gate.sql:312`·`:342`·`:349`·`:360` | 앱 주석은 참가행 삭제를 말하지만 최종 `leave_room`은 **방장만** 호출 가능하고 미완료 수취인이 없으면 방 전체 DELETE다. 일반 메이트 나가기 RPC로 재사용하면 안 된다. 빈 수취인 bill은 이 JOIN 검사로 잡히지 않는다. |
| `src/screens/chat/RoomDetailScreen.tsx:55`·`:135`·`:143` | 방장 삭제만 연결. UI는 settling이면 막지만 서버는 실제 미완료 수취인으로 검사하므로 주석/단계만으로 권한을 설명하면 틀린다. 메이트 버튼은 TODO다. |
| `src/lib/rooms.ts:426`·`:463`·`:477` | 클라이언트 `Math.random`으로 6자 코드를 만들고 `expires_at`을 INSERT한다. 성공 뒤 보낸 코드로 방을 다시 찾는다. 서버가 구 INSERT의 코드를 조용히 바꾸면 생성 성공 후 조회가 깨진다. |
| `supabase/migrations/20260823072701_harden_settlement_invitation_events.sql:926`, `20261019022010_s4_activate_atomic_decisions.sql:104` | INSERT 컬럼 grant에 code/expires_at가 남아 있고 최종 생성 RLS에도 유한 기한·상한 검사가 없다. RLS와 grant를 각각 수정해야 한다. |
| `supabase/migrations/20261019022010_s4_activate_atomic_decisions.sql:121`·`:139`·`:162`·`:173`·`:253`·`:374` | 코드 일치+방 기한으로 참가, settling/done 차단. 대상자 초대는 expires_at에 방 기한을 복사한다. 별도 코드 TTL/실패 제한은 없다. |
| 같은 migration `:198`·`:206`·`:211`·`:226` | 초대 수락은 advisory → invitation row → room row 순서다. S3는 advisory → room row → 후속 행으로 통일해야 한다. 현재 구현이 이미 그 순서라고 가정하지 않는다. |
| `supabase/migrations/20261019022001_s4_meeting_time_storage.sql:14`, `20261019022010_s4_activate_atomic_decisions.sql:3`·`:11` | S4 ledger는 room DELETE에 CASCADE. room 주요 변경·participant 변경이 revision을 올리며, participant를 잠근 뒤 advisory를 얻는 경로를 금지한다. |
| `supabase/migrations/20261019022005_s4_decision_core.sql:41`·`:45`·`:49` | S4 공통 쓰기는 방 advisory → rooms FOR UPDATE → 정렬한 profiles 순서, 이후 권한·만료를 재검사한다. |
| `supabase/migrations/20261020020000_s4_settlement_restart_lifecycle.sql:8`·`:12`·`:27`·`:32` | 재정산 min(새 bill+7일, 최초 확정+30일), 모든 열린 bill 완료 후 min(완료+24시간, 최초 확정+30일). 최초 confirmed 정산은 기존 기한을 30일 상한으로 제한한다. |
| `supabase/migrations/20261020040000_s4_lock_amount_after_payment.sql:126`·`:168` | 비작성자 수취인이 한 번 송금 완료하면 금전 조건 변경 거절. 새 bill만 현재 실제 참가자를 수취인으로 고정하고 기존 bill은 바꾸지 않는다. |
| `supabase/migrations/20260907160000_drop_expired_rooms_cron.sql:14`·`:24`, `20261017095000_s1_terms_access_gate.sql:1073`, `src/lib/rooms.ts:229` | 과거 cron을 해제하고 앱 목록 조회가 청소 RPC를 호출하는 구조. 최종 청소는 S1 gate 뒤 전체 만료 방 DELETE이며 방 advisory를 얻지 않는다. 앱이 안 열리면 물리 삭제 시각을 보장하지 못한다. |
| `supabase/migrations/20260817000000_remote_schema.sql:340`·`:345`·`:350`·`:365`·`:385` | 방 DELETE는 bill.room_id를 NULL로 분리하고 채팅·참가행을 CASCADE한다. 수취인은 bill에 연결된다. profile 삭제에는 별도 CASCADE가 있으므로 S2 익명화는 후속 설계가 필요하다. |
| `src/legal/privacy.ts:8` | 채팅을 “방이 사라질 때(정산 뒤 24시간)까지” 보관한다고 안내. 재정산 연장, 미정산 만료, 수동 삭제, cleanup 지연이 설명되지 않는다. |
| `supabase/migrations/20261017095000_s1_terms_access_gate.sql:1042`·`:1065`, `supabase/deferred_migrations/20260823091028_rpc_hardening_cutover.sql:42` | 일반 멤버가 임의 본문을 시스템 메시지로 쓰는 RPC가 남아 있고 회수는 deferred 파일에 있다. 현재 src 검색에서는 해당 RPC 호출을 찾지 못했지만 배포된 베타의 미사용 증거는 아니다. |
| `src/lib/roomDecisions.ts:129`·`:149`·`:152` | S4는 정확한 capability RPC 부재만 레거시로 판별하고, 한 번 지원 확인한 backend의 downgrade를 차단한다. S3도 독립 감지한다. |
| `docs/S1-design.md:70`, `docs/S5-food-profile-design.md:149`·`:151` | 정산 snapshot과 현재 멤버십은 다른 접근 근거다. S5 결과 확정은 멤버·동의·취향 등 context를 재검증한다. |
| `docs/WORKFLOW.md:25`·`:67`, `docs/S1-release.md:4`·`:39`·`:188`·`:200` | 배포 현황은 날짜가 붙은 기록이며 재확인이 필요하다. 앱 선배포·문서 예고·M7 gate·DB→Edge 순서·개별 운영 승인을 유지한다. |

요청에서 지목한 `20260817200241_room_lifecycle_settled_expiry.sql`은 이 checkout에 없다. 실제 이력은 `20260903120000_settled_room_expiry.sql`, `20260907140000_delete_settled_rooms.sql`, 위 cron 해제 및 S1/S4 재정의로 추적했다. `docs/S4-design.md`/release의 8개 migration 목록에는 마지막 `20261020040000`이 누락되어 있으므로 구현·운영 준비 시 파일 identity를 다시 수집한다. 이번에는 기존 문서를 고치지 않는다.

## 3. 메이트 나가기 계약 — D1 A 확정

`leave_room_member_v1`은 현재 일반 메이트 자신의 참가행만 제거한다. `auth.uid()` 외 사용자 ID를 받지 않는다. 방장의 나가기는 이 RPC에서 거절하고 §4의 별도 흐름으로 안내한다.

| 단계 | 일반 메이트 나가기 | 데이터·화면 결과 |
|---|---|---|
| scheduling | 허용. 단, 레거시 미완료 bill guard는 전 단계 공통 적용 | 본인 schedule/voted_items 참가행 삭제. 실제 멤버 수·전원 제출 조건·정족수 재계산. 전원 제출/과반 충족으로 변해도 자동 단계 전환/확정 금지. |
| place | 위와 동일 | 후보는 공용 결정 자료로 유지하고 나간 사람의 표는 집계에서 제외. 선택 시간은 유지하되 확정 시 현재 멤버의 연속 참석 가능자를 다시 계산; 0명이면 방장이 시간 재선택. |
| confirmed | **미완료 정산이 없으면 허용** | 저장된 약속·확정 증거는 보존. “나가면 이후 새 정산에 포함되지 않음” 안내. 이후 새 bill은 나간 사람을 포함하지 않는다. 과거 지출의 미등록 채무를 S3가 판정하지 않는다. |
| settling | 방 안 미완료 정산이 하나라도 있으면 거절 | 본인 송금만 끝났어도 거절. 상태가 settling인데 실제 미완료가 없으면 먼저 서버 상태 정합성을 확인하고 fail-closed; 앱이 done으로 추정하지 않는다. |
| done | 모든 정산 완료·비정상 빈 snapshot 없음이면 허용 | 과거 bill/수취인/완료 상태 유지, 방 접근만 상실. 뒤의 새 재정산에는 포함되지 않음. |

공통 `has_unfinished_bill(room)`은 모든 bill의 `is_completed IS NOT TRUE` 수취인 존재 또는 수취인 0명인 bill을 검사한다. 공개 종료 여부나 stage만으로 미완료를 숨기지 않는다. 모순된 완료/공개 종료 상태는 운영 정합성 대상으로 분리하고 사용자 행동으로 고치지 않는다. 다른 방의 미완료 정산은 이 방 나가기를 막지 않으며 S2 계정 삭제 시 전체 범위를 검사한다.

- 참가행을 `profile_id=NULL`로 바꾸지 않고 삭제한다. NULL 표시행을 탈퇴 메이트의 재참가 자리로 재활용하지 않는다. 정산 수취인·금액·split_count·완료 플래그·계좌 공개 시각은 **무변경**이다. S1 snapshot 권한은 유지하고 현재 방 멤버 기반 프로필·메시지 권한만 즉시 상실한다.
- 나간 사람의 채팅은 방의 삭제 기한까지 남고 계정은 유지된다. 이 단계에서 “탈퇴한 메이트”로 익명화하지 않는다. 사용자 작성 후보는 남기되 작성자에게 현재 멤버 권한이 있는 것처럼 표시하지 않는다. 재참가 시 새 participant를 생성하며 과거 일정·표를 복원하지 않는다.
- 나가기를 신규 참가/재정산과 같은 잠금 아래 직렬화한다. 나가기 선행이면 이후 snapshot에서 제외, 정산 선행이면 나가기 거절이다. 이미 완료한 bill도 snapshot은 바뀌지 않는다.
- 남은 방에 서버 시스템 이벤트 `member-left:<request_id>` 하나를 기록한다. 본문은 고정 문구이며 표시용 actor는 §3.1의 구조화 참조를 사용한다. 메시지·삭제·revision·요청 이력이 함께 commit되며 실패하면 전부 rollback한다.
- `s4_revision`을 공통 방 revision으로 계속 사용한다. participant trigger가 이미 올리므로 수동 증가를 중복 추가하지 않는다. 위임+나가기처럼 복수 변경에서는 +2 이상일 수 있으며 계약은 **변경 후 단조 증가**, 정확히 +1이 아니다. 반환 revision은 최종값이다. S5 ticket의 멤버 context 검증도 기존대로 실패해야 한다.
- 응답 후 홈/일정/채팅 목록과 해당 room cache·미리보기·추천 ticket을 무효화하고 room 구독을 해제한다. 이전 화면으로 돌아가도 채팅을 다시 열지 못한다. 늦게 도착한 기존 요청 결과는 폐기한다. 서버 권한 검사는 별개로 유지한다.

### 3.1 정산 시작 전 나가기의 오해 방지

confirmed 나가기 확인창의 본문은 **“정산 요청 전에 나가면 이 밥약 정산에서 빠져요. 아직 나눌 비용이 있다면 메이트와 먼저 확인해 주세요. 이미 만들어진 정산 내역은 그대로 남아요.”**로 고정한다. 버튼은 “그대로 있을게요”/“내용을 확인하고 나가기”. done에서는 “나가면 이후 새 정산에 포함되지 않아요. 기존 정산 내역은 남아요.”를 사용한다. 비용 해결 동의 checkbox나 방장 승인을 새로운 서버 조건으로 만들지 않는다.

나가기 시스템 이벤트는 현재 방장과 남은 메이트 모두에게 보인다. confirmed에서는 “{메이트}님이 방을 나갔어요. 이후 새 정산에 포함되지 않아요.”, 그 외는 “{메이트}님이 방을 나갔어요.”를 표시한다. 이름 문자열을 메시지 본문에 복제하지 않고 서버 소유 `lifecycle_actor_id`(profiles FK, ON DELETE SET NULL)와 `lifecycle_event_type`을 사용해 기존 허용 프로필 projection으로 표시한다. 참조가 없어지면 “탈퇴한 메이트”, 읽기 불가면 “메이트”로 표시한다. client의 시스템 kind/actor/type 쓰기는 금지한다. S2에서 참조·캐시까지 익명화 검증하며 기존 송신자 필드로 위장하지 않는다.

새 정산 시작 화면은 방장뿐 아니라 **정산을 시작할 수 있는 모든 현재 메이트**에게 “현재 방에 있는 메이트만 이번 정산에 포함돼요. 정산 요청 전에 나간 메이트는 빠지니, 인원과 금액을 확인해 주세요.”와 최신 대상 인원·목록을 표시한다. S1에서 허용한 현재 멤버 표시값만 사용하고 나간 사람의 별도 명부·과거 비용 추정치를 만들지 않는다. 입력 중 membership revision이 바뀌면 대상 인원을 다시 표시하고 확인 버튼을 재확인 상태로 돌린다.

이 안내는 **서버 D1 A를 바꾸지 않는다.** 실제 snapshot은 기존 정산 core가 room lock 뒤 확정한다. 화면 확인과 commit 사이의 경합을 완전히 막았다고 주장하지 않는다. 성공 후 반환 bill의 실제 snapshot/분모를 다시 읽어 표시하고, 실패·나가기 경합은 재조회한다. 과거 참가자를 자동 추가하거나 별도 채무를 만드는 기능은 없다.

## 4. 방장 위임·나가기·방 없애기 — D2 A 확정

**다른 메이트가 있으면 상대 동의 후 위임**하고, 방 종료는 명시적인 별도 버튼으로 제공한다. 자동 승계는 하지 않는다. 위임 Figma 시안은 없으며 기존 BottomSheet·확인창·메이트 행·버튼·피드백 컴포넌트로 구성한다. 신규 연결에는 `[결정] S3 D2 A: 동의 기반 방장 위임` 주석을 남기고 필요하면 구현 후 Figma에 추가한다. 시안 부재를 위임 구현 중단 사유로 삼지 않는다.

| 행위 | 조건 | 원자 결과 |
|---|---|---|
| 위임 요청 | 현재 실제 멤버인 방장, scheduling/place/confirmed, 방의 미완료 bill 없음, 다른 실제 멤버 지정 | 방당 pending 1건. 유효 기한 min(요청+24시간, 방 기한). 기존 pending이 있으면 취소 후 새 요청; 암묵 교체 금지. 당사자에게만 조작·상세 상태 노출. |
| 위임 수락 | 요청의 대상자 본인+현재 멤버+유효 약관, 기존 방장도 현재 멤버, 요청/방/기한/단계 재검사 | owner_id만 교체, 필요 시 원 방장 나가기까지 한 트랜잭션. 요청 시 `leave_after_accept`를 고정하고 수락 화면에 표시. 약속 확정자/최초 확정 시각·정산 작성자·금액은 그대로. |
| 위임 거절/취소/만료 | 대상자의 거절 또는 기존 방장의 취소, 서버 기한 만료 | 소유권 무변경. 수락과 직렬화. 당사자 나가기·방 만료·settling 진입 때 요청 무효화. |
| 혼자 남은 방장 | 실제 참가자 자신만, 미완료/빈 bill 없음 | 위임 대상 없음. “방 없애기” 확인 후 종료. NULL 표시행은 승계 대상이 아니다. |
| 방 없애기 | 실제 멤버인 방장, scheduling/place/confirmed/done, 모든 bill 완료 또는 bill 없음 | 방과 부속 채팅·참가·초대 삭제, bill 분리 보존. 상대 화면도 접근 종료. 수동 삭제는 만료보다 빠른 종료임을 확인창에 명시. |
| settling / 실제 미완료 존재 | 위임·방장 나가기·수동 삭제 거절 | 정산부터 처리 안내. 기한에 따른 자동 삭제는 §7의 별도 보관 정책이다. |

위임 후 원 방장이 남는 경우 일반 메이트 권한으로 바뀐다. 현재 방장만 쓰는 S4/S5 요청·캐시를 재검증하고 이전 방장의 대기 요청은 실패해야 한다. 삭제 이벤트를 곧 삭제할 채팅에 보존하려 하지 않는다. 종료 성공 응답·목록 invalidation으로 안내하고 정산용 알림 보존 여부는 S1 FK/조회 정책을 유지한다.

### 4.1 상태·대상 자격·멱등성

저장 상태는 `pending | accepted | declined | cancelled | expired`. 요청에는 room_id, from_owner_id, target_profile_id, leave_after_accept, created_at, expires_at, responded_at, terminal_reason과 생성 request ID를 저장한다. actor 참조는 profile FK이며 profile 삭제 시 NULL로 정리하고 해당 pending은 expired 처리한다. 당사자 둘 모두 profile이 존재하고 해당 방의 `participants.profile_id`가 non-null인 실제 현재 멤버여야 한다. 본인·초대 대기자·표시행·나간 사람은 대상이 아니다. 요청자가 방장임과 수락자의 S1 동의는 실행 때 재검사한다.

DB partial UNIQUE `(room_id) WHERE status='pending'`로 동시 pending 1건을 보장한다. 기한이 지난 pending은 방 lock 아래 expired로 정리한 뒤 새 요청을 만든다. 같은 request ID 재시도는 기존 결과, 다른 ID로 pending을 추가하면 `TRANSFER_ALREADY_PENDING`. leave_after_accept는 요청 시 확정하며 변경하려면 취소 후 새 요청이다.

| 전이 | 수행자 / 조건 | 결과 |
|---|---|---|
| 없음 → pending | 현재 방장, §4 행렬 통과 | 요청 1건·기한·시스템 이벤트·revision을 함께 commit |
| pending → accepted | 대상자 본인 수락, `now < expires_at`, 양쪽 멤버십/방장/stage/미완료 재검사 | owner 교체·원 방장 선택적 나가기·이벤트·revision 원자 commit |
| pending → declined | 대상자 본인 | owner/멤버십 불변, 종료 시각 기록 |
| pending → cancelled | 현재 요청 방장 본인 | owner/멤버십 불변. 취소 이유는 고정 `owner_cancelled` |
| pending → expired | worker 또는 관련 mutation의 서버 검사 | 고정 사유 `ttl`, `target_left`, `owner_unavailable`, `settlement_started`, `room_closed` 중 하나 |

종료 상태에서 pending으로 되돌리지 않는다. 성공 ID replay는 현재 접근 권한 내에서만 반환한다. 다른 행위·다른 ID로 이미 끝난 요청을 바꾸면 `TRANSFER_UNAVAILABLE`; 오래된 revision은 S4005로 재확인한다. 만료를 발견한 응답은 `{outcome:"expired"}`로 commit하여 상태 정리를 예외 rollback으로 잃지 않는다. 읽기는 기한이 지난 pending을 effective expired로 표시할 뿐 쓰지 않는다. worker가 물리 상태를 정리하며 mutation은 worker 지연과 무관하게 기한을 검사한다.

### 4.2 대기 중 행위·경합

아래 선후는 모두 advisory → room lock에서 결정하며 행위 직전 재검사한다.

| 경합 | 확정 처리 |
|---|---|
| 방장 일반 나가기 | pending이어도 거절. 수락 전에는 방장 자격/책임 유지. 수락의 leave_after_accept만 원자 나가기 가능. |
| 방장 방 종료 ↔ 수락 | 종료가 먼저면 pending을 expired(room_closed)로 처리한 뒤 room DELETE/CASCADE, 수락은 gone. 수락이 먼저면 이전 방장의 종료는 권한 거절. 종료 확인창에 “대기 중인 위임도 취소돼요” 표시. |
| 정산 시작 ↔ 수락 | pending은 정산 시작을 막지 않음. 새 bill 생성이 먼저면 pending을 expired(settlement_started), 수락 거절. 수락이 먼저면 새 owner/현재 참가자로 snapshot 생성; 원 방장이 나갔으면 그 사람의 정산 시작은 거절. |
| 대상 나가기 ↔ 수락 | 나가기가 먼저면 expired(target_left), 이후 수락 거절. 수락이 먼저면 대상자는 방장이므로 일반 나가기 거절. |
| 취소/거절/TTL ↔ 수락 | 먼저 유효하게 commit한 종료 상태 유지. 잠금 대기 후 TTL이 지났으면 수락 불가. 요청 취소는 이미 수락된 owner를 되돌리지 않음. |
| 다른 대상에게 두 요청 / 재참가 | pending 하나만 성공. 나갔다 다시 온 대상도 만료된 옛 요청 수락 불가; 새 요청 필요. |
| 다른 메이트 나가기·S4 확정 | pending 자체는 유지 가능하나 revision 변경으로 수락 시 재확인. settling/done 진입 또는 실제 미완료 발생 시 수락 불가 및 만료 처리. |

완료 상태 변화·이벤트 생성마다 공통 revision을 증가시킨다. 실제 owner/participant 변경 trigger가 이미 올렸다면 중복 수동 증가를 피하고 최종 revision을 반환한다. 실패·동일 replay는 증가하지 않는다. 정산 시작에 따른 pending 정리는 같은 정산 트랜잭션에서 **room lock 후 bill lock/INSERT 전에** 수행한다. legacy 정산 RPC도 같은 core를 사용하고 stage trigger는 정리 완료를 검증한다. bill을 잠근 뒤 위임 행을 잠그는 새 역순 경로를 만들지 않는다. 정산 생성이 실패하면 pending 정리와 이벤트도 rollback한다.

### 4.3 시스템 메시지·화면

S7 이전에는 **채팅 시스템 메시지만** 생성한다. push·새 notifications 행·외부 전송은 없다. 요청: “방장 넘기기를 요청했어요. 대상 메이트는 방 상세정보에서 확인해 주세요.”, 거절: “방장 넘기기 요청을 거절했어요.”, 취소: “방장 넘기기 요청을 취소했어요.”, 만료: “방장 넘기기 요청이 만료됐어요.”, 수락: “방장이 바뀌었어요.”를 고정 본문으로 사용한다. 임의 본문·거절 자유 사유는 받지 않는다.

event_key는 요청 ID가 아닌 **transfer ID+전이**에 고정한다: `owner-transfer:<transfer_id>:pending|declined|cancelled|expired|accepted`. accepted+나가기는 별도 member-left 이벤트도 한 번 남긴다. 메시지는 방 전체에 보이지만 요청 응답 버튼과 target/leave_after_accept 상세는 당사자에게만 허용한다. 삭제·방 만료에는 소멸할 채팅에 이벤트를 남기지 않으며 종료 상태 기록도 room CASCADE로 지워진다. TTL 정리 worker는 만료되지 않은 방에서만 메시지·revision을 생성한다.

화면은 ①방 상세의 “방장 넘기기” ②현재 메이트 선택 시트 ③선택 대상·24시간/실제 기한·수락 후 나갈지 확인 ④요청자 대기/취소 카드 ⑤대상자 요청 카드와 수락/거절 확인 ⑥수락 완료·만료/상대 나감 피드백으로 구성한다. 채팅 이벤트 누름→방 상세의 요청 카드; 제3자는 버튼 없음. 성공 전 owner 배지를 바꾸거나 방에서 나가지 않는다. D1 confirmed 안내는 leave_after_accept 확인에도 동일 적용한다.

S2 연계: 위임/종료가 완료된 뒤 계정 삭제 자격을 **새로 조회**한다. 위임 요청을 보낸 것만으로 통과하지 않는다. 미완료 정산이 있으면 위임해도 계정 삭제는 불가하다. done 방장은 계정 삭제를 허용한다는 기존 결정을 유지하며, S2에서는 남은 done 방을 읽기 전용으로 둘지 별도 승계할지 명시해야 한다. owner_id NULL인 done 방을 임의 사용자가 차지하거나 재정산할 수 없도록 한다.

레거시 `leave_room(uuid) → text`는 이름/반환형을 보존한 **방장 종료 전용 wrapper**로 둔다. 같은 core의 미완료·멤버십·단계 guard를 사용하며 일반 메이트 호출로 의미를 넓히지 않는다. 미지/이미 삭제된 방은 정보 없는 `gone`, 정상 삭제는 `deleted`; 다른 방 존재를 반환하지 않는다.

## 5. 초대 코드·미리보기·링크

### 5.1 코드 발급과 대상자 초대

- D3 확정 형식은 현 UI와 같은 ASCII 6자, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`(32자), 대문자 정규화와 양끝 공백 제거만 허용한다. 내부 공백·Unicode 유사문자·과대 입력 거절. 32^6 ≈ 10.74억 조합은 인증/서버 제한 없이 안전한 비밀이 아니다.
- 신규 코드는 DB의 암호학적 난수로 편향 없이 생성하고 UNIQUE 충돌 시 제한 횟수 재시도한다. 클라이언트 난수·원하는 코드 입력은 최종 S3 생성 경로에서 받지 않는다. 전체 코드 검색·prefix 검색·실패 시 추천 코드는 제공하지 않는다.
- D3 확정 TTL은 `min(발급+7일, rooms.expires_at)`이며 방 생성 시 첫 발급. 방장이 명시적으로 재발급할 때만 새 generation으로 교체하고 구 코드는 즉시 무효화한다. 단순 복사·조회·앱 재시작·방 기한 연장으로 TTL을 연장하지 않는다. 재발급은 1분당 1회·방당 1일 10회로 제한한다. 코드 재사용은 방 수명 동안 금지하고 폐기 digest를 임시 유지한다.
- 현재 메이트는 유효 코드/TTL을 조회·공유할 수 있지만 발급·회수는 방장만 가능하다. `settling/done`의 생성·재발급·공유 진입·join/accept는 S4003으로 닫는다. 기존 멤버의 단순 방 열기는 초대 API를 거치지 않는다.
- 대상자를 지정한 `create_room_invitation`은 현재 권한·친구/대상 검사와 멱등성을 보존한다. pending 기한은 `min(초대 생성+7일, 방 기한)`이고 코드 generation과 독립한다. 코드 재발급이 대상자 초대를 몰래 취소하지 않는다. settling/done 전환 때 pending을 expired로 바꾸는 S4 규칙을 유지한다.
- 이미 accepted인 초대를 탈퇴 후 다시 수락해 재참가할 수 없게 한다. accepted replay는 현재 멤버에게만 동일 결과, 이미 나간 사람은 새 초대 필요. 초대 거절·삭제·기한 경계도 잠금 뒤 검사한다.

### 5.2 시도 제한과 열거 방어 — D4

D4 A: 로그인+S1 동의 뒤 **사용자별 전체 코드 조회/참가 실패 5회/15분**, 다섯 번째 실패 시 15분 잠금. 성공도 포함한 전체 요청은 사용자별 30회/분·200회/일 상한을 둔다. 승인된 수치이며 부하 검증으로 실행 가능성을 확인한다. 임의로 완화하지 않는다.

1. 실패 카운터는 사용자 ID 기준으로 모든 방·코드·기기·세션·preview/join/레거시 join에 공유한다. 코드별 또는 사용자+코드만 잠그면 코드를 바꾸며 우회할 수 있다. 공격 대상 방/코드 전체를 잠그는 방식은 타인의 초대를 막는 DoS가 되므로 사용하지 않는다.
2. actor rate row를 먼저 잠가 검사·예약한 뒤 코드 조회와 room 잠금으로 진행한다. 동일 사용자의 병렬 20요청도 허용량을 넘지 못해야 한다. DB 서버 시각만 사용한다. 성공해도 당일 총량은 초기화하지 않는다. 실패 window 만료로만 실패 수를 재설정한다.
3. **실패 저장 뒤 예외를 던지면 카운터도 rollback된다.** 예상 가능한 잘못된 코드/만료/폐기/참가불가/잠금은 JSON의 `outcome:"rejected"`로 정상 commit한다. 서버 결함·인증/약관 실패는 별도 오류이고 코드 존재를 응답하지 않는다. REST payload 제한은 DB 도달 전 적용하며 정상 크기의 잘못된 형식도 시도 수에 포함한다.
4. legacy `join_room_by_code(text) → uuid`는 성공 UUID, 코드 실패/잠금에는 NULL을 반환하여 같은 limiter의 증가를 commit한다. NULL 뒤 예외로 바꾸는 wrapper는 금지한다. 구 앱은 NULL이면 시트를 닫되 방 진입을 하지 않는 현재 동작이므로 새 베타에서 먼저 “초대를 확인할 수 없음”으로 처리한다. 유효 코드의 settling/done도 외부에는 통합 실패로 감추며, 이미 멤버인 초대 생성 등은 S4003을 유지한다.
5. 실패 응답은 미존재·코드 만료·방 만료·삭제·회수·잠긴 단계 모두 `INVITE_UNAVAILABLE`. 사용자의 남은 시도/재시도 시각만 반환하고 특정 방 존재 여부·인원·만료 원인을 알려주지 않는다. lookup의 실행 시간 차이까지 완전히 없다고 주장하지 않으며 로그·오류·응답 크기에서 추가 oracle을 만들지 않는다.
6. DB에서 신뢰할 IP를 얻지 못하면 임의 `X-Forwarded-For`나 앱 제공 IP/기기 ID를 믿지 않는다. DB 사용자별 제한을 필수 기반으로 하고 인증 서비스의 가입 남용 제한·운영 총량 감시를 결합한다. 다계정 분산 추측은 잔여 위험이다.
7. IP 제어가 필요하면 신뢰 proxy가 출처를 정하는 Edge 앞단을 추가하고 DB direct preview/join EXECUTE를 회수한 전용 worker 경로로 전환한다. Edge만 제한하고 direct RPC를 열어 두는 구현은 불합격이다. IP 원문 저장 없이 단기 회전 digest를 쓰는 수집/보관 정책을 별도 검토한다. 이 선택은 Edge 배포·secret 설정에 대한 개별 승인이 필요하다.

`private.s3_invite_limits`는 actor와 count/window/lock_until만, 24시간 요청 이력은 만료 후 정리한다. 원문 코드·IP·입력값을 audit/log에 저장하지 않는다. 코드 관련 private 저장소와 rate 저장소는 RLS 활성, 앱 table grant 없음이다.

### 5.3 방 미리보기와 참가

미리보기는 **로그인·동의된 코드 보유자**에게만 허용하고 참가 권한을 미리 부여하지 않는다. 공개 웹은 이번 범위에서 제외하며 비인증 방 정보 응답도 제공하지 않는다.

확정 응답: 정제한 방 제목, 실제 멤버 수, 참가 가능 표시, 코드 만료 시각, 짧은 수명의 opaque preview ID. 방장/멤버 이름·사진·프로필 ID·개인 일정·정확한 장소·채팅·계좌·건강·추천 취향·미완료 정산·room UUID는 제외한다. 제목도 사람이 개인정보를 쓸 수 있으므로 방장에게 “코드를 받은 로그인 사용자에게 제목과 인원 공개” 안내가 필요하다. D5 A에 따라 방 제목과 인원을 표시한다.

preview ID는 서버 난수, actor·room·code generation·표시 revision에 결합하여 2분 TTL로 보관한다. 앱은 명시적인 “방에 들어가기”에서만 이 ID를 제출한다. 참가 시 최신 TTL·generation·단계·방 기한·약관을 재검사하고 표시 revision이 바뀌면 `PREVIEW_STALE`로 재확인한다. preview 생성 자체는 참가·정족수·room revision을 바꾸지 않는다. 가입 성공은 참가행·서버 이벤트·revision·요청 이력을 원자 저장하며 동일 request 재시도는 중복 참가/메시지 없음이다.

미리보기는 room/member를 한 statement snapshot으로 읽되 rate/preview ledger는 쓰므로 전체 RPC를 STABLE로 표시하지 않는다. 입력 변경 뒤 늦게 온 응답은 폐기하며 매 키 입력마다 조회하지 않고 6자 완료 후 명시 요청 또는 한 번의 debounce를 사용한다. 미리보기 없는 legacy join도 같은 제한·TTL·stage를 검사한다.

### 5.4 초대 링크 제외와 후속 대안 — D6 A 확정

| 결정 | 구현 범위 | 상태/의존 |
|---|---|---|
| A. S3는 코드 입력·코드 복사·OS 공유 | 웹 URL/카카오 전용 버튼/설치 후 자동입력 없음. 기존 코드 공유 문구 유지 | **이번 출시 확정**. 수명·권한을 먼저 검증하며 M01/X15 중 링크 부분은 명시적으로 미완료 처리. |
| B. 후속 검토: 웹 랜딩+앱 링크+코드 fallback | 승인된 HTTPS 호스팅, Android App Links/iOS Universal Links 연결, 앱이 없으면 스토어·코드 복사 안내 | 도메인·앱 식별자·서명 연결·스토어 URL·웹 개인정보 안내·실기기 검증 필요. 설치 이후 자동 복원은 별도 기능이며 보장하지 않음. |
| C. 후속 검토: B+카카오 전용 공유 | SDK/앱 등록·템플릿·공유 실패 대체까지 | 공급자 설정·추가 개인정보 검토·배포 의존 증가. 범용 공유가 카카오 전용 구현을 대체했다고 주장하지 않음. |

B/C는 승인 범위 밖 후속 대안이다. 향후 별도 승인 시 6자 코드를 URL에 그대로 싣기보다 별도 128bit 이상 난수 link token을 사용하고 서버에는 digest를 보관한다. link도 같은 generation/TTL을 따르며 로그인 뒤 앱의 명시 참가를 요구한다. 웹은 일반 앱 안내만 노출하고, token을 analytics·오류·리퍼러·OG 미리보기에 넣지 않는다(`no-store`, `no-referrer`, 로그 redaction). 웹 클릭/링크 스캐너/스토어 열기만으로 참가하지 않는다. 공유 전 URL은 의도된 수신자에게만 전달한다는 안내를 둔다. 앱 cold/warm start·로그인/동의 왕복 뒤 원래 invite intent를 한 번만 처리한다.

## 6. 저장소·RPC·보안·잠금

### 6.1 저장소와 공개 계약

아래 이름을 구현 계약으로 사용하며 구현 전 기존 이름과의 충돌을 검사한다. overload하지 않는다. bigint revision은 10진 문자열, 시각은 유한 UTC ISO다.

| 저장소 / RPC | 핵심 계약 |
|---|---|
| rooms | `lifecycle_version`, `base_expires_at`, `hard_expires_at` 추가. 기존 `created_at`은 서버 소유 신뢰 기점으로 검증·사용하며 열을 중복 추가하지 않는다(`20260817000000_remote_schema.sql:247`). 기존 `expires_at`은 현재 실제 기한, `s4_revision`은 공통 revision. 신규 열 직접 INSERT/UPDATE 불허. |
| private 코드 저장소 | room FK, generation, issued_at/expires_at, 현 코드 및 폐기 digest. 기존 rooms.code는 호환 projection으로 동기화하고 직접 쓰기 회수. 코드 원문은 현재 멤버에게 공유해야 하므로 DB 암호화/키 관리는 별도 구현 결정; 단순 hash만으로 공유 원문을 복구할 수 있다고 가정하지 않음. |
| private.s3_requests | actor/request PK, operation, payload hash, applied_revision, 결과 종류, created_at. 원문 코드·채팅·프로필 복제 없음. room 생존 중 보관, 삭제 시 해당 이력 제거. |
| private.s3_transfer_requests / s3_invite_previews / s3_invite_limits | 당사자·기한·상태를 최소 보관. 만료 preview 2분, 위임 pending 최대24시간, 완료 위임 이력은 방 수명까지. rate 이력 24시간. RLS 활성·직접 grant 없음. |
| `get_s3_capabilities()` | `{contract_version:1,member_leave:true,owner_transfer:boolean,invite_preview:true,invite_limits:true,bounded_expiry:true,invite_links:boolean}`. 모든 활성화·호환 경로 보강 완료 후 공개. |
| `get_room_lifecycle_v1(p_room_id)` | 현재 멤버만. stage/revision/server_time/expires_at, 초대 TTL, 본인의 can_leave/can_close/can_transfer/reason, 본인에게 허용된 위임 요청. 계좌/타인 정산 상세 없음. |
| `create_room_v1(p_title,p_color,p_request_id)` | 서버가 owner/생성 시각/기한/코드를 결정. 일정은 S4에서 선택. 성공 room ID/code/기한/revision 반환. 임시 meeting_date는 서버 생성일 KST 호환값, 확정 시간으로 사용 금지. |
| `leave_room_member_v1(p_room_id,p_expected_revision,p_request_id)` | 일반 멤버 본인만. 성공 `{outcome,applied_revision}`; 탈퇴 후 state/채팅 반환 없음. |
| `request_room_owner_transfer_v1(...)`, `respond_room_owner_transfer_v1(...)`, `cancel_room_owner_transfer_v1(...)` | room/target 또는 transfer ID, expected revision/request ID 및 명시 수락·거절. 대상·행위·leave_after_accept를 payload hash에 포함. |
| `close_room_v1(p_room_id,p_expected_revision,p_request_id)` | 방장 종료. 삭제 성공 또는 정보 없는 gone. 삭제 후 room DTO 반환 없음. |
| `rotate_room_invite_code_v1(p_room_id,p_expected_revision,p_request_id)` | 방장, 새 generation/코드/TTL. 서버 제한 적용. room revision 증가로 기존 preview 무효화. |
| `preview_room_invite_v1(p_code)` / `join_room_invite_v1(p_preview_id,p_request_id)` | §5의 rate 검사와 typed outcome. 성공 참가만 room ID 반환. 코드 기반 예상 실패는 SQL 예외 대신 rejected envelope. |

일반 mutation은 `{contract_version:1,outcome:"applied"|"replayed",applied_revision}`를 기본으로 한다. `42501`, S1 `S1001/S1006`, `S1007`, `22023/22P02`, S4 `S4003/S4005`를 재사용한다. S3 고유 오류는 별도 등록 후 `ROOM_HAS_UNFINISHED_SETTLEMENT`, `OWNER_TRANSFER_REQUIRED`, `TRANSFER_UNAVAILABLE` 등 안정된 symbol로 매핑한다. 새 SQLSTATE 숫자를 기존 것과 중복 배정하지 않는다. 초대 envelope는 `INVITE_UNAVAILABLE`, `INVITE_RATE_LIMITED`, `PREVIEW_STALE`와 서버 `retry_at`만 사용한다.

요청 이력은 잠금 후 권한→기존 요청 동일성→revision→행위 조건 순으로 검사한다. 같은 actor/request의 다른 입력은 S1007. 일반 replay도 현재 권한을 생략하지 않는다. **나가기 성공 후에는 멤버십이 없어지므로 같은 요청 재시도도 방 상태를 반환하지 않는다.** 앱은 no-access/gone을 목록 재조회로 해소하고 확정 성공 토스트를 중복 띄우지 않는다. 재참가 후 옛 request replay가 다시 나가게 해서는 안 된다. 삭제 성공 이력도 room CASCADE로 없어지므로 “삭제 후 exact replay를 영구 보장”하지 않는다. 생성 요청은 동일 actor/request에 대해 한 방만 만들고, 삭제 후 옛 생성 ID 재사용 방지를 위해 room FK 없는 최소 생성 tombstone을 24시간 유지한다. 만료된 ID를 앱이 자동 재전송하지 않는 규칙을 함께 검증한다.

### 6.2 RLS와 grant

- RLS는 현재 멤버·owner·본인 조건과 S1 restrictive gate를 유지한다. `TO authenticated` 자체는 권한 판정이 아니다. invite preview를 위해 rooms/participants SELECT 정책을 비멤버에게 열지 않고 좁은 SD projection만 사용한다.
- SD는 `auth.uid()` 존재, S1 gate, 유효한 현재 participant, 행위별 owner/초대 대상자를 잠금 후 재확인한다. caller/owner_id를 입력에서 신뢰하지 않는다. `search_path=''`, 객체명 완전 수식, UTC, 동적 SQL 없음.
- public 앱 RPC만 authenticated EXECUTE, PUBLIC/anon/service_role은 명시 회수. private core·트리거·ledger에는 앱 EXECUTE/table grant 없음. 함수 교체 뒤 기존 ACL이 남지 않는지 catalog와 실제 HTTP로 확인한다.
- rooms/participants 직접 쓰기, room owner/revision/expiry/code, messages.kind/event_key의 컬럼 grant와 테이블 grant를 별도로 검사한다. table grant가 있으면 column revoke만으로 막히지 않는다. S1 정산 전용 함수 권한은 확대하지 않는다.
- 사용자 앱과 무관한 cleanup은 전용 운영 역할만 호출한다. service_role을 일반 S3 사용자 RPC의 신원 대체 수단으로 사용하지 않는다.

### 6.3 잠금과 경쟁 조건

공통 순서: **초대 rate actor lock(해당 경로만) → S4와 동일 room advisory key → rooms FOR UPDATE → profiles ID 오름차순 → 필요한 participant/초대·위임/ledger 행 → bill ID 오름차순 → 수취인 행**. 다른 방을 동시에 변경하지 않는 설계를 우선하며 필요하면 room ID 오름차순으로 모든 advisory부터 얻는다. 실제 구현 전에 S1/S4/S5 쓰기 함수 전체의 하위 잠금 순서도 대조한다.

room을 찾는 비잠금 조회는 잠금 key만 얻는 용도다. 권한·기한·stage·code generation은 잠금 뒤 재조회한다. DB lock을 유지한 채 HTTP/공급자 호출 금지. rate lock을 잡지 않는 기존 room writer가 나중에 rate row를 잡지 않도록 한다. 초대 수락의 기존 invitation-before-room 순서는 S3에서 교체한다.

rate/preview 보관 정리와 방 만료 삭제는 별도 트랜잭션으로 실행하여 room lock 뒤 actor rate lock을 얻는 역순을 만들지 않는다. 위임 요청 생성·취소·수락과 코드 generation 변경도 명시적으로 공통 revision을 증가시켜 화면의 권한 상태를 갱신한다.

만료 청소도 후보 ID 비잠금 수집 → room advisory try-lock → rooms FOR UPDATE → **새 server_now로 만료 재검사** → 부속 정리/DELETE 순서다. 먼저 FOR UPDATE SKIP LOCKED로 방을 잡고 advisory를 나중에 얻지 않는다. 재정산이 먼저 commit되어 기한이 늘면 삭제하지 않고, 삭제가 먼저면 재정산은 gone으로 실패한다. 수취인 완료가 detached bill에서 진행되는 경로도 room_id 재조회와 기존 S1 순서를 검증한다.

동시 leave/confirm, leave/settlement, join/settlement, rotate/preview/join, transfer/leave/confirm, delete/payment, cron/restart를 각각 양방향 직렬화 테스트한다. revision 충돌 시 최신 revision만 붙여 옛 의사를 자동 재실행하지 않는다.

## 7. 방 생성·단계별 수명·삭제 — R2, D7/D8

### 7.1 확정 기한

`T0`=서버 생성 시각, `Tc`=최초 방장 약속 확정 시각, `Tb`=새 bill 생성 시각, `Ts`=전체 열린 bill 완료 시각. `base_expires_at=T0+7일`,  확정 전 hard limit은 base, 확정 뒤 hard limit은 `Tc+30일`이다. 모두 유한값이며 클라이언트의 날짜/기한/시계는 사용하지 않는다.

| 단계/변경 | expires_at 계약 |
|---|---|
| 신규 scheduling / place / confirmed | 기본 T0+7일 유지. S4 선택 구간도 기한 이내. 시간 선택·확정·초대·나가기·위임으로 연장하지 않음. |
| confirmed에서 첫 정산 | S4대로 min(기존 expires_at, Tc+30일). 첫 정산에 자동 7일을 추가하는 변경은 별도 결정 없이는 하지 않음. |
| settling 또는 done에서 S4가 허용한 새 bill | min(Tb+7일, Tc+30일). 기존 bill 수정·재시도로 연장하지 않음. |
| 전체 열린 bill 완료 → done | min(Ts+24시간, Tc+30일). 동일 완료 재시도로 Ts를 새로 만들지 않음. |
| 증거 없는 legacy settling/done | 새 bill 차단 유지. 유한 기존 기한을 원칙적으로 보존하되 D8의 상한 보정. 완료 시 기존 +24시간과 legacy hard limit 중 이른 시각. |
| 수동 종료 | §4 조건에서 즉시 논리/물리 삭제. 남은 정산 snapshot은 보존. |

기한에 도달하면 `expires_at <= server_now`로 접근 종료한다(기존 청소 `<`와 경계를 통일). 미완료 정산이 있어도 방 보관 기한을 무한 연장하지 않는다. 만료는 채무 면제/정산 완료가 아니다. detached bill의 수취인과 작성자는 S1 정산 경로로 계속 처리할 수 있어야 한다. 이 권한이 실제 화면에서도 작동하는지 별도 검증한다.

### 7.2 R2 차단과 이전

최종 S3에서는 `create_room_v1`만 생성하고 **기존 rooms INSERT의 table·column grant 모두 회수**한다. 새 생성 core/trigger는 server_now로 생성 기점·기한을 정하고 finite/상한 무결성을 보장한다. RLS도 안전한 초기 stage/미확정 metadata 조건을 유지한다. 모든 후속 expiry writer가 단계별 hard limit을 넘지 못하도록 공통 내부 함수/guard를 적용한다.

신규 앱 선배포 기간에는 서버 미지원일 때 기존 INSERT를 사용한다. D11 A에 따라 최소 베타 버전 확인 뒤 S3 활성화 트랜잭션에서 직접 INSERT를 회수한다. **임의 코드 INSERT와 23505를 이용한 존재 탐색까지 닫는다.** 기간 제한 guard 호환 단계(B)는 이번 구현에 포함하지 않으며 별도 승인 없이 추가하지 않는다.

기존 데이터는 원문을 복사하지 않는 집계로 분류한다: 유한 정상/비유한·상한 초과, 이미 만료, 미완료·빈 snapshot, 확정 증거 유무, 무소유/비멤버 owner, 코드 형식·중복, 생성 시각 불명.

- 정상 유한·상한 이내 방은 기한을 늘리지 않는다. 증거 있는 방은 Tc 기반 cap, 미확정은 신뢰 가능한 T0+7일로 잘라낸다. legacy done은 Ts+24시간도 cap에 포함한다.
- 신뢰할 기점이 없는 행은 migration 시각을 생성 시각처럼 채워 무제한 연장하지 않는다. 운영 집계 후 **최대7일 이내의 승인된 고정 전환 마감일**을 지정하는 D8 예외를 적용한다. 실제 마감일이 정해지기 전에는 이 행들의 보정을 실행하지 않는다.
- 비유한/과도한 기한 보정으로 즉시 만료될 수 있다. migration 자체는 물리 DELETE하지 않고 대상 건수·기한 변화를 제시해 승인을 받는다. cleanup 활성화는 별도 단계로 진행한다. 이미 만료된 방을 보정으로 되살리지 않는다.
- 기존 코드의 남은 TTL은 min(기존 방 기한, 승인된 전환 시각+7일)로 한 번만 부여하고 legacy code generation을 기록한다. 재실행 때 다시 7일을 주지 않는다. 기존 pending 초대도 같은 상한으로 단축하며 accepted/declined 이력은 재작성하지 않는다.
- CHECK만으로 `clock_timestamp()` 기준 TTL을 유지하려 하지 않는다. 입력 시각 검증은 core/trigger, 불변 시각 간 관계·finite 검사는 constraint로 분리한다.

### 7.3 청소 실행과 채팅 보관 문구

앱 목록 조회가 청소를 호출하는 구조는 접속자가 없을 때 보관 약속을 실행하지 못한다. DB의 전용 cleanup 함수를 **서버 스케줄러 1분 주기**, 최대 100개 batch로 호출하고 처리량/가장 오래 지난 기한/실패 횟수만 감시한다. 숨겨진 과거 job을 다시 등록하지 말고 실제 scheduler identity와 중복 job 여부를 확인한다.

pg_cron 가능 여부는 이번에 확인하지 않았다. 가능하면 DB 작업 역할로 private cleanup을 호출한다. 불가능하면 외부 스케줄러→인증된 Edge→전용 worker RPC 경로를 별도 승인·배포한다. 사용자 JWT/현재 약관이 없어도 정해진 삭제는 진행되어야 하며 공개 cleanup endpoint는 금지한다. S1 gate를 우회하는 일반 사용자 함수가 아니라 제한된 운영 작업으로 분리한다.

구 `delete_expired_rooms()`는 전용 worker를 호출할 권한을 앱에 넘기지 않는다. 호환 기간에는 S1 검사 뒤 0을 반환하는 무해한 wrapper로 전환하고 신규 앱에서 호출을 제거한 후 EXECUTE를 회수한다. 주기 작업이 설치·동작하기 전에 앱 cleanup을 먼저 끊지 않는다.

**현재 개인정보 문구와 그대로는 정합하지 않는다.** 예: Ts+23시간에 새 재정산을 시작하면 원래 Ts+24시간을 넘어 채팅이 남을 수 있다. 재정산 없이도 Tc+30일 cap이 먼저면 완료 후 24시간보다 일찍 지워질 수 있다. 미정산 자동 만료·사용자 종료도 별도 원인이다.

D9 A에 따른 문구 방향(최종 법률 문안 승인은 별도): “채팅은 방 종료 또는 만료 때 삭제합니다. 정산 완료 후에는 최대 24시간이며, 그 전에 새 정산이 시작되면 방 보관 기한이 다시 계산됩니다. 새 정산은 최대 7일, 최초 약속 확정 후 최대 30일을 넘기지 않습니다. 미정산 방의 기본 기한은 생성 후 7일입니다.” 첫 정산은 원래 방 기한이라는 예외와 **정산 기록은 채팅과 별도 보관**됨을 도움말에 설명한다.

정확한 “즉시 물리 삭제”를 1분 cron으로 보장할 수는 없다. 접근은 기한 즉시 닫고 물리 삭제 목표(정상 시 1분 이내)·장애 알림 기준·백업 보존/복원 후 재삭제를 따로 정한다. 앱 캐시/오프라인 자료/백업까지 삭제됐다고 DB DELETE만으로 주장하지 않는다. 고정 24시간 문구를 유지하려면 재정산 때 이전 채팅을 별도 purge하거나 재정산 자체를 제한해야 하므로 S4 제품 계약 재승인이 필요하다.

## 8. 레거시·서버 없는 상태·R1

Play 베타 앱을 서버보다 먼저 배포한다. `unknown / legacy / s3 / error`를 S1/S4와 별도 관리하고 capability는 backend+계정 세션 기준 캐시, 앱 포그라운드/로그인 전환 시 재조회한다.

- 정확한 `public.get_s3_capabilities()` 부재를 가리키는 `PGRST202` 또는 `42883`만 legacy로 인정한다. 네트워크 오류·5xx·401/403·S1001/S1006·잘못된 JSON·다른 RPC 부재는 fail-closed. 한 번 S3 지원을 확인한 backend가 이후 부재 응답을 주면 배포 오류로 취급한다.
- legacy 서버에서는 기존 생성/코드 참가/방장 삭제를 기존 수준으로 유지하되, 새 일반 메이트 나가기·위임·TTL 재발급·미리보기·5회 제한 기능은 “서버 준비 중”으로 닫는다. 앱 카운터로 서버 제한을 흉내 내거나 7일/5회가 보장된다고 안내하지 않는다.
- S3 지원 확인 뒤 개별 writer 부재는 legacy API로 재시도하지 않는다. 신규 생성 실패 후 직접 INSERT, 나가기 실패 후 기존 leave_room, preview 실패 후 legacy join으로 우회하지 않는다.
- 서버 없음/로그인 만료/동의 필요에서는 새 참가를 성공처럼 렌더하지 않는다. 코드 입력 초안만 메모리에 유지하고 인증·동의 후 서버에서 다시 검증한다. 만료·나가기·삭제 후 로컬 목록만 지우는 처리를 서버 성공으로 보고하지 않는다.
- timeout은 성공 여부 불명이다. request ID/입력을 그대로 재시도하거나 현재 목록/권한을 조회한다. 나가기 후 멤버 접근 오류는 가능한 성공 결과이지 exact replay 증거는 아니다.

R1은 S3에서 회수한다(D10 A): 나가기/위임/가입 이벤트를 “서버 사실”로 표시하는 시점에 일반 멤버가 같은 시스템 발신자를 위장할 수 있으면 새 UX를 신뢰할 수 없다. 먼저 배포할 베타 artifact/버전에서 `post_room_system_message` 호출 부재와 모든 대체 서버 이벤트를 확인한 뒤 별도 cutover migration으로 PUBLIC/anon/authenticated/service_role EXECUTE를 회수한다. deferred 파일 전체에는 다른 권한 변경이 있으므로 통째 적용하지 않는다. 앱의 직접 messages INSERT로 kind=system·sender_id=NULL·event_key 위조도 막아야 한다.

S7 이월은 채택하지 않았다. 과거 메시지는 verified로 일괄 승격하지 않고 신규 서버 이벤트의 고정 type/key를 구분한다. R1 회수 전후의 독립 보안 검토 없이는 안전하다고 승인하지 않는다.

## 9. 앱 화면·Figma 연결

정본은 로컬 추출이 가리키는 **Phone 페이지 `478:9398`, 파일 `euLZpuvJsmuOhVKwtDkdhJ`**다. 옛 `docs/figma-specs.md:3`의 Application UI 파일을 정본 대신 사용하지 않는다. `tmp/figma-proto/FLOWS.md:1791`의 P04는 전체 관련 90 edge/누락·불일치 50건이며 모든 edge가 S3 새 기능인 것은 아니다. `edges.json`의 `package=P04`를 실제 필터해 아래 연결을 확인했다. 원격 노드·실제 렌더는 이번에 재검증하지 않았다.

| 화면·노드 | 연결 / 구현 계약 |
|---|---|
| 방장 상세 `528:1525`, 삭제 확인 `528:1604` | E0485 코드→초대, E0495 삭제 확인, E0498 취소. 삭제 성공만 홈 갱신. 위임은 §4.3의 기존 컴포넌트 조합으로 구성하고 [결정] 주석을 남김. |
| 메이트 상세 `561:1734`, 나가기 확인 `561:1815` | E0511 나가기→확인, E0514 취소, E0515 성공→`590:2164`. 미완료 사유 표시, 요청 중 이중 탭 차단. |
| 나간 뒤 홈 `590:2164` | “나왔어요” 토스트, 홈/일정/채팅에서 해당 방 제거. E0418~E0425의 알림·정산·다른 방·탭은 정상 유지. 다른 방 미완료 정산까지 지우지 않음. |
| 입력 `543:1665`, 완료 `590:2533`, 오류 `559:1657` | 6칸 시각 표현과 접근성상 연속 입력·붙여넣기·삭제 지원. E0901 입력→완료, E0909/E0910 다시 입력, E0918 명시 참가 성공→채팅. 시안의 E0917 클릭→오류는 데모 연결이며 실제 오류는 서버 결과로만 표시. |
| 메이트 초대 `561:1945`, 복사됨 `628:1934`, OS 공유 `628:2083` | E0518 코드 복사, E0519 카카오, E0520 링크 복사, E0521 더보기. D6 A에 따라 코드 복사/범용 공유만 출시하고 링크/카카오 구현 완료로 집계하지 않음. |
| 웹 랜딩 `543:1609` | E0891 복사, E0892 앱 열기, E0893/E0894 설치. 스토어는 실제 승인 URL로 이동하며 정적 Figma의 입력 화면 연결을 그대로 구현하지 않음. |
| 완료 안내 `548:1675`, `631:6106` | 실제 server expires_at로 카운트다운, 재정산 시 settling 기한 안내로 변경. 만료 후 정산 기록으로 안내하고 채팅 접근 제거. |
| 멤버 시트 `528:1399`, 채팅 `496:1126`/`496:1202` | E0483 초대 진입. P06 MembersPanel 연결과 소유 경계 조율; P04가 부모 ChatRoomSheets를 무단 변경하지 않음. |

`tmp/figma-audit/REPORT.md:249` X06, `:303` X15, `:315` M01, `:321` M02를 미해결 목록의 기준으로 삼는다. Modal 뒤의 탭·벨 edge는 클릭을 강제로 통과시키지 말고 실제 interaction 명세를 확인한다.

추출할 P04 노드와 제외 노드는 §14.4로 모았다. **5회 잠금 전용 프레임과 위임 화면 ID는 이 자료에서 식별하지 못했으므로 만들어 적지 않는다.** 5회 잠금은 기존 코드 오류 시안과 승인된 D4 문구로, 위임은 §4.3의 기존 컴포넌트 조합으로 구현한다.

## 10. 마이그레이션·앱 묶음과 테스트 계획

과거 migration은 수정하지 않는다. 파일명·순서·RPC/정책 담당·크론 실행 단위는 §14.1, 앱 파일 소유는 §14.2를 단일 기준으로 사용한다. 아래는 검증 요건이다.

앱은 capability/parser/오류 매핑, roomLifecycle API, RoomDetail/JoinCode/MateInvite, 목록·구독 무효화, legacy NULL 처리, detached 정산 접근을 먼저 준비한다. 생성/초대/정산과 공유 코드 경계에는 작성자와 독립된 보안·데이터 검토가 필요하다.

| 검증 층 | 필수 시나리오 / 통과 기준 |
|---|---|
| SQL 권한 | A 방장/B 메이트/C 외부/D 초대만/E 나간 사람/F NULL 표시행/G 동의 없음/anon/service 역할. table+column grant와 RLS 각각 검사. 비멤버 owner, 타인 participant 삭제, owner/expiry/code/system message 직접 쓰기 모두 거절. |
| 단계·정산 | 다섯 단계 나가기/종료/위임 행렬, 본인 완료·타인 미완료, 빈 snapshot, 여러 bill, 잘못된 stage, 공개 종료인데 미완료 모순. snapshot/금액/완료/계좌 무변경, detached 정산 계속 처리. |
| revision·멱등 | 동일 ID 재전송/다른 입력·다른 actor, no-op, 탈퇴 뒤 replay, 재참가 뒤 옛 ID, 삭제 뒤 생성 ID, stale preview/약속 확정. 이벤트 중복 0, 실패 전체 rollback. |
| 수명 | finite/infinity/-infinity/NULL/과대 시각·위조 생성일 입력, 정확한 만료 경계, S4 첫 정산/재정산/완료·30일 cap·재시도 무연장. 위임/복사/추천도 무연장. |
| 초대·rate | 소문자/공백/유사문자, 실제 CSPRNG 충돌 재시도, 코드 재발급/폐기, preview 유출·타 actor 재사용, accepted 후 leave 재수락, 5번째 실패 commit, 6번째 잠금, 15분 경계, 총량 상한, 다기기·다코드 우회 실패. |
| 동시성 | §6.3의 모든 경합을 실제 2개 이상 DB 세션에서 반대 순서까지 실행. limiter 동시 20요청, 위임 요청/수락/취소, cleanup/restart의 대기 후 재검사. deadlock·중복 snapshot·초과 참가 0. |
| 업그레이드 | S1/S5/S4 fixture→S3, 코드 조회 기반 구 생성, 정상/무기한/만료·기점 불명 데이터, 기존 pending 초대, owner NULL done, 데이터 보정 재실행 무연장. 과거 bill/금액/완료 상태 보존. |
| HTTP | 실제 PostgREST JWT 역할·RLS·ACL·NULL/envelope·missing signature·grant 회수·schema reload 검증. Edge 채택 시 direct RPC bypass 실패, 위조 IP·무인증 worker 호출 거절. 합성 JWT 검증과 실제 Auth 발급 E2E는 구분. |
| 앱 | 신앱/구서버, 신앱/S3, 구앱/S3의 지원 범위·업데이트 유도, 네트워크 실패·이중 탭·백그라운드·로그아웃·stale response, 나간 뒤 홈/일정/뒤로가기, 실제 정산 접근, 접근성 6칸·붙여넣기. |
| Figma·링크 | 노드·좌표와 실제 렌더 동시 확인. 앱 설치/미설치, cold/warm start, 로그인/동의 후 intent 복원, 스토어·복사·공유 취소/실패. D6 제외 항목은 미구현으로 기록. |
| cleanup | 앱 접속 없이 실제 scheduler 실행, 기한 경계·batch backlog·lock skip/다음 주기 회수·실패 경보, orphan·FK·첨부 저장소 존재 여부, 캐시/백업 복원 정책 확인. |

현재 작업에서는 DB/HTTP/앱/전체 테스트를 실행하지 않는다. 후속 구현에서 격리 스택만 사용하고 대상 컨테이너·포트를 먼저 확인한다. 이 작업에서 허용된 DB 접근은 `supabase_db_mealchat_s1_a_20261017`(55322) **읽기 전용**뿐이므로 fixture/reset·트랜잭션 쓰기 테스트도 이번 권한에 포함되지 않는다. 기본 54321/54322·원격은 사용하지 않는다. 애플리케이션 변경 완료 때 focused tests 후 비례적인 `npm run quality`를 수행하며 `.env`를 읽지 않는 환경을 유지한다.

## 11. 운영 반영 절차 추가분

`docs/S1-release.md`를 대체하지 않는 S3 추가 목록이다. 현재 법률 문서 정정 차단, M7·release:check, DB→Edge 순서, 별도 외부 변경 승인을 모두 유지한다.

1. §12의 승인된 결정을 기준으로 채팅 보관/초대 공개 안내와 beta 최소 버전·D8 기점 불명 대상의 고정 전환일을 준비한다. 법률 문서 갱신은 별도 작업으로 생성물/hash/예고·재동의 필요성을 검토한다. 설계 작성이나 문서 승인만으로 운영 반영하지 않는다.
2. 배포 직전 승인된 읽기 전용 절차로 linked 이력·실제 함수/ACL·scheduler·테이블/FK·S4 마지막 `20261020040000`을 확인한다. 이번에는 수행하지 않았다. 정상/비정상 방·단축·삭제 예정 **건수만** 보고하고 사용자/코드/계좌/채팅 원문을 출력하지 않는다.
3. 베타 artifact에서 신규 S3 fallback·legacy NULL 처리와 R1 호출 부재를 확인한다. 구 INSERT 중단 대상 버전에 대한 업데이트 안내를 검증한다. 앱 선배포만으로 서버 기능을 켜지 않는다.
4. 구현 diff와 위 검증 결과로 독립 보안·개인정보·데이터 검토를 거친다. migration identity·보정 건수·삭제 기한·R1 회수·scheduler·Edge/웹을 각각 구체적으로 제시하고 **정확한 외부 변경에 대한 사용자 승인**을 받는다.
5. 승인된 창에서 §14의 준비→core→활성화 전 정리→R1 회수→activation 순서로 진행한다. 웹/링크는 적용하지 않는다. 하나라도 실패하면 capability/쓰기 진입을 닫고 적용 identity를 기록한다. 실패를 이유로 RLS·grant를 다시 넓히지 않는다.
6. 반영 후 다중 사용자 격리, 나가기→목록 제거, 위임→옛 방장 권한 제거, 미완료 차단, 초대 실패 commit·TTL·회수, R2 직접 INSERT 실패, detached 정산과 scheduler 실제 삭제를 확인하고 Security Advisors를 재실행한다.
7. 물리 삭제는 역 migration으로 복구되지 않는다. scheduler 장애는 기한 접근 차단을 유지한 채 승인된 forward fix로 처리하고, 복원 시 만료 자료를 다시 노출하지 않는다. 정책상 파기할 자료를 임의 archive해 rollback 수단으로 삼지 않는다.

## 12. 승인된 결정

승인일 **2026-10-21**. 사용자 지시: “D1 A, D2 A, D3~D12는 문서의 권장안.” D11은 주 권장안 A로 확정하며 대체 B는 자동 적용하지 않는다. D8은 원래 권장대로 신뢰 기점이 있으면 A, 기점 불명인 예외만 최대7일 고정 전환 유예를 사용한다. 실제 전환일·대상 건수·배포 창은 운영 승인에서 확정한다.

| ID | 승인된 선택 | 구현 계약 / 영향 |
|---|---|---|
| D1 | A | 미완료 없으면 confirmed/done 나가기 허용, settling 차단. §3.1 확인창·정산 시작 안내·나가기 이벤트로 snapshot 제외 위험 안내. |
| D2 | A | 상대 동의 기반 위임+명시 종료. 상태·경합·알림·화면은 §4.1~4.3. 자동 승계 없음. |
| D3 | A | 현 6자, min(발급+7일, 방 기한). 서버 난수·재발급 즉시 구 코드 회수. |
| D4 | A | 실패5/15분→15분 잠금, 전체30/분·200/일. DB 사용자 단위 공통 제한. IP Edge는 후속 별도 승인. |
| D5 | A | 로그인·동의 후 제목+인원과 최소 참가 metadata만. 이름·사진·정확한 장소·계좌 등 제외. |
| D6 | A | 코드 입력·복사·OS 공유만 출시. 웹·딥링크·카카오 전용·링크 복사 제외. |
| D7 | A | 서버 생성+7일. S4 첫 정산·재정산/완료·최초 확정+30일 상한 유지. |
| D8 | A, 기점 불명 예외 | 원 생성/확정 시각 cap으로 단축. 불명인 경우만 최대7일 고정 전환 유예. 물리 삭제는 별도 승인·cleanup 단계. |
| D9 | A | 실제 S4 수명에 맞춰 보관 문구 정정. 최종 법률 문안·예고·재동의 검토 별도. |
| D10 | A | 베타 artifact와 사용 근거 확인 후 S3에서 R1 EXECUTE 회수. S7로 이월하지 않음. |
| D11 | A | 새 베타 최소 버전 확인 후 S3 활성화와 함께 직접 INSERT 회수. 신앱/구서버 fallback 유지. |
| D12 | A | 미완료 없는 방은 방장 확인 후 즉시 방·채팅 삭제. 남은 정산 snapshot 보존. |

## 13. 확인 범위와 남은 증거

확인: 로컬 Git branch/HEAD/clean 상태, S1/S4/S5 설계·운영 절차, 관련 SQL 최종 재정의와 ACL 소스, 앱 나가기/생성/초대/지원 감지, 법률 문구, P04 edge 90개와 감사 M01/M02/X06/X15.

미확인: 실제 DB catalog/데이터·migration 적용, 원격·운영 상태/Advisors, pg_cron 사용 가능 여부/작업 실행, Play 배포 artifact, Figma 원격 노드/렌더/5회 잠금 전용 화면·위임 시안, 실제 Auth/HTTP/앱 E2E, 법률 문구 승인·백업 보관, 독립 보안 검토. `.env`·인증 파일·사용자 데이터는 열지 않았고 DB/원격·커밋·푸시·배포를 실행하지 않았다.

## 14. 구현 분할 계획

이 절은 후속 구현의 배정 명세다. 이번 작업에서는 작업자를 생성하거나 파일을 만들지 않는다. 동시에 구현하는 작업자는 **주 구현 A와 화면 UI B, 최대 2명**이다. 보안·인증·멤버십·정산·rate limit 코드는 A만 작성한다. B는 승인된 DTO·controller를 소비하는 화면만 작성한다. 검토자는 작성자와 독립적으로 선정한다.

### 14.1 서버 묶음 — 주 구현 A

아래는 예정 파일명이며 아직 생성하지 않았다. timestamp 충돌이 발견되면 suffix와 순서를 유지해 구현 시 재배정한다. 모든 준비 migration의 endpoint는 앱 EXECUTE를 부여하지 않고 기존 public wrapper를 교체하지 않는다.

| 순서 / 예정 파일 | RPC·정책·트리거 범위 | 완료 기준 |
|---|---|---|
| S3-M1 `supabase/migrations/20261021010000_s3_lifecycle_storage.sql` | 수명 열, private 코드/limits/previews/transfer/requests/생성 tombstone, messages.lifecycle_actor_id/type. transfer 상태 CHECK·pending partial UNIQUE·FK, 전체 private RLS/ACL. | additive만, 기존 자료 삭제/기한 변경 없음. lifecycle 버전 nullable/default 준비값, capability 없음. |
| S3-M2 `supabase/migrations/20261021010100_s3_membership_owner_core.sql` | private create/leave/close/transfer core, get_room_lifecycle_v1, create_room_v1, leave_room_member_v1, close_room_v1, request/respond/cancel_room_owner_transfer_v1. 고정 시스템 이벤트·revision·unfinished guard. | 모든 새 endpoint 실행권한 비공개. 기존 S4/S5 함수는 유지하고 활성화용 교체 정의를 준비. |
| S3-M3 `supabase/migrations/20261021010200_s3_invite_core.sql` | rotate_room_invite_code_v1, preview_room_invite_v1, join_room_invite_v1, private CSPRNG/TTL/generation/limiter, 실패 envelope/legacy NULL 호환 core. | DB 카운터 실패 commit·동시 요청 제한·미리보기 최소화 통과. direct RPC 우회 없음. |
| S3-M4 `supabase/migrations/20261021010300_s3_cleanup_core.sql` | private cleanup_expired_rooms_v1, expire_owner_transfers_v1, purge_s3_ephemeral_v1와 실행 gate. 전용 작업 역할·좁은 EXECUTE. | 방 batch≤100, advisory 순서, rate/preview purge는 별도 트랜잭션. 아직 스케줄 등록/삭제 실행 없음. |
| S3-M5 `supabase/migrations/20261021010400_s3_activate_lifecycle.sql` | D8 기한/초대 TTL 일회 보정; legacy leave/join/create/accept invitation 교체; S4 정산 시작의 pending 만료·현재 참석자 확정 검사·revision 연계; rooms INSERT table+column grant 회수 및 초기 RLS; 시스템 kind/actor/type 보호; **R1 정확한 함수 EXECUTE 회수**; 새 API grant와 get_s3_capabilities 공개. | 승인된 베타 근거·고정 전환일·scheduler 준비를 선행 검사. 모든 보정/우회 차단/활성화는 한 트랜잭션. public capability는 마지막에 공개. |

위임 API의 구체 입력은 다음으로 고정한다. 모두 단일 jsonb 반환이며 room revision은 bigint 입력/문자열 출력이다.

- `request_room_owner_transfer_v1(p_room_id uuid,p_target_profile_id uuid,p_leave_after_accept boolean,p_expected_revision bigint,p_request_id uuid)`
- `respond_room_owner_transfer_v1(p_transfer_id uuid,p_accept boolean,p_expected_revision bigint,p_request_id uuid)`
- `cancel_room_owner_transfer_v1(p_transfer_id uuid,p_expected_revision bigint,p_request_id uuid)`

S3-M5의 레거시 정산 경로는 기존 시그니처·금액 잠금·수취인 snapshot을 유지하고 **pending 만료 연계만** 추가한다. 확정 직전 참석 가능자 재검사는 §3 place 나가기 후의 S4 guard에 추가하며 신규 자동 확정은 없다. capability 응답은 `owner_transfer:true`, `invite_links:false`로 고정한다. 후속 웹/Edge IP 코드는 만들지 않는다.

스케줄은 migration에 자동 등록하지 않고 **운영 실행 파일** `supabase/release/s3_schedule_cleanup.sql`로 분리한다. 설치는 별도 외부 변경 승인 대상이다. pg_cron 사용 가능·역할·기존 job 확인 후 `s3-room-expiry-v1`(매분), `s3-transfer-expiry-v1`(매분), `s3-ephemeral-purge-v1`(5분마다)를 고정 이름으로 등록한다. 각 job은 서로 다른 트랜잭션으로 정확한 private 함수 하나만 호출하며 임의 SQL/secret을 입력받지 않는다.

M4 뒤 job을 준비하되 실행 gate가 꺼져 있을 때는 자료를 지우지 않는다. 첫 실제 job 실행·작업 역할·오류 기록을 확인한 뒤 M5가 gate를 켠다. M5에서 옛 앱 delete_expired_rooms는 S1 검사 후 0 반환 wrapper로 교체한다. pg_cron을 쓸 수 없으면 M5를 실행하지 않고 §7.3의 대체 worker 운영 구성을 별도로 검토·승인한다. 단순히 cron.job 행이 존재하는 것만으로 실행 성공이라 판단하지 않는다.

### 14.2 앱 묶음과 파일 소유

| 담당 | 전용 소유 파일/디렉터리 | 작업 |
|---|---|---|
| A 주 구현 | `src/lib/roomLifecycle.ts`(신규), `src/lib/roomLifecycleController.ts`(신규), `src/lib/roomInviteController.ts`(신규), `src/lib/rooms.ts`(메시지 adapter 포함), `src/lib/roomMembership.ts`, `src/lib/roomDecisions.ts`, `src/lib/settlements.ts`, `src/lib/roomSettlementPolicy.ts` | capability·runtime parser·신원/권한·오류 매핑·멱등/revision·초대 rate/서버 시각·나가기 후 cache/구독 무효화·정산 snapshot 재조회·구서버 fallback·시스템 이벤트 DTO. DB 직접 호출은 이 계층만. |
| B 화면 UI | `src/screens/chat/RoomDetailScreen.tsx`, `src/components/JoinCodeSheet.tsx`, `src/components/ui/MateInviteSheet.tsx`, `src/screens/room/OwnerTransferSheet.tsx`·`OwnerTransferCard.tsx`·`MemberLeaveDialog.tsx`(신규), `src/screens/HomeScreen.tsx`, `src/screens/schedule/ScheduleHomeScreen.tsx`, `src/screens/chat/ChatHomeScreen.tsx`, `src/screens/chat/ChatRoomScreen.tsx`, `src/screens/chat/ChatRoomSheets.tsx` | 위임 6상태 화면, 6칸·오류/미리보기/5회 잠금, 코드 TTL/재발급 표시, D1 확인창·정산 시작 안내, 나간 뒤 홈/구독 정리 controller 연결, 구조화 이벤트 렌더/상세 이동. 정책 판단은 controller 결과만 사용. |

먼저 A가 DTO·props·controller actions와 실패 상태를 확정해 B에게 전달한다. B는 `canLeave/canClose/canTransfer`, `reason`, `transferState`, `inviteRetryAt`, `pending`, `settlementRecipients` 등 표시 모델을 사용하며 stage를 해석해 권한을 재구현하지 않는다. ChatRoomSheets의 기존 정산 호출을 controller로 옮기는 보안 로직은 A가 lib에 작성하고, B는 그 함수를 연결한다. A가 B 소유 화면을 동시에 수정하지 않는다.

목록/provider/메시지 adapter의 정확한 파일이 위 후보와 다르면 구현 시작 전 파일 탐색으로 **한 명에게만** 배정하고 명세에 기록한다. 기존 P06 소유의 MembersPanel/부모 연결은 병행 작성하지 않는다. 이번 S3는 기존 시트 호출 지점을 controller에 연결하는 데 필요한 변경만 B가 담당하고, P06 작업이 진행 중이면 해당 파일의 단일 작성자를 먼저 정한다. 새 navigation route 없이 기존 방 상세/시트로 완성하는 것을 기본으로 한다.

UI B가 금전·멤버십·rate 보안 결함을 발견하면 화면에서 우회 수정하지 않고 A에게 반환한다. 법률 문서/생성물·release 안내의 후속 갱신은 A 소유 문서 묶음으로 분리하며 최종 문안 검토 후 처리한다. 이번 요청에서는 그 파일들도 수정하지 않는다.

### 14.3 테스트 묶음·병합 순서

| 묶음 / 소유 | 예정 파일 | 증거 |
|---|---|---|
| SQL·업그레이드 A | `supabase/tests/s3_lifecycle.sql`, `s3_transfer.sql`, `s3_invite_limits.sql`, `s3_acl.sql`, `s3_upgrade.sql`, `s3_inventory.sql` | §10 역할·단계·기한·ACL, D8 보정 재실행, zero-row/unknown 집계 구분. |
| 경합·HTTP A | `supabase/tests/s3_concurrency.ps1`, `s3_http.test.mjs`, `s3_sql.ps1` | 위임 7종 경합 양방향, rate 동시20요청, 실패 counter commit, legacy NULL, detached 정산, S4/S5 회귀. |
| 앱 계약 A | `tests/roomLifecycle.test.ts`, `tests/roomInviteController.test.ts` | capability 부재만 fallback, fail-closed, 재시도/late response/계정 전환, 나가기 후 권한·정산 실제 snapshot. |
| UI B | `tests/s3LifecycleUi.test.tsx` 및 화면 캡처 결과 | confirmed 확인 문구, pending/accepted/declined/cancelled/expired, 대상 자격·상대 나감, 6칸 접근성·붙여넣기·잠금 countdown, 홈·뒤로가기·정산 안내. |

통합 순서: ①A 계약/DTO → ②A 서버·controller와 B 화면 병렬 → ③A SQL/HTTP + B UI 검증 → ④주 구현이 통합 증거 확인 → ⑤독립 보안·데이터 경계 검토 → ⑥별도 실행 보조가 최종 `npm run quality` 실행. 실행 보조는 구현자 수를 늘리지 않으며 파일 수정 없이 결과만 보고한다. 준비 migration부터 활성화까지 실제 upgrade, scheduler gate OFF/ON, 실제 Auth→HTTP→앱은 각각 다른 증거로 기록한다.

### 14.4 Figma 추출 목록

| P04 범위 | 추출할 노드 ID | 필요한 명세 |
|---|---|---|
| 메이트 나가기 | `561:1734`, `561:1815`, 주석 `561:1906` | 버튼·확인창·비활성 이유·뒤로/취소. confirmed 문구는 §3.1 승인 계약 우선. |
| 방에서 나간 뒤 | `590:2164`, 주석 `590:2266` | 토스트·목록 제거·다른 정산/방·탭 연결. |
| 6칸·오류·미리보기 | `543:1665`, `559:1657`, `590:2533`, 주석 `590:2650` | 입력/완료/오류/미리보기 위치·focus·CTA. 5자리 비활성·6자리 서버 조회. |
| 5회 잠금 | `559:1657`, 주석 `590:2650`을 먼저 추출 | 전용 frame ID 미식별. 확인되는 추가 ID만 후속 목록에 기록. 시간은 D4의 15분, 서버 retry_at 기준으로 구현. |
| 메이트 초대 시트 | `561:1945`, `628:2083` | 코드 복사·TTL·OS 공유·닫기. 링크/카카오 버튼은 D6 A로 제외. |
| 방장 상세·종료 | `528:1525`, `528:1604` | 위임 진입 위치·종료 확인·pending 취소 안내. 위임 상세 자체는 시안 없음. |
| 완료/기한 안내 | `548:1675`, `631:6106` | 완료 후/재정산 기한 문구·실제 timestamp 렌더. |

`543:1609` 웹 랜딩과 `628:1934` 링크 복사 완료는 D6 A로 **이번 필수 추출/구현에서 제외**한다. 위임 화면 ID는 없으며 기존 컴포넌트+`[결정]` 주석으로 진행한다. 추가 Figma 시안은 이후 선택 작업이다.

## 15. 운영 전 읽기 전용 사전 집계 SQL

아래는 **문서에만 작성한 쿼리**이며 실행하지 않았다. 별도 승인된 조회 세션에서 `BEGIN TRANSACTION READ ONLY;`로 시작해 조회 후 `ROLLBACK;`한다. D8 쿼리는 본문/이름/코드/식별자를 출력하지 않고 건수만 반환한다. D10/D11은 통계 설정을 바꾸거나 reset하지 않는다. 권한/extension/통계가 없으면 `미확인`으로 기록한다. 실패를 0건으로 바꾸지 않는다.

### 15.1 Q0: 스키마·관측 가능 범위

```sql
BEGIN TRANSACTION READ ONLY;
SELECT statement_timestamp() AS observed_at,
       current_setting('track_functions') AS track_functions,
       to_regprocedure('public.post_room_system_message(uuid,text)') IS NOT NULL AS r1_exists;
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='rooms'
  AND column_name IN ('stage','created_at','expires_at','settled_at','appointment_confirmed_at')
ORDER BY column_name;
SELECT e.extname, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
WHERE e.extname IN ('pg_stat_statements','pg_cron');
SELECT stats_reset FROM pg_stat_database WHERE datname=current_database();
ROLLBACK;
```

Q0의 S4 컬럼 유무와 실제 migration identity를 함께 확인한다. Q1은 S4 전에도 존재하는 기본 rooms/bill/member를 전제로 하며 추가 시각 컬럼은 `to_jsonb`로 선택적으로 읽는다. 해당 기본 테이블 자체가 없으면 실행하지 않는다.

### 15.2 Q1: D8 단축·즉시 만료·불명 기점 대상 수

```sql
BEGIN TRANSACTION READ ONLY;
WITH observed AS (
  SELECT statement_timestamp() AS at
), room_values AS (
  SELECT r.id, r.code,
         CASE WHEN octet_length(r.code)<=64 AND upper(btrim(r.code)) ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
              THEN upper(btrim(r.code)) END AS normalized_code,
         r.expires_at, r.created_at,
         to_jsonb(r)->>'stage' AS stage,
         (to_jsonb(r)->>'appointment_confirmed_at')::timestamptz AS confirmed_at,
         (to_jsonb(r)->>'settled_at')::timestamptz AS settled_at
  FROM public.rooms r
), code_values AS (
  SELECT v.*, count(*) OVER (PARTITION BY normalized_code) AS normalized_code_count
  FROM room_values v
), anchors AS (
  SELECT v.*, o.at,
    CASE WHEN isfinite(v.created_at) AND v.created_at<=o.at
         THEN v.created_at END AS trusted_created_at,
    CASE WHEN isfinite(v.confirmed_at)
               AND v.confirmed_at BETWEEN v.created_at AND o.at
               AND isfinite(v.created_at)
         THEN v.confirmed_at END AS trusted_confirmed_at,
    CASE WHEN isfinite(v.settled_at) AND v.settled_at<=o.at
               AND v.settled_at>=v.created_at
         THEN v.settled_at END AS trusted_settled_at
  FROM code_values v CROSS JOIN observed o
), caps AS (
  SELECT a.*,
    CASE
      WHEN confirmed_at IS NOT NULL AND trusted_confirmed_at IS NULL THEN NULL
      WHEN trusted_confirmed_at IS NOT NULL THEN trusted_confirmed_at+interval '30 days'
      WHEN trusted_created_at IS NOT NULL THEN trusted_created_at+interval '7 days'
      ELSE NULL
    END AS anchor_cap
  FROM anchors a
), evaluated AS (
  SELECT c.*,
    CASE WHEN anchor_cap IS NULL THEN NULL
         WHEN stage='done' AND trusted_settled_at IS NOT NULL
           THEN least(anchor_cap, trusted_settled_at+interval '24 hours')
         ELSE anchor_cap END AS target_cap,
    EXISTS (
      SELECT 1 FROM public.dutch_pay_bills b
      WHERE b.room_id=c.id AND (
        NOT EXISTS (SELECT 1 FROM public.dutch_pay_members m WHERE m.bill_id=b.id)
        OR EXISTS (SELECT 1 FROM public.dutch_pay_members m
                   WHERE m.bill_id=b.id AND m.is_completed IS NOT TRUE)
      )
    ) AS has_unfinished
  FROM caps c
)
SELECT count(*) AS total_rooms,
       count(*) FILTER (WHERE expires_at<=at) AS already_expired,
       count(*) FILTER (WHERE NOT isfinite(expires_at)) AS nonfinite_expiry,
       count(*) FILTER (WHERE target_cap IS NULL) AS unknown_anchor,
       count(*) FILTER (WHERE stage IN ('settling','done') AND confirmed_at IS NULL)
         AS legacy_settlement_without_confirmation,
       count(*) FILTER (WHERE stage='done' AND trusted_settled_at IS NULL)
         AS done_without_valid_completion_time,
       count(*) FILTER (WHERE target_cap IS NOT NULL AND expires_at>target_cap)
         AS would_shorten,
       count(*) FILTER (WHERE expires_at>at AND target_cap<=at AND expires_at>target_cap)
         AS live_rooms_becoming_expired,
       count(*) FILTER (WHERE has_unfinished AND target_cap IS NOT NULL
                         AND expires_at>target_cap) AS unfinished_rooms_to_shorten,
       count(*) FILTER (WHERE normalized_code IS NULL OR code IS DISTINCT FROM normalized_code)
         AS invalid_code_rooms,
       count(*) FILTER (WHERE normalized_code IS NOT NULL AND normalized_code_count>1)
         AS duplicate_normalized_code_rooms
FROM evaluated;
ROLLBACK;
```

`invalid_code_rooms`는 `s3_normalize_code`가 거절하거나 저장값이 정규화 결과와 다른 방 수(소문자·양끝 공백 포함)다. `duplicate_normalized_code_rooms`는 유효하게 정규화된 같은 코드가 2개 이상인 그룹에 속한 모든 방 수이며 그룹 수가 아니다. 두 건수는 겹칠 수 있고, NULL 정규화 결과끼리는 중복으로 세지 않는다. Q1은 S3 준비 전에도 읽을 수 있도록 같은 정규화 식을 인라인한다.

기존 expires_at를 늘리지 않고 `least(기존 기한,target_cap)`으로 보정할 대상 건수다. 위 SQL은 **D8 기본/절대 cap 집계**이며 재정산마다 7일이 재계산된 경로의 정확성까지 인증하지 않는다. S4 bill 시각·함수 identity 검증과 함께 사용한다. 시간 필드에 잘못된 타입/형식이 있어 캐스팅이 실패하면 중단하고 “불명”으로 보고하며 값을 출력하지 않는다. 과거 관리자가 만든 시각의 진실성은 형식 검사로 증명하지 못한다.

`unknown_anchor`에는 자동 보정을 하지 않는다. 고정 전환일을 정한 뒤 최대7일 유예의 별도 대상 수만 집계하고, 해당 고정일을 migration 승인 내용에 넣는다. `already_expired`는 유예로 복구하지 않는다. 단축 건수와 물리 삭제 예정 건수는 다르다. 기한 보정·cleanup 실행 승인은 각각 받는다.

### 15.3 Q2: D10 R1 권한·함수 호출 통계

```sql
BEGIN TRANSACTION READ ONLY;
SELECT to_regprocedure('public.post_room_system_message(uuid,text)') IS NOT NULL AS exists,
       has_function_privilege('authenticated',
         to_regprocedure('public.post_room_system_message(uuid,text)'), 'EXECUTE')
         AS authenticated_execute,
       has_function_privilege('anon',
         to_regprocedure('public.post_room_system_message(uuid,text)'), 'EXECUTE')
         AS anon_execute;
SELECT count(*) AS tracked_rows, sum(calls) AS observed_calls
FROM pg_stat_user_functions
WHERE schemaname='public' AND funcname='post_room_system_message';
ROLLBACK;
```

`tracked_rows=0` 또는 `track_functions=none`은 미호출 증거가 아니다. `calls`는 사용자·빌드 버전을 구별하지 않고 reset/재시작/통계 지연의 영향을 받는다. 과거 시스템 메시지 행 수는 서버 이벤트와 위장 RPC를 구별할 수 없어 대체 근거로 쓰지 않는다.

### 15.4 Q3: D10/D11 SQL 관측 후보 집계

Q0에서 extension을 확인한 경우에만 실행한다. 아래 `extensions`는 **Q0에서 반환된 실제 extension_schema로 대체**한다(식별자 인용 적용). view 미설치/읽기 권한 없음은 미확인이다. query 본문은 서버 내부 필터에만 사용하고 결과로 내보내지 않는다.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT kind, count(*) AS statement_shapes, sum(calls) AS observed_calls
FROM (
  SELECT calls,
    CASE
      WHEN query ~* 'post_room_system_message"?[[:space:]]*[(]' THEN 'r1_call_candidate'
      WHEN query ~* 'insert[[:space:]]+into[[:space:]]+("public"[.]|public[.])?"?rooms"?[[:space:](]'
        THEN 'rooms_insert_candidate'
      ELSE NULL
    END AS kind
  FROM extensions.pg_stat_statements
  WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
) s
WHERE kind IS NOT NULL
GROUP BY kind ORDER BY kind;
SELECT n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables WHERE schemaname='public' AND relname='rooms';
ROLLBACK;
```

이 집계는 **후보**다. 문자열·주석에 따른 오탐, 함수 내부 INSERT와 direct PostgREST INSERT 혼합, 정규화·stats eviction·track 설정에 따른 누락이 있다. `n_tup_ins`는 전체 INSERT로 caller·RPC·앱 버전을 구별하지 못한다. pg_stat_statements의 reset 시각/track 설정은 설치 버전이 제공하는 metadata를 별도 읽기 확인하고, metadata가 없으면 관측 기간 불명으로 기록한다. 0건으로 베타 미사용이나 회수 안전을 승인하지 않는다.

### 15.5 Q4: D11 table·column grant와 정책 집계

```sql
BEGIN TRANSACTION READ ONLY;
SELECT has_table_privilege('authenticated','public.rooms','INSERT')
         AS table_insert_grant,
       has_any_column_privilege('authenticated','public.rooms','INSERT')
         AS any_column_insert_grant;
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='rooms'
  AND grantee='authenticated' AND privilege_type='INSERT'
ORDER BY column_name;
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE schemaname='public' AND tablename='rooms'
ORDER BY policyname;
ROLLBACK;
```

권한/정책 존재는 “호출할 수 있음”의 증거이며 사용 증거가 아니다. RLS predicate 검토는 함수·migration identity 대조로 별도 수행한다. R1/D11 cutover 자료에는 다음을 함께 첨부한다.

- 관측 시작/끝·reset/누락 여부·위 집계 결과(미확인 포함).
- 배포할 Play 베타의 versionCode·artifact digest·해당 소스 commit, R1 호출 제거 및 S3 capability 후 direct INSERT 미사용을 보여주는 정적 검색·테스트.
- 이미 존재하는 접근 로그에서 `/rest/v1/rpc/post_room_system_message`, `POST /rest/v1/rooms`의 시간 구간별 **합계만** 읽기 집계한 증거. 현재 로그 schema는 미확인이라 존재하지 않는 테이블/SQL을 만들지 않는다. 본문·코드·IP·토큰은 열람·출력하지 않는다.
- 신앱/구서버에서는 direct INSERT가 의도된 fallback이므로 서버 활성화 전 호출 0건을 필수 조건으로 삼지 않는다. **지원 베타가 S3 확인 후 RPC로 전환함**, 미지원 구버전은 업데이트가 필요함을 검증한다. SQL 통계만으로 최소 베타 버전을 판별하지 않는다.
