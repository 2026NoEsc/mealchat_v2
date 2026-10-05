import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrations = join(process.cwd(), 'supabase', 'migrations');
const deferredMigrations = join(process.cwd(), 'supabase', 'deferred_migrations');
const containmentSql = readFileSync(
  join(migrations, '20260906141801_contain_meeting_midpoint.sql'),
  'utf8',
);
const hardeningSql = readFileSync(
  join(migrations, '20260823072701_harden_settlement_invitation_events.sql'),
  'utf8',
);
const rehardeningSql = readFileSync(
  join(migrations, '20260906134305_rpc_concurrency_rehardening.sql'),
  'utf8',
);
const cutoverSql = readFileSync(
  join(deferredMigrations, '20260823091028_rpc_hardening_cutover.sql'),
  'utf8',
);

describe('RPC hardening migration contract', () => {
  it('keeps the P0 midpoint containment independently deployable', () => {
    expect(containmentSql).toMatch(/revoke all on function public\.meeting_midpoint\(uuid\[\], double precision, double precision\)/i);
    expect(containmentSql).toMatch(/from public, anon, authenticated/i);
    expect(containmentSql).not.toMatch(/create table|create or replace function/i);
  });

  it('keeps additive hardening deployable while deferring stale-client cutover', () => {
    expect(hardeningSql).not.toMatch(/revoke all on function public\.invite_friend_to_room/i);
    expect(hardeningSql).not.toMatch(/revoke all on function public\.post_room_system_message/i);
    expect(cutoverSql).toMatch(/revoke all on function public\.invite_friend_to_room/i);
    expect(cutoverSql).toMatch(/revoke all on function public\.post_room_system_message/i);
    expect(hardeningSql).toMatch(
      /revoke insert, update, delete on public\.dutch_pay_bills/i,
    );
    expect(hardeningSql).toMatch(
      /revoke update \(title, total_amount, split_count, bank_name, account_number, account_holder\)\s+on public\.dutch_pay_bills from anon, authenticated/i,
    );
    expect(hardeningSql).toMatch(/revoke delete on public\.participants from anon, authenticated/i);
    expect(hardeningSql).toMatch(/revoke delete on public\.rooms from anon, authenticated/i);
    expect(hardeningSql).toMatch(/revoke insert on public\.notifications from anon, authenticated/i);
    expect(hardeningSql).toMatch(/grant insert \(room_id, title, message, bank_name, account_number, amount\)/i);
    expect(hardeningSql).toMatch(/and settlement_id is null/i);
    expect(cutoverSql).toMatch(/revoke insert \(room_id, title, message, bank_name, account_number, amount\)/i);
    expect(cutoverSql).toMatch(/revoke all on function public\.create_room_settlement\(uuid, text, integer, text, text, text\)/i);
    expect(cutoverSql).toMatch(/revoke update \(is_completed\) on public\.dutch_pay_members/i);
    expect(cutoverSql).not.toMatch(/revoke insert, update, delete on public\.dutch_pay_bills/i);
  });

  it('serializes pending invitations and active settlements with fixed search paths', () => {
    expect(hardeningSql).toMatch(/room_invitations_one_pending_per_target_idx/i);
    expect(hardeningSql).toMatch(/pg_advisory_xact_lock/i);
    expect(hardeningSql).toMatch(/create or replace function private\.create_room_settlement_impl[\s\S]*?set search_path = ''/i);
    expect(hardeningSql).toMatch(/create or replace function public\.create_room_settlement_v2[\s\S]*?set search_path = ''/i);
    expect(hardeningSql).toMatch(/create or replace function public\.accept_room_invitation[\s\S]*?set search_path = ''/i);
  });

  it('deduplicates server-generated settlement and vote events', () => {
    expect(hardeningSql).toMatch(/messages_system_event_key_unique_idx/i);
    expect(hardeningSql).toMatch(/notifications_settlement_id_unique_idx/i);
    expect(hardeningSql).toMatch(/create or replace function public\.create_room_settlement_v2/i);
    expect(hardeningSql).toMatch(/create or replace function public\.confirm_room_vote/i);
    expect(hardeningSql).toMatch(/on conflict do nothing/i);
    expect(hardeningSql).toMatch(/on conflict \(settlement_id\) where settlement_id is not null do update/i);
    expect(hardeningSql).toMatch(/create or replace function public\.set_settlement_completed\(\s*target_member uuid,\s*completed boolean/i);
  });

  it('keeps settlement visibility and completion scoped to the fixed recipient snapshot', () => {
    expect(hardeningSql).toMatch(/or exists \(\s*select 1\s*from public\.dutch_pay_members member/i);
    const notificationPolicy = hardeningSql.slice(
      hardeningSql.indexOf('create policy notifications_select_bill_recipient'),
      hardeningSql.indexOf('-- 정산 완료 표시는 RPC 하나로만 바꾼다.'),
    );
    expect(notificationPolicy).toMatch(/settlement_id is not null\s+and private\.is_bill_visible\(settlement_id\)/i);
    expect(notificationPolicy).not.toMatch(/private\.is_room_member\(room_id\)/i);
    expect(hardeningSql).toMatch(/set split_count = snapshot_member_count/i);
    expect(hardeningSql).toMatch(/from public\.dutch_pay_members member\s+where member\.bill_id = target_bill/i);
    expect(hardeningSql).toMatch(/amount is null or amount <= 0/i);
  });

  it('keeps v1 event-free for stale clients while routing the current client through v2 events', () => {
    const v1 = hardeningSql.slice(
      hardeningSql.indexOf('create or replace function public.create_room_settlement('),
      hardeningSql.indexOf('create or replace function public.create_room_settlement_v2('),
    );
    const v2 = hardeningSql.slice(
      hardeningSql.indexOf('create or replace function public.create_room_settlement_v2('),
      hardeningSql.indexOf('create or replace function public.set_settlement_completed('),
    );
    expect(v1).toMatch(/account_holder, false/i);
    expect(v1).not.toMatch(/settlement-created:/i);
    expect(v1).toMatch(/grant execute on function public\.create_room_settlement\(uuid, text, integer, text, text, text\)\s+to authenticated/i);
    expect(v2).toMatch(/account_holder, true/i);
    expect(v2).not.toMatch(/settlement-created:/i);
    expect(hardeningSql).toMatch(/if emit_server_events then[\s\S]*?settlement-created:/i);
    expect(cutoverSql).toMatch(/revoke all on function public\.create_room_settlement\(uuid, text, integer, text, text, text\)\s+from public, anon, authenticated/i);

    const settlementHelper = hardeningSql.slice(
      hardeningSql.indexOf('create or replace function private.create_room_settlement_impl('),
      hardeningSql.indexOf('revoke all on function private.create_room_settlement_impl'),
    );
    const serverEvents = settlementHelper.slice(
      settlementHelper.indexOf('if emit_server_events then'),
      settlementHelper.indexOf('-- 새 정산과 수정 정산 모두 연결 알림'),
    );
    const linkedNotification = settlementHelper.slice(
      settlementHelper.indexOf('-- 새 정산과 수정 정산 모두 연결 알림'),
      settlementHelper.indexOf('return target_bill;'),
    );
    expect(serverEvents).toMatch(/insert into public\.messages/i);
    expect(serverEvents).not.toMatch(/insert into public\.notifications/i);
    expect(linkedNotification).toMatch(/insert into public\.notifications/i);
    expect(linkedNotification).toMatch(/on conflict \(settlement_id\) where settlement_id is not null do update/i);
  });

  it('locks direct room creation down to the client creation contract', () => {
    expect(hardeningSql).toMatch(/revoke insert on public\.rooms from anon, authenticated/i);
    expect(hardeningSql).toMatch(/grant insert \([\s\S]*?confirmed_slot, color, location_name[\s\S]*?\) on public\.rooms/i);
    expect(hardeningSql).toMatch(/is_confirmed = \(confirmed_slot is not null\)/i);
    expect(hardeningSql).toMatch(/confirmed_menu_item_id is null/i);
    expect(hardeningSql).toMatch(/confirmed_time_item_id is null/i);
    expect(hardeningSql).toMatch(/drop policy if exists rooms_update_member on public\.rooms/i);
    expect(hardeningSql).toMatch(/revoke update on public\.rooms from anon, authenticated/i);
    expect(cutoverSql).not.toMatch(/revoke update on public\.rooms from anon, authenticated/i);
  });

  it('makes confirmed vote item ids final and requires a server-computed strict-majority leader', () => {
    expect(hardeningSql).toMatch(/confirmed_menu_item_id uuid/i);
    expect(hardeningSql).toMatch(/confirmed_time_item_id uuid/i);
    expect(hardeningSql).toMatch(/order by candidate\.vote_count desc, candidate\.ordinality asc/i);
    expect(hardeningSql).toMatch(/only the leading vote option can be confirmed/i);
    expect(hardeningSql).toMatch(/participant\.profile_id is not null/i);
    expect(hardeningSql).toMatch(/leading_vote_count <= member_count \/ 2/i);
    expect(hardeningSql).toMatch(/a strict majority is required before confirmation/i);
    expect(hardeningSql).toMatch(/create or replace function public\.add_voting_item[\s\S]*?pg_advisory_xact_lock[\s\S]*?for update/i);
    expect(hardeningSql).toMatch(/create or replace function public\.toggle_vote[\s\S]*?pg_advisory_xact_lock[\s\S]*?for update/i);
    expect(hardeningSql).toMatch(/item_kind is null or item_kind not in \('menu', 'time'\)/i);
    expect(hardeningSql).toMatch(/label is null or label = ''/i);
    expect(hardeningSql).toMatch(/char_length\(label\) > 120/i);
    expect(hardeningSql).toMatch(/\) >= 30 then/i);

    const toggleVote = hardeningSql.slice(
      hardeningSql.indexOf('create or replace function public.toggle_vote'),
      hardeningSql.indexOf('create or replace function public.confirm_room_vote'),
    );
    expect(toggleVote.indexOf('Only room members can vote')).toBeLessThan(
      toggleVote.indexOf("select item ->> 'kind' into selected_kind"),
    );
  });

  it('serializes invitation creation through the room lock before membership checks', () => {
    const createInvitation = hardeningSql.slice(
      hardeningSql.indexOf('create or replace function public.create_room_invitation'),
      hardeningSql.indexOf('create or replace function public.accept_room_invitation'),
    );
    expect(createInvitation.indexOf('pg_advisory_xact_lock')).toBeLessThan(
      createInvitation.indexOf('private.is_room_member'),
    );
    expect(createInvitation).not.toMatch(/target_room::text \|\| ':' \|\| invitee_id::text/i);
    expect(createInvitation).not.toMatch(/invitation\.invitee_id\s*=\s*invitee_id/i);
    expect(createInvitation).toMatch(/invitation\.invitee_id\s*=\s*\$2/i);
  });

  it('restores the shared lock order after later migrations redefined the RPCs', () => {
    for (const functionName of ['remove_voting_item', 'toggle_vote', 'leave_room']) {
      const functionSql = rehardeningSql.slice(
        rehardeningSql.indexOf(`create or replace function public.${functionName}`),
        rehardeningSql.indexOf('$$;', rehardeningSql.indexOf(`create or replace function public.${functionName}`)) + 3,
      );
      expect(functionSql).toMatch(/security definer/i);
      expect(functionSql).toMatch(/set search_path = ''/i);
      expect(functionSql).toMatch(/pg_catalog\.pg_advisory_xact_lock/i);
    }

    expect(rehardeningSql).toMatch(/from public\.rooms\s+where id = target_room\s+for update/i);
    expect(rehardeningSql).toMatch(/revoke all on function public\.toggle_vote\(uuid, uuid\) from public, anon, authenticated/i);
    expect(rehardeningSql).toMatch(/grant execute on function public\.leave_room\(uuid\) to authenticated/i);
    expect(rehardeningSql).toMatch(/Cannot change options after confirmation/i);
    expect(rehardeningSql).toMatch(/Voting is already confirmed/i);
  });
});
