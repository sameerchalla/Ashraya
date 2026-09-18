/**
 * Ashraya API — Background Workers & Schedulers
 * Spec 3.architecture.md §9
 */

import { sql } from './db.ts';

/**
 * Runs Daily 00:05 IST Expiry Sweep
 * Flags expiring/lapsed members, marks seats vacant per branch rules, updates assignments
 */
export async function runExpirySweep(): Promise<{ swept: number; released: number }> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Mark members with ended periods as 'lapsed'
    const lapsedMembers = await sql`
      update public.members m
      set status = 'lapsed'
      where m.status = 'active'
        and not exists (
          select 1 from public.membership_periods p
          where p.member_id = m.id
            and p.closed_at is null
            and p.valid_till >= ${today}::date
        )
      returning id
    `;

    // 2. Release bookings for lapsed members whose grace period passed
    const releasedBookings = await sql`
      update public.bookings b
      set status = 'released', release_reason = 'validity_lapsed', cancelled_at = now()
      from public.branches br
      where b.branch_id = br.id
        and b.status in ('active', 'pending')
        and (br.rules->>'release_seat_on_lapse')::boolean = true
        and b.end_date < ${today}::date - coalesce((br.rules->>'grace_days_after_validity')::int, 3)
      returning b.id, b.seat_id, b.shift_id
    `;

    // 3. Mark seat_assignments as vacant
    if (releasedBookings.length > 0) {
      for (const b of releasedBookings) {
        await sql`
          update public.seat_assignments
          set status = 'vacant', member_id = null, booking_id = null, updated_at = now()
          where seat_id = ${b.seat_id} and shift_id = ${b.shift_id} and for_date = ${today}::date
        `;
      }
    }

    return { swept: lapsedMembers.length, released: releasedBookings.length };
  } catch (err) {
    console.error('Error in expiry sweep:', err);
    return { swept: 0, released: 0 };
  }
}

/**
 * Runs Waitlist Auto-Promoter (every 5 minutes or on seat release)
 * Automatically offers freed seats to next candidate in line with a 20-min hold
 */
export async function runWaitlistPromoter(): Promise<{ offered: number }> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Find waiting candidates for shifts that now have vacant seats
    const candidates = await sql`
      select w.id, w.branch_id, w.shift_id, w.member_id, w.seat_id
      from public.waitlist_entries w
      where w.status = 'waiting'
      order by w.priority desc, w.joined_at asc
      limit 10
    `;

    let offeredCount = 0;
    for (const c of candidates) {
      // Find a free seat in this shift
      const freeSeats = await sql`
        select s.id from public.seats s
        where s.branch_id = ${c.branch_id}
          and s.is_available = true
          and not exists (
            select 1 from public.bookings b
            where b.seat_id = s.id and b.shift_id = ${c.shift_id}
              and b.status in ('active','pending','checked_in')
              and daterange(b.start_date, b.end_date, '[]') && daterange(${today}::date, ${today}::date, '[]')
          )
        limit 1
      `;

      if (freeSeats.length > 0) {
        const seatId = freeSeats[0].id;
        const holdExpiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 min hold

        await sql`
          update public.waitlist_entries
          set status = 'offered', seat_id = ${seatId}, hold_expires_at = ${holdExpiresAt.toISOString()}, updated_at = now()
          where id = ${c.id}
        `;
        offeredCount++;
      }
    }

    return { offered: offeredCount };
  } catch (err) {
    console.error('Error in waitlist promoter:', err);
    return { offered: 0 };
  }
}

/**
 * Initializes workers on an interval loop
 */
export function startBackgroundWorkers() {
  console.log('[Worker] Background workers initialized for Expiry Sweep and Waitlist Promotion.');
  // Schedule sweep every hour (and on startup)
  setInterval(runExpirySweep, 60 * 60 * 1000);
  // Schedule waitlist promotion every 5 minutes
  setInterval(runWaitlistPromoter, 5 * 60 * 1000);
}
