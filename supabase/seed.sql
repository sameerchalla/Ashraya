-- ============================================================================
-- Ashraya — Demo Branch Seed Data
-- Central Library: 240 Seats, 4 Shifts, 3 Zones, Members & Active Allotments
-- ============================================================================

do $$
declare
  v_org_id uuid := '11111111-1111-1111-1111-111111111111';
  v_branch_id uuid := '22222222-2222-2222-2222-222222222222';
  v_floor_id uuid := '33333333-3333-3333-3333-333333333333';
  v_zone_ac uuid := '44444444-4444-4444-4444-444444444441';
  v_zone_reg uuid := '44444444-4444-4444-4444-444444444442';
  v_zone_girls uuid := '44444444-4444-4444-4444-444444444443';
  v_shift_morn uuid := '55555555-5555-5555-5555-555555555551';
  v_shift_aft uuid := '55555555-5555-5555-5555-555555555552';
  v_shift_eve uuid := '55555555-5555-5555-5555-555555555553';
  v_shift_night uuid := '55555555-5555-5555-5555-555555555554';
  
  v_seat_id uuid;
  v_member_id uuid;
  v_period_id uuid;
  v_booking_id uuid;
  r int;
  c int;
  v_code text;
  v_cur_zone uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  -- 1. Create Organization
  insert into public.organizations (id, name, city, features, is_active)
  values (v_org_id, 'Ashraya Campus Libraries', 'Hyderabad', '{"gate":true,"lockers":true,"campus":true}'::jsonb, true)
  on conflict (id) do nothing;

  -- 2. Create Central Library Branch
  insert into public.branches (id, org_id, name, address, timezone, is_open, rules)
  values (
    v_branch_id, v_org_id, 'Central Library & Study Hall', 'Ashok Nagar, Hyderabad, Telangana', 'Asia/Kolkata', true,
    '{"mid_shift_rebooking_allowed": false, "grace_checkout_minutes": 30, "no_checkin_release_minutes": 120, "grace_days_after_validity": 3, "release_seat_on_lapse": true, "hold_time_minutes": 20, "pre_entry_window_minutes": 15, "late_entry_lockout_hours": 4}'::jsonb
  )
  on conflict (id) do nothing;

  -- 3. Create Floor
  insert into public.floors (id, branch_id, name, sort)
  values (v_floor_id, v_branch_id, 'Ground Floor (Main Reading Hall)', 1)
  on conflict (id) do nothing;

  -- 4. Create 3 Zones
  insert into public.zones (id, branch_id, floor_id, name, kind, gender_restriction, color, sort)
  values
    (v_zone_ac, v_branch_id, v_floor_id, 'AC Silent Pods', 'ac', 'any', '#0EA5E9', 1),
    (v_zone_reg, v_branch_id, v_floor_id, 'General Hall', 'regular', 'any', '#64748B', 2),
    (v_zone_girls, v_branch_id, v_floor_id, 'Women Reserve Block', 'girls', 'female', '#DB2777', 3)
  on conflict (id) do nothing;

  -- 5. Create 4 Shifts (Multi-occupancy: 4 members per chair per day)
  insert into public.shifts (id, branch_id, name, start_time, end_time, color, capacity, is_active)
  values
    (v_shift_morn, v_branch_id, 'Morning', '06:30:00', '13:00:00', '#16A34A', 240, true),
    (v_shift_aft, v_branch_id, 'Afternoon', '13:00:00', '17:30:00', '#0284C7', 240, true),
    (v_shift_eve, v_branch_id, 'Evening', '17:30:00', '23:00:00', '#D97706', 240, true),
    (v_shift_night, v_branch_id, 'Night', '23:00:00', '06:30:00', '#7C3AED', 120, true)
  on conflict (branch_id, name, start_time, end_time) do nothing;

  -- 6. Generate 240 Seats (Rows A through L, 20 seats per row)
  for r in 1..12 loop
    for c in 1..20 loop
      v_code := chr(64 + r) || '-' || lpad(c::text, 2, '0');
      
      -- Assign zones based on row sections
      if r <= 4 then
        v_cur_zone := v_zone_ac;
      elsif r <= 10 then
        v_cur_zone := v_zone_reg;
      else
        v_cur_zone := v_zone_girls;
      end if;

      insert into public.seats (
        id, org_id, branch_id, floor_id, zone_id, code, row_no, col_no, x, y, is_available, tags
      )
      values (
        gen_random_uuid(), v_org_id, v_branch_id, v_floor_id, v_cur_zone, v_code, r, c, c, r, true,
        case when c = 1 or c = 20 then array['near_window','socket'] else array['socket'] end
      )
      on conflict (branch_id, code) do nothing;
    end loop;
  end loop;

  -- 7. Seed Key Demo Members with Validity and Bookings
  -- Member 1: Ravi Kumar (Morning A-12)
  v_member_id := gen_random_uuid();
  insert into public.members (id, org_id, full_name, phone, roll_no, gender, institute, status, id_verified)
  values (v_member_id, v_org_id, 'Ravi Kumar', '+919876543210', 'UPSC-2026-081', 'male', 'BrainTree Coaching', 'active', true)
  on conflict (org_id, phone) do nothing;

  select id into v_seat_id from public.seats where branch_id = v_branch_id and code = 'A-12';
  v_period_id := gen_random_uuid();
  insert into public.membership_periods (id, org_id, branch_id, member_id, shift_id, valid_from, valid_till, source, set_by)
  values (v_period_id, v_org_id, v_branch_id, v_member_id, v_shift_morn, v_today - 30, v_today + 150, 'desk', v_org_id);

  v_booking_id := gen_random_uuid();
  insert into public.bookings (id, org_id, branch_id, member_id, seat_id, shift_id, membership_period_id, start_date, end_date, status, source)
  values (v_booking_id, v_org_id, v_branch_id, v_member_id, v_seat_id, v_shift_morn, v_period_id, v_today - 30, v_today + 150, 'checked_in', 'desk');

  insert into public.seat_assignments (branch_id, floor_id, seat_id, member_id, shift_id, for_date, status, booking_id)
  values (v_branch_id, v_floor_id, v_seat_id, v_member_id, v_shift_morn, v_today, 'occupied', v_booking_id)
  on conflict (seat_id, shift_id, for_date) do update set status = 'occupied', member_id = v_member_id;

  -- Member 2: Neha Sharma (Afternoon A-12 — Multi-occupant on same chair!)
  v_member_id := gen_random_uuid();
  insert into public.members (id, org_id, full_name, phone, roll_no, gender, institute, status, id_verified)
  values (v_member_id, v_org_id, 'Neha Sharma', '+919876543211', 'GATE-2026-104', 'female', 'ACE Academy', 'active', true)
  on conflict (org_id, phone) do nothing;

  v_period_id := gen_random_uuid();
  insert into public.membership_periods (id, org_id, branch_id, member_id, shift_id, valid_from, valid_till, source, set_by)
  values (v_period_id, v_org_id, v_branch_id, v_member_id, v_shift_aft, v_today - 15, v_today + 75, 'desk', v_org_id);

  v_booking_id := gen_random_uuid();
  insert into public.bookings (id, org_id, branch_id, member_id, seat_id, shift_id, membership_period_id, start_date, end_date, status, source)
  values (v_booking_id, v_org_id, v_branch_id, v_member_id, v_seat_id, v_shift_aft, v_period_id, v_today - 15, v_today + 75, 'active', 'desk');

  -- Member 3: Arjun Mehta (Evening A-12)
  v_member_id := gen_random_uuid();
  insert into public.members (id, org_id, full_name, phone, roll_no, gender, institute, status, id_verified)
  values (v_member_id, v_org_id, 'Arjun Mehta', '+919876543212', 'TSPSC-2026-309', 'male', 'Vignan Hall', 'active', true)
  on conflict (org_id, phone) do nothing;

  v_period_id := gen_random_uuid();
  insert into public.membership_periods (id, org_id, branch_id, member_id, shift_id, valid_from, valid_till, source, set_by)
  values (v_period_id, v_org_id, v_branch_id, v_member_id, v_shift_eve, v_today - 10, v_today + 31, 'desk', v_org_id);

  v_booking_id := gen_random_uuid();
  insert into public.bookings (id, org_id, branch_id, member_id, seat_id, shift_id, membership_period_id, start_date, end_date, status, source)
  values (v_booking_id, v_org_id, v_branch_id, v_member_id, v_seat_id, v_shift_eve, v_period_id, v_today - 10, v_today + 31, 'active', 'desk');

  -- Member 4: Farah Khan (Night A-12)
  v_member_id := gen_random_uuid();
  insert into public.members (id, org_id, full_name, phone, roll_no, gender, institute, status, id_verified)
  values (v_member_id, v_org_id, 'Farah Khan', '+919876543213', 'CA-FIN-2026-55', 'female', 'ICAI Hyderabad', 'active', true)
  on conflict (org_id, phone) do nothing;

  v_period_id := gen_random_uuid();
  insert into public.membership_periods (id, org_id, branch_id, member_id, shift_id, valid_from, valid_till, source, set_by)
  values (v_period_id, v_org_id, v_branch_id, v_member_id, v_shift_night, v_today - 5, v_today + 60, 'desk', v_org_id);

  v_booking_id := gen_random_uuid();
  insert into public.bookings (id, org_id, branch_id, member_id, seat_id, shift_id, membership_period_id, start_date, end_date, status, source)
  values (v_booking_id, v_org_id, v_branch_id, v_member_id, v_seat_id, v_shift_night, v_period_id, v_today - 5, v_today + 60, 'active', 'desk');

  -- Member 5: Lapsed Member for testing Gate lockout
  v_member_id := gen_random_uuid();
  insert into public.members (id, org_id, full_name, phone, roll_no, gender, institute, status, id_verified)
  values (v_member_id, v_org_id, 'Suresh Reddy (Lapsed)', '+919876543214', 'CAT-2025-019', 'male', 'TIME Institute', 'lapsed', true)
  on conflict (org_id, phone) do nothing;

  v_period_id := gen_random_uuid();
  insert into public.membership_periods (id, org_id, branch_id, member_id, shift_id, valid_from, valid_till, source, set_by)
  values (v_period_id, v_org_id, v_branch_id, v_member_id, v_shift_morn, v_today - 60, v_today - 5, 'desk', v_org_id);

  -- 8. Gate Device
  insert into public.gate_devices (id, branch_id, name, api_key_hash, mode, firmware, is_active)
  values (
    '77777777-7777-7777-7777-777777777771', v_branch_id, 'Main Gate Turnstile 1',
    crypt('gate-secret-key-1234', gen_salt('bf')), 'relay', 'v2.4-esp32-ashraya', true
  )
  on conflict (id) do nothing;

end $$;
