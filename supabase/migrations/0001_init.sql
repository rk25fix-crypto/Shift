-- Shift: initial schema + Row-Level Security policies.
--
-- Tenancy model: shared schema, shared tables, RLS by organization_id (see
-- docs/plan.md "マルチテナント・認証モデル"). This is the correctness
-- backbone of the whole product — a missing or wrong policy here is a
-- cross-tenant data leak, not just a bug. Every policy below routes through
-- is_org_member()/has_org_role() rather than repeating the membership
-- subquery inline, so there is exactly one place to get it right.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- Tables
-- ============================================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  timezone text not null default 'Asia/Tokyo',
  -- 勤務ルール設定 (docs/plan.md 参照) — thresholds an org sets for itself,
  -- not a restatement of the Labor Standards Act. See lib/labor-rules.ts.
  max_consecutive_days smallint not null default 6,
  max_weekly_hours smallint not null default 40,
  max_monthly_hours smallint not null default 160,
  min_break_minutes_over_6h smallint not null default 45,
  min_break_minutes_over_8h smallint not null default 60,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Staff "roster" record — distinct from auth.users, since a part-time staff
-- member may never get a login (see docs/plan.md, Phase 3 note on staff
-- self-service being optional).
create table staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  role_label text,
  fixed_days_off smallint[] not null default '{}', -- 0=Sun..6=Sat
  unavailable_shift_type_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Split from `staff` on purpose: RLS is row-level, so keeping wages on the
-- `staff` row would leak coworkers' pay the moment a staff member gets
-- their own login (docs/plan.md, "時給を`staff`から分離する理由").
create table staff_compensation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null unique references staff(id) on delete cascade,
  hourly_wage integer not null,
  updated_at timestamptz not null default now()
);

create table shift_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  crosses_midnight boolean not null default false,
  break_minutes smallint not null default 0,
  is_required boolean not null default false,
  is_balanced boolean not null default false,
  color_key text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- One row per staff x date x shift_type, not one JSON blob per staff (both
-- legacy prototypes did the latter) — this is what makes labor-rule checks
-- and payroll aggregation plain SQL instead of client-side loops, and lets
-- a single day carry more than one shift.
create table shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  shift_type_id uuid not null references shift_types(id) on delete restrict,
  date date not null,
  -- auto-generate writes 'draft' rows for the manager to review before
  -- 'confirmed' publishes them (docs/plan.md).
  status text not null check (status in ('draft', 'confirmed')) default 'confirmed',
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (staff_id, date, shift_type_id)
);

create table time_off_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  status text not null check (status in ('requested', 'acknowledged')) default 'requested',
  note text,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);

create table swap_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  date date not null,
  from_staff_id uuid not null references staff(id),
  to_staff_id uuid not null references staff(id),
  from_shift_type_id uuid references shift_types(id),
  to_shift_type_id uuid references shift_types(id),
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  requested_by uuid references auth.users(id),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- last processed Stripe webhook event id, for idempotency (a resent event
  -- must not double-apply — e.g. extend a trial twice).
  stripe_event_id text,
  plan text not null check (plan in ('trial', 'standard', 'pro')) default 'trial',
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')) default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Every RLS policy below joins through memberships keyed on (user_id,
-- organization_id) — this is the index that keeps that check cheap
-- (docs/plan.md, "定石の性能対策").
create index memberships_user_org_idx on memberships (user_id, organization_id);

create index staff_org_idx on staff (organization_id);
create index shift_types_org_idx on shift_types (organization_id);
create index shift_assignments_org_date_idx on shift_assignments (organization_id, date);
create index shift_assignments_staff_date_idx on shift_assignments (staff_id, date);
create index time_off_requests_org_idx on time_off_requests (organization_id);
create index swap_requests_org_idx on swap_requests (organization_id, date);
create index audit_log_org_idx on audit_log (organization_id, created_at desc);

-- ============================================================================
-- Helper functions (security definer — read memberships once, used by every
-- policy below so there is a single place tenant-membership logic lives)
-- ============================================================================

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = target_org_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = target_org_id
      and user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;

-- True when the caller's own `staff` roster row is the one referenced by
-- target_staff_id — used to let a staff member manage their own time-off /
-- swap requests without granting them access to anyone else's.
create or replace function public.is_own_staff_record(target_staff_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from staff
    where id = target_staff_id
      and user_id = (select auth.uid())
  );
$$;

-- Called once, immediately after a brand-new user's first OTP verification
-- during signup (lib/auth/actions.ts `provisionOrganization`). Creates the
-- organization + owner membership + 14-day trial subscription atomically so
-- the three rows can never exist out of sync with each other.
create or replace function public.create_organization_for_current_user(p_business_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into organizations (name) values (p_business_name)
    returning id into v_org_id;

  insert into memberships (organization_id, user_id, role)
    values (v_org_id, auth.uid(), 'owner');

  insert into subscriptions (organization_id, plan, status, trial_ends_at)
    values (v_org_id, 'trial', 'trialing', now() + interval '14 days');

  return v_org_id;
end;
$$;

grant execute on function public.create_organization_for_current_user(text) to authenticated;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table staff enable row level security;
alter table staff_compensation enable row level security;
alter table shift_types enable row level security;
alter table shift_assignments enable row level security;
alter table time_off_requests enable row level security;
alter table swap_requests enable row level security;
alter table subscriptions enable row level security;
alter table audit_log enable row level security;

-- organizations: any member can read their own org; only an owner can
-- rename it / change settings.
create policy "org_members_select" on organizations
  for select using (is_org_member(id));

create policy "org_owner_update" on organizations
  for update using (has_org_role(id, array['owner']))
  with check (has_org_role(id, array['owner']));

-- memberships: members can see who else is in their org; only an owner
-- manages membership (invites are Phase 3 — the row-level shape is ready
-- now so it doesn't need a later migration).
create policy "membership_org_select" on memberships
  for select using (is_org_member(organization_id));

create policy "membership_owner_write" on memberships
  for insert with check (has_org_role(organization_id, array['owner']));

create policy "membership_owner_update" on memberships
  for update using (has_org_role(organization_id, array['owner']))
  with check (has_org_role(organization_id, array['owner']));

create policy "membership_owner_delete" on memberships
  for delete using (has_org_role(organization_id, array['owner']));

-- staff: all org members can see the roster (needed to view the whole
-- team's schedule); only owner/admin edit it.
create policy "staff_org_select" on staff
  for select using (is_org_member(organization_id));

create policy "staff_manager_write" on staff
  for insert with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "staff_manager_update" on staff
  for update using (has_org_role(organization_id, array['owner', 'admin']))
  with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "staff_manager_delete" on staff
  for delete using (has_org_role(organization_id, array['owner', 'admin']));

-- staff_compensation: owner only, in both directions — this is the column
-- split that keeps coworkers' hourly wage from leaking through a
-- staff-roster read (docs/plan.md).
create policy "compensation_owner_select" on staff_compensation
  for select using (has_org_role(organization_id, array['owner']));

create policy "compensation_owner_write" on staff_compensation
  for insert with check (has_org_role(organization_id, array['owner']));

create policy "compensation_owner_update" on staff_compensation
  for update using (has_org_role(organization_id, array['owner']))
  with check (has_org_role(organization_id, array['owner']));

create policy "compensation_owner_delete" on staff_compensation
  for delete using (has_org_role(organization_id, array['owner']));

-- shift_types: all org members can read; only owner/admin configure them.
create policy "shift_types_org_select" on shift_types
  for select using (is_org_member(organization_id));

create policy "shift_types_manager_write" on shift_types
  for insert with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "shift_types_manager_update" on shift_types
  for update using (has_org_role(organization_id, array['owner', 'admin']))
  with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "shift_types_manager_delete" on shift_types
  for delete using (has_org_role(organization_id, array['owner', 'admin']));

-- shift_assignments: all org members can read the published schedule;
-- only owner/admin write (auto-generate and manual edits both go through
-- an owner/admin session — see docs/plan.md draft/confirmed flow).
create policy "assignments_org_select" on shift_assignments
  for select using (is_org_member(organization_id));

create policy "assignments_manager_write" on shift_assignments
  for insert with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "assignments_manager_update" on shift_assignments
  for update using (has_org_role(organization_id, array['owner', 'admin']))
  with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "assignments_manager_delete" on shift_assignments
  for delete using (has_org_role(organization_id, array['owner', 'admin']));

-- time_off_requests: org members can read; a staff member can create their
-- own request, owner/admin can create/update any (acknowledging a request).
create policy "time_off_org_select" on time_off_requests
  for select using (is_org_member(organization_id));

create policy "time_off_self_or_manager_write" on time_off_requests
  for insert with check (
    has_org_role(organization_id, array['owner', 'admin'])
    or is_own_staff_record(staff_id)
  );

create policy "time_off_manager_update" on time_off_requests
  for update using (has_org_role(organization_id, array['owner', 'admin']))
  with check (has_org_role(organization_id, array['owner', 'admin']));

create policy "time_off_self_or_manager_delete" on time_off_requests
  for delete using (
    has_org_role(organization_id, array['owner', 'admin'])
    or is_own_staff_record(staff_id)
  );

-- swap_requests: org members can read; the requesting staff member (or a
-- manager) can create one, only owner/admin can approve/reject.
create policy "swaps_org_select" on swap_requests
  for select using (is_org_member(organization_id));

create policy "swaps_self_or_manager_write" on swap_requests
  for insert with check (
    has_org_role(organization_id, array['owner', 'admin'])
    or is_own_staff_record(from_staff_id)
  );

create policy "swaps_manager_update" on swap_requests
  for update using (has_org_role(organization_id, array['owner', 'admin']))
  with check (has_org_role(organization_id, array['owner', 'admin']));

-- subscriptions: owner can read their own org's billing state; writes only
-- happen via the service-role client from the Stripe webhook and the
-- create_organization_for_current_user() function above, both of which
-- bypass RLS by design (docs/plan.md, "service_role の使用は...限定").
create policy "subscription_owner_select" on subscriptions
  for select using (has_org_role(organization_id, array['owner']));

-- audit_log: owner/admin can read; rows are written by the app on behalf of
-- whichever member made the change, so any org member may insert (never
-- update/delete — an audit trail that can be edited isn't one).
create policy "audit_log_manager_select" on audit_log
  for select using (has_org_role(organization_id, array['owner', 'admin']));

create policy "audit_log_org_insert" on audit_log
  for insert with check (is_org_member(organization_id));
