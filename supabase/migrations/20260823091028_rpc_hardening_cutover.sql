-- Cutover phase: apply only after the minimum supported app version is known
-- to use create_room_invitation/accept_room_invitation, create_room_settlement_v2,
-- set_settlement_completed, and confirm_room_vote. The additive migration already
-- closed direct bill/room/participant writes; this file removes only paths needed
-- by an installed stale client.
--
-- Preflight outside this migration:
--   1. Enforce the minimum app version and confirm old clients are no longer active.
--   2. Run the two-user invitation, settlement and vote isolation/concurrency suite.
--   3. Confirm all active clients use settlement v2 and no v1 compatibility path is needed.

/* --------------------------------------------------------------------------
 * Forced invitation: stale clients still expect immediate participation
 * ----------------------------------------------------------------------- */

revoke all on function public.invite_friend_to_room(uuid, uuid)
  from public, anon, authenticated;

/* --------------------------------------------------------------------------
 * Legacy notification INSERT and direct settlement completion
 * ----------------------------------------------------------------------- */

drop policy if exists notifications_insert_legacy_member on public.notifications;
-- The additive table-level revoke leaves this column grant behind until old app
-- versions no longer call sendSettlementNotification.
revoke insert (room_id, title, message, bank_name, account_number, amount)
  on public.notifications from anon, authenticated;

-- v1 shares the server-owned linked notification but deliberately has no fixed
-- system event, allowing its legacy UI message during the transition. Once the
-- minimum version is enforced, remove that compatibility path and require v2.
revoke all on function public.create_room_settlement(uuid, text, integer, text, text, text)
  from public, anon, authenticated;

drop policy if exists dutch_pay_members_update_own on public.dutch_pay_members;
revoke update (is_completed) on public.dutch_pay_members from anon, authenticated;

/* --------------------------------------------------------------------------
 * Generic system messages are replaced by state-changing event RPCs
 * ----------------------------------------------------------------------- */

revoke all on function public.post_room_system_message(uuid, text)
  from public, anon, authenticated;
