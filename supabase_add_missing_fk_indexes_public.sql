-- Add covering indexes for foreign keys in public schema (performance)
-- Applied via MCP migration: add_missing_fk_indexes_public

create index if not exists idx_admin_audit_log_admin_id on public.admin_audit_log (admin_id);
create index if not exists idx_admin_audit_log_group_id on public.admin_audit_log (group_id);
create index if not exists idx_admin_audit_log_target_user_id on public.admin_audit_log (target_user_id);

create index if not exists idx_announcement_reads_announcement_id on public.announcement_reads (announcement_id);
create index if not exists idx_announcements_created_by on public.announcements (created_by);

create index if not exists idx_dashboard_access_requests_approved_by on public.dashboard_access_requests (approved_by);
create index if not exists idx_dashboard_access_requests_group_id on public.dashboard_access_requests (group_id);
create index if not exists idx_dashboard_access_requests_requested_by on public.dashboard_access_requests (requested_by);

create index if not exists idx_family_events_created_by on public.family_events (created_by);
create index if not exists idx_family_messages_group_id on public.family_messages (group_id);
create index if not exists idx_family_messages_sender_id on public.family_messages (sender_id);
create index if not exists idx_family_tasks_assigned_to on public.family_tasks (assigned_to);
create index if not exists idx_family_tasks_created_by on public.family_tasks (created_by);
create index if not exists idx_family_tasks_group_id on public.family_tasks (group_id);

create index if not exists idx_groups_owner_id on public.groups (owner_id);

create index if not exists idx_location_requests_group_id on public.location_requests (group_id);
create index if not exists idx_location_requests_requester_id on public.location_requests (requester_id);

create index if not exists idx_memory_vault_group_id on public.memory_vault (group_id);
create index if not exists idx_memory_vault_uploader_id on public.memory_vault (uploader_id);

create index if not exists idx_piggy_account_requests_group_id on public.piggy_account_requests (group_id);
create index if not exists idx_piggy_bank_accounts_group_id on public.piggy_bank_accounts (group_id);

create index if not exists idx_piggy_bank_transactions_actor_id on public.piggy_bank_transactions (actor_id);
create index if not exists idx_piggy_bank_transactions_group_id on public.piggy_bank_transactions (group_id);
create index if not exists idx_piggy_bank_transactions_related_user_id on public.piggy_bank_transactions (related_user_id);

create index if not exists idx_piggy_bank_transactions_archive_snapshot_id on public.piggy_bank_transactions_archive (snapshot_id);

create index if not exists idx_piggy_open_approvals_approver_id on public.piggy_open_approvals (approver_id);
create index if not exists idx_piggy_open_approvals_request_id on public.piggy_open_approvals (request_id);

create index if not exists idx_piggy_open_requests_child_id on public.piggy_open_requests (child_id);
create index if not exists idx_piggy_open_requests_group_id on public.piggy_open_requests (group_id);

create index if not exists idx_piggy_wallet_transactions_actor_id on public.piggy_wallet_transactions (actor_id);
create index if not exists idx_piggy_wallet_transactions_group_id on public.piggy_wallet_transactions (group_id);

create index if not exists idx_piggy_wallet_transactions_archive_snapshot_id on public.piggy_wallet_transactions_archive (snapshot_id);

create index if not exists idx_piggy_wallets_group_id on public.piggy_wallets (group_id);

create index if not exists idx_push_tokens_user_id on public.push_tokens (user_id);

create index if not exists idx_support_tickets_answered_by on public.support_tickets (answered_by);
create index if not exists idx_support_tickets_created_by on public.support_tickets (created_by);
create index if not exists idx_support_tickets_group_id on public.support_tickets (group_id);

create index if not exists idx_system_admins_created_by on public.system_admins (created_by);
create index if not exists idx_system_admins_user_id on public.system_admins (user_id);

create index if not exists idx_travel_accommodations_created_by on public.travel_accommodations (created_by);
create index if not exists idx_travel_accommodations_deleted_by on public.travel_accommodations (deleted_by);
create index if not exists idx_travel_accommodations_group_id on public.travel_accommodations (group_id);
create index if not exists idx_travel_accommodations_trip_id on public.travel_accommodations (trip_id);
create index if not exists idx_travel_accommodations_updated_by on public.travel_accommodations (updated_by);

create index if not exists idx_travel_attractions_created_by on public.travel_attractions (created_by);
create index if not exists idx_travel_attractions_deleted_by on public.travel_attractions (deleted_by);
create index if not exists idx_travel_attractions_group_id on public.travel_attractions (group_id);
create index if not exists idx_travel_attractions_trip_id on public.travel_attractions (trip_id);
create index if not exists idx_travel_attractions_updated_by on public.travel_attractions (updated_by);

create index if not exists idx_travel_dining_created_by on public.travel_dining (created_by);
create index if not exists idx_travel_dining_deleted_by on public.travel_dining (deleted_by);
create index if not exists idx_travel_dining_group_id on public.travel_dining (group_id);
create index if not exists idx_travel_dining_trip_id on public.travel_dining (trip_id);
create index if not exists idx_travel_dining_updated_by on public.travel_dining (updated_by);

create index if not exists idx_travel_expenses_created_by on public.travel_expenses (created_by);
create index if not exists idx_travel_expenses_deleted_by on public.travel_expenses (deleted_by);
create index if not exists idx_travel_expenses_group_id on public.travel_expenses (group_id);
create index if not exists idx_travel_expenses_paid_by on public.travel_expenses (paid_by);
create index if not exists idx_travel_expenses_trip_id on public.travel_expenses (trip_id);
create index if not exists idx_travel_expenses_updated_by on public.travel_expenses (updated_by);

create index if not exists idx_travel_itineraries_created_by on public.travel_itineraries (created_by);
create index if not exists idx_travel_itineraries_deleted_by on public.travel_itineraries (deleted_by);
create index if not exists idx_travel_itineraries_group_id on public.travel_itineraries (group_id);
create index if not exists idx_travel_itineraries_trip_id on public.travel_itineraries (trip_id);
create index if not exists idx_travel_itineraries_updated_by on public.travel_itineraries (updated_by);

create index if not exists idx_travel_transports_created_by on public.travel_transports (created_by);
create index if not exists idx_travel_transports_deleted_by on public.travel_transports (deleted_by);
create index if not exists idx_travel_transports_group_id on public.travel_transports (group_id);
create index if not exists idx_travel_transports_trip_id on public.travel_transports (trip_id);
create index if not exists idx_travel_transports_updated_by on public.travel_transports (updated_by);

create index if not exists idx_travel_trips_created_by on public.travel_trips (created_by);
create index if not exists idx_travel_trips_deleted_by on public.travel_trips (deleted_by);
create index if not exists idx_travel_trips_group_id on public.travel_trips (group_id);
create index if not exists idx_travel_trips_updated_by on public.travel_trips (updated_by);

create index if not exists idx_user_locations_user_id on public.user_locations (user_id);

