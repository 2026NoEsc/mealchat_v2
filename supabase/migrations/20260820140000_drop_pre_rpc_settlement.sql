-- RPC 이전에 직접 INSERT 된 정산 한 건을 지운다.
--
-- 정산 참가자 행은 create_room_settlement 가 방 참가자 명단에서 옮겨 담는다
-- (20260817200241_open_room_features.sql). 그 함수가 생기기 전에 만들어진 정산은
-- dutch_pay_members 가 비어 있고, 완료 표시가 그 테이블에만 있으므로 **누구도
-- 끝낼 수 없다.** 홈의 정산 넛지에 영원히 "진행 중" 으로 남는다.
--
-- 지우는 대상은 한 건이다.
--
--   id          611157aa-2d1b-4215-a1ee-0b728505af5f
--   title       회사 팀 점심            ← 방 이름 그대로. RPC 는 bill_title 을 받는다
--   created_at  2026-08-12 22:22:54     ← RPC 도입(2026-08-17)보다 5일 앞선다
--   members     0 행
--
-- 같은 방의 다른 정산(d446bfd5, 2026-08-19, 참가자 1명 완료)은 RPC 를 거쳐 정상이라
-- 건드리지 않는다. 그래서 조건을 넓히지 않고 id 로 한정한다 — 앞으로 만들어지는
-- 정산은 전부 RPC 를 지나므로 이 문제가 다시 생기지 않는다.
--
-- 이미 없으면 아무 일도 하지 않는다.

delete from public.dutch_pay_bills
where id = '611157aa-2d1b-4215-a1ee-0b728505af5f'
  and not exists (
    select 1 from public.dutch_pay_members member where member.bill_id = dutch_pay_bills.id
  );
