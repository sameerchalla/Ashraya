-- ============================================================================
-- Ashraya — Campus Library Seat Booking System
-- Migration: 0001_init.sql
-- Unified Database Schema with PostgreSQL 16 / Supabase RLS & GiST Exclusion
-- ============================================================================

-- 1. Required Extensions
create extension if not exists "btree_gist";
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Tenancy & Facility Hierarchy
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  features jsonb not null default '{"gate":true,"lockers":true,"campus":false}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  timezone text not null default 'Asia/Kolkata',
  rules jsonb not null default '{
    "mid_shift_rebooking_allowed": false,
    "grace_checkout_minutes": 30,
    "no_checkin_release_minutes": 120,
    "grace_days_after_validity": 3,
    "release_seat_on_lapse": true,
    "hold_time_minutes": 20,
    "max_pending_offers": 1,
    "pre_entry_window_minutes": 15,
    "late_entry_lockout_hours": 4
  }'::jsonb,
  open_from time,
  open_to time,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  x0 int default 0,
  y0 int default 0,
  sort int default 0
);

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  floor_id uuid references public.floors(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('ac','regular','pod','room','girls')),
  gender_restriction text not null check (gender_restriction in ('any','male','female')) default 'any',
  color text not null default '#64748B',
  sort int default 0
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  crosses_midnight boolean generated always as (end_time <= start_time) stored,
  color text not null default '#7C3AED',
  capacity int check (capacity is null or capacity > 0),
  is_active boolean not null default true,
  constraint shift_no_dup unique (branch_id, name, start_time, end_time)
);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  code text not null,
  row_no int,
  col_no int,
  x numeric default 0,
  y numeric default 0,
  w numeric default 1,
  h numeric default 1,
  rot smallint default 0,
  kind text not null default 'desk' check (kind in ('desk','pod','room','lounge','standing')),
  tags text[] not null default '{}',
  is_available boolean not null default true,
  maintenance_note text,
  layout_version int not null default 1,
  constraint seat_code_unique unique (branch_id, code)
);

create index if not exists idx_seats_branch_floor on public.seats(branch_id, floor_id) include (code, zone_id, is_available);

-- 3. Members & Identity
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid, -- links to auth.users if online account created
  full_name text not null,
  phone text,
  email text,
  roll_no text,
  gender text check (gender in ('male','female','other','na')) default 'na',
  dob date,
  institute text,
  programme text,
  year smallint,
  photo_path text,
  guardian_phone text,
  guardian_name text,
  status text not null default 'active' check (status in ('active','paused','suspended','graduated','lapsed')),
  id_verified boolean not null default false,
  consent_at timestamptz,
  notes text,
  constraint member_phone_unique unique (org_id, phone)
);

create index if not exists idx_members_org_name on public.members(org_id, full_name);

-- 4. Validity: Eligibility Window (Zero fees, Zero payment logic)
create table if not exists public.membership_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  valid_from date not null,
  valid_till date not null,
  source text not null default 'desk' check (source in ('desk','import','institution','self_request')),
  reason text,
  set_by uuid not null,
  closed_at timestamptz,
  constraint valid_window check (valid_till >= valid_from)
);

create index if not exists idx_periods_member_valid on public.membership_periods(member_id, valid_till desc);
create index if not exists idx_periods_branch_valid on public.membership_periods(branch_id, valid_till);
create unique index if not exists one_open_period_per_scope
  on public.membership_periods(member_id, branch_id, coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where closed_at is null;

-- Append-only audit of every validity change
create table if not exists public.validity_records (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  branch_id uuid not null,
  member_id uuid not null references public.members(id) on delete cascade,
  period_id uuid not null references public.membership_periods(id) on delete cascade,
  action text not null check (action in ('granted','extended','paused','revoked','corrected')),
  from_till date,
  to_till date,
  reason text not null,
  set_by uuid not null,
  at timestamptz not null default now()
);

-- 5. Bookings & GiST Exclusion Constraint (Zero double-booking guarantee)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  membership_period_id uuid references public.membership_periods(id) on delete set null,
  start_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  end_date date not null,
  status text not null default 'active' check (status in
    ('pending','active','checked_in','checked_out','cancelled','released','transferred','no_show')),
  source text not null default 'desk' check (source in ('desk','self','waitlist','import','rotation')),
  hold_expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  release_reason text,
  constraint dates_ok check (end_date >= start_date)
);

-- GiST exclusion constraint enforcing ZERO double bookings per seat, shift, and date range
alter table public.bookings drop constraint if exists booking_one_member_per_slot;
alter table public.bookings add constraint booking_one_member_per_slot
  exclude using gist (
    seat_id with =,
    shift_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('pending','active','checked_in','checked_out'));

-- 6. Seat Assignments Read-Model (Fast Materialised Floor State)
create table if not exists public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  for_date date not null,
  status text not null check (status in ('vacant','reserved','occupied','expiring','lapsed','blocked','offered')),
  booking_id uuid references public.bookings(id) on delete set null,
  hold_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint assign_unique unique (seat_id, shift_id, for_date)
);

create index if not exists idx_assignments_query on public.seat_assignments(branch_id, for_date, shift_id);
create index if not exists idx_assignments_member on public.seat_assignments(member_id, for_date desc);

-- 7. Attendance & Check-in (Append-Only)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  seat_id uuid references public.seats(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  shift_date date not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  mode text not null check (mode in ('qr_desk','qr_gate','kiosk_self','manual','pin')),
  device_id text,
  source text not null default 'online' check (source in ('online','offline_cache')),
  gate_event_id bigint,
  corrected_from uuid references public.attendance(id)
);

create unique index if not exists attendance_one_open_visit
  on public.attendance(member_id, branch_id)
  where check_out_at is null;

create index if not exists idx_attendance_branch_date on public.attendance(branch_id, shift_date, shift_id);
create index if not exists idx_attendance_member_recent on public.attendance(member_id, check_in_at desc);

-- 8. Gate Devices & Events (Hardware Hot-path)
create table if not exists public.gate_devices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  api_key_hash text not null,
  mode text not null default 'relay' check (mode in ('relay','doorman','turnstile')),
  firmware text,
  last_seen_at timestamptz,
  is_active boolean default true,
  config jsonb not null default '{}'::jsonb
);

create table if not exists public.gate_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_id uuid references public.gate_devices(id) on delete set null,
  gate_slot text,
  member_id uuid references public.members(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  decision text not null check (decision in ('open','deny','override','offline_open')),
  reason_code text,
  scan_nonce text,
  snapshot_path text,
  occurred_at timestamptz not null default now(),
  latency_ms int default 0,
  mode text default 'online',
  event_hash text,
  prev_hash text,
  constraint gate_events_unique_scan unique (device_id, scan_nonce)
);

create table if not exists public.gate_offline_cache (
  device_id uuid primary key references public.gate_devices(id) on delete cascade,
  version int not null,
  sha256 text not null,
  published_at timestamptz not null,
  expires_at timestamptz not null,
  path text not null,
  member_count int not null
);

-- 9. Waitlist Management
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  scope text not null check (scope in ('seat','shift_zone','shift')),
  seat_id uuid references public.seats(id) on delete set null,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete set null,
  priority int default 0,
  status text not null default 'waiting' check (status in
    ('waiting','offered','accepted','seated','expired_hold','declined','cancelled','skipped')),
  hold_expires_at timestamptz,
  offer_channel text,
  position_snapshot int,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists waitlist_one_active on public.waitlist_entries(branch_id, member_id)
  where status in ('waiting','offered');

-- 10. Analytics Rollups (Read Model for Reports)
create table if not exists public.analytics_seat_day (
  branch_id uuid not null references public.branches(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  day date not null,
  booked boolean not null default false,
  present_minutes int not null default 0,
  idle_minutes int not null default 0,
  no_show boolean not null default false,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  updated_at timestamptz default now(),
  primary key (branch_id, seat_id, shift_id, day)
);

create index if not exists idx_analytics_branch_day on public.analytics_seat_day(branch_id, day, shift_id);

-- 11. Live Occupancy View
create or replace view public.v_branch_live as
  select a.branch_id, a.shift_id, a.for_date,
         count(*) filter (where a.status = 'occupied') as in_now,
         count(*) filter (where a.status = 'reserved') as booked_not_in,
         count(*) filter (where a.status = 'vacant') as free_now,
         count(*) filter (where a.status in ('expiring','lapsed')) as ending,
         count(*) filter (where a.status = 'blocked') as blocked,
         count(*) as total_seats
  from public.seat_assignments a
  group by 1, 2, 3;

-- 12. Audit Logs & Notices
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  actor_kind text default 'staff',
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  device text,
  at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  title text not null,
  body text not null,
  audience jsonb default '{"all": true}'::jsonb,
  starts_at timestamptz default now(),
  ends_at timestamptz,
  published_at timestamptz default now()
);

create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  read_at timestamptz default now(),
  primary key(notice_id, member_id)
);

-- User Org Memberships for RBAC
create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('super_admin','owner','branch_manager','staff','gate_guard','member')),
  branch_ids uuid[] default '{}',
  created_at timestamptz default now()
);

-- ============================================================================
-- 13. Helper Functions & Business Logic Stored Procedures
-- ============================================================================

-- RLS Helper
create or replace function public.auth_org() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'org_id',
    (select org_id::text from public.org_memberships m where m.user_id = auth.uid() limit 1)
  )::uuid;
$$;

-- Check if branch is open on given date
create or replace function public.branch_is_open(p_branch_id uuid, p_date date) returns boolean language sql stable as $$
  select is_open from public.branches where id = p_branch_id;
$$;

-- Check if member has active validity period
create or replace function public.member_is_current(p_member_id uuid, p_branch_id uuid, p_from date, p_to date) returns boolean language sql stable as $$
  select exists (
    select 1 from public.membership_periods
    where member_id = p_member_id
      and branch_id = p_branch_id
      and closed_at is null
      and daterange(valid_from, valid_till, '[]') && daterange(p_from, p_to, '[]')
  );
$$;

-- Find nearest alternative free seats in the same shift and zone
create or replace function public.nearest_free_seats(
  p_shift uuid, p_from date, p_to date, p_zone uuid, p_limit int default 3
) returns jsonb language plpgsql stable as $$
declare
  v_res jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'zone_id', s.zone_id))
  into v_res
  from (
    select s.id, s.code, s.zone_id
    from public.seats s
    where s.zone_id = p_zone
      and s.is_available = true
      and not exists (
        select 1 from public.bookings b
        where b.seat_id = s.id
          and b.shift_id = p_shift
          and b.status in ('pending','active','checked_in','checked_out')
          and daterange(b.start_date, b.end_date, '[]') && daterange(p_from, p_to, '[]')
      )
    order by s.code asc
    limit p_limit
  ) s;
  return coalesce(v_res, '[]'::jsonb);
end;
$$;

-- Get waitlist count
create or replace function public.waitlist_depth(p_shift uuid) returns int language sql stable as $$
  select count(*)::int from public.waitlist_entries where shift_id = p_shift and status = 'waiting';
$$;

-- Materialise seat assignments for read map
create or replace function public.upsert_seat_assignments(p_booking_id uuid) returns void language plpgsql as $$
declare
  v_b public.bookings%rowtype;
  v_seat public.seats%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if not found then return; end if;
  select * into v_seat from public.seats where id = v_b.seat_id;

  insert into public.seat_assignments (
    branch_id, floor_id, seat_id, member_id, shift_id, for_date, status, booking_id
  )
  values (
    v_b.branch_id, v_seat.floor_id, v_b.seat_id, v_b.member_id, v_b.shift_id, v_b.start_date,
    case when v_b.status = 'checked_in' then 'occupied' else 'reserved' end,
    v_b.id
  )
  on conflict (seat_id, shift_id, for_date)
  do update set
    member_id = excluded.member_id,
    status = excluded.status,
    booking_id = excluded.booking_id,
    updated_at = now();
end;
$$;

-- ============================================================================
-- 14. Transactional book_seat() RPC (Verbatim Architecture 3 §6.2)
-- ============================================================================
create or replace function public.book_seat(
  p_seat uuid,
  p_shift uuid,
  p_member uuid,
  p_from date,
  p_to date,
  p_source text default 'desk',
  p_idem uuid default null
) returns jsonb language plpgsql security definer as $$
declare
  v_seat public.seats%rowtype;
  v_zone public.zones%rowtype;
  v_cap int;
  v_sold int;
  v_conflict jsonb;
  v_booking uuid;
  v_period uuid;
begin
  -- 0. Idempotency replay check
  if p_idem is not null and exists (
    select 1 from public.audit_logs
    where action = 'booking.create' and after->>'idem' = p_idem::text
  ) then
    return jsonb_build_object('ok', false, 'code', 'IDEMPOTENT_REPLAY');
  end if;

  -- 1. Lock the seat row to serialize parallel booking attempts
  select * into v_seat from public.seats where id = p_seat and is_available for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'SEAT_BLOCKED');
  end if;

  select * into v_zone from public.zones where id = v_seat.zone_id;

  -- 2. Branch open + eligibility validation
  if not public.branch_is_open(v_seat.branch_id, p_from) then
    return jsonb_build_object('ok', false, 'code', 'BRANCH_CLOSED');
  end if;

  if not public.member_is_current(p_member, v_seat.branch_id, p_from, p_to) then
    return jsonb_build_object(
      'ok', false,
      'code', 'MEMBERSHIP_LAPSED',
      'next_step', jsonb_build_object('action', 'grant_validity', 'shift', p_shift)
    );
  end if;

  if v_zone.gender_restriction <> 'any'
     and (select gender from public.members where id = p_member) not in (v_zone.gender_restriction, 'other') then
    return jsonb_build_object('ok', false, 'code', 'ELIGIBILITY_ZONE');
  end if;

  -- 3. Slot conflict check (with human-readable details)
  select jsonb_build_object(
    'booking_id', b.id,
    'member', m.full_name,
    'shift', s.name,
    'till', b.end_date
  )
  into v_conflict
  from public.bookings b
  join public.members m on m.id = b.member_id
  join public.shifts s on s.id = b.shift_id
  where b.seat_id = p_seat
    and b.shift_id = p_shift
    and b.status in ('pending','active','checked_in','checked_out')
    and daterange(b.start_date, b.end_date, '[]') && daterange(p_from, p_to, '[]')
  limit 1;

  if v_conflict is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'SEAT_SHIFT_TAKEN',
      'conflict', v_conflict,
      'alternatives', public.nearest_free_seats(p_shift, p_from, p_to, v_seat.zone_id, 3)
    );
  end if;

  -- 4. Shift capacity cap check
  select capacity into v_cap from public.shifts where id = p_shift;
  if v_cap is not null then
    select count(distinct seat_id) into v_sold
    from public.bookings
    where shift_id = p_shift
      and status in ('pending','active','checked_in')
      and daterange(start_date, end_date, '[]') && daterange(p_from, p_to, '[]');

    if v_sold >= v_cap then
      return jsonb_build_object(
        'ok', false,
        'code', 'SHIFT_CAPACITY_FULL',
        'waitlist_size', public.waitlist_depth(p_shift),
        'alternatives', public.nearest_free_seats(p_shift, p_from, p_to, v_seat.zone_id, 3)
      );
    end if;
  end if;

  -- 5. Find validity window and insert booking
  select id into v_period from public.membership_periods
  where member_id = p_member
    and branch_id = v_seat.branch_id
    and closed_at is null
    and daterange(valid_from, valid_till, '[]') && daterange(p_from, p_to, '[]')
  order by valid_till desc limit 1 for update;

  insert into public.bookings (
    id, org_id, branch_id, member_id, seat_id, shift_id,
    membership_period_id, start_date, end_date, status, source, created_by
  )
  values (
    gen_random_uuid(), v_seat.org_id, v_seat.branch_id, p_member, p_seat, p_shift,
    v_period, p_from,
    least(p_to, coalesce((select valid_till from public.membership_periods where id = v_period), p_to)),
    case when p_source = 'waitlist' and p_idem is null then 'pending' else 'active' end,
    p_source, auth.uid()
  )
  returning id into v_booking;

  -- 6. Materialize read assignment, emit pg_notify, log audit
  perform public.upsert_seat_assignments(v_booking);

  perform pg_notify('seat_delta', json_build_object(
    'branch', v_seat.branch_id,
    'floor', v_seat.floor_id,
    'seats', json_build_array(p_seat),
    'date', p_from,
    'shift', p_shift
  )::text);

  insert into public.audit_logs(org_id, actor_id, action, entity, entity_id, after)
  values (v_seat.org_id, auth.uid(), 'booking.create', 'booking', v_booking, json_build_object('idem', p_idem));

  return jsonb_build_object('ok', true, 'booking_id', v_booking);

exception when exclusion_violation then
  return jsonb_build_object('ok', false, 'code', 'RACE_LOST_RETRY');
end;
$$;

-- ============================================================================
-- 15. Row Level Security Policies
-- ============================================================================
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.floors enable row level security;
alter table public.zones enable row level security;
alter table public.shifts enable row level security;
alter table public.seats enable row level security;
alter table public.bookings enable row level security;
alter table public.members enable row level security;
alter table public.membership_periods enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.gate_devices enable row level security;
alter table public.notices enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.attendance enable row level security;
alter table public.gate_events enable row level security;
alter table public.validity_records enable row level security;

-- Read policies for public/anon client access
drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations for select using (true);

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select using (true);

drop policy if exists floors_read on public.floors;
create policy floors_read on public.floors for select using (true);

drop policy if exists zones_read on public.zones;
create policy zones_read on public.zones for select using (true);

drop policy if exists shifts_read on public.shifts;
create policy shifts_read on public.shifts for select using (true);

drop policy if exists seats_read on public.seats;
create policy seats_read on public.seats for select using (true);

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (true);

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (true);

drop policy if exists membership_periods_read on public.membership_periods;
create policy membership_periods_read on public.membership_periods for select using (true);

drop policy if exists seat_assignments_read on public.seat_assignments;
create policy seat_assignments_read on public.seat_assignments for select using (true);

drop policy if exists gate_devices_read on public.gate_devices;
create policy gate_devices_read on public.gate_devices for select using (true);

drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices for select using (true);

drop policy if exists waitlist_entries_read on public.waitlist_entries;
create policy waitlist_entries_read on public.waitlist_entries for select using (true);

-- Append-only security: No updates or deletes on attendance, gate_events, validity_records via client
alter table public.attendance force row level security;
alter table public.gate_events force row level security;
alter table public.validity_records force row level security;
