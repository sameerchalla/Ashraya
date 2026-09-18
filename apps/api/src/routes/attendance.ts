/**
 * Ashraya API — Attendance & Desk Check-In Routes
 * Spec 1.prd.md F4 & 3.architecture.md §8
 */

import { Router, Request, Response } from 'express';
import { sql } from '../db.ts';
import { AttendanceScanRequestSchema, ErrorCode } from '@ashraya/contracts';
import { formatISTDate } from '@ashraya/utils';

export const attendanceRouter = Router();

attendanceRouter.post('/scan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token_or_code, mode, branch_id } = AttendanceScanRequestSchema.parse(req.body);
    const today = formatISTDate();

    // 1. Resolve member from token or roll/phone/code
    let memberId: string | null = null;

    if (token_or_code.startsWith('a1.')) {
      // Decode Ashraya QR token: a1.<member_b32>.<branch_b32>.<shift_b32>.<exp_epoch36>.<nonce8>.<hmac10>
      const parts = token_or_code.split('.');
      if (parts.length >= 6) {
        // Resolve member by ID or search
        memberId = parts[1];
      }
    }

    // Lookup member in database
    const members = await sql`
      select m.id, m.full_name, m.roll_no, m.photo_path, m.status
      from public.members m
      where m.org_id = (select org_id from public.branches where id = ${branch_id})
        and (
          m.id::text = ${memberId || token_or_code}
          or m.phone = ${token_or_code}
          or m.roll_no = ${token_or_code}
        )
      limit 1
    `;

    if (members.length === 0) {
      res.status(404).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.NOT_FOUND,
        message: 'Member not found. Check phone number or roll number.',
      });
      return;
    }

    const member = members[0];

    // 2. Check member status & validity
    if (member.status === 'lapsed' || member.status === 'suspended') {
      res.status(403).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.MEMBERSHIP_LAPSED,
        member: { id: member.id, full_name: member.full_name, roll_no: member.roll_no },
        message: 'Membership validity has lapsed. Please extend validity at the desk.',
      });
      return;
    }

    // 3. Find active booking for today
    const bookings = await sql`
      select b.id, b.seat_id, b.shift_id, s.code as seat_code, sh.name as shift_name,
             p.valid_till
      from public.bookings b
      join public.seats s on s.id = b.seat_id
      join public.shifts sh on sh.id = b.shift_id
      left join public.membership_periods p on p.id = b.membership_period_id
      where b.member_id = ${member.id}
        and b.branch_id = ${branch_id}
        and b.status in ('active', 'checked_in')
        and daterange(b.start_date, b.end_date, '[]') && daterange(${today}::date, ${today}::date, '[]')
      order by b.start_date desc limit 1
    `;

    if (bookings.length === 0) {
      res.status(403).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.NO_ACTIVE_BOOKING,
        member: { id: member.id, full_name: member.full_name, roll_no: member.roll_no },
        message: 'No active seat booking found for today at this branch.',
      });
      return;
    }

    const booking = bookings[0];

    // 4. Check if member is currently open (check-out vs check-in)
    const openVisits = await sql`
      select id, check_in_at
      from public.attendance
      where member_id = ${member.id}
        and branch_id = ${branch_id}
        and check_out_at is null
      order by check_in_at desc limit 1
    `;

    if (openVisits.length > 0) {
      // Member is currently checked in -> Perform CHECK-OUT
      const visit = openVisits[0];
      const now = new Date();
      const inTime = new Date(visit.check_in_at);
      const durationMins = Math.round((now.getTime() - inTime.getTime()) / (60 * 1000));

      await sql`
        update public.attendance
        set check_out_at = now()
        where id = ${visit.id}
      `;

      await sql`
        update public.bookings
        set status = 'checked_out'
        where id = ${booking.id}
      `;

      await sql`
        update public.seat_assignments
        set status = 'reserved', updated_at = now()
        where seat_id = ${booking.seat_id}
          and shift_id = ${booking.shift_id}
          and for_date = ${today}::date
      `;

      res.json({
        ok: true,
        decision: 'checked_out',
        member: {
          id: member.id,
          full_name: member.full_name,
          roll_no: member.roll_no,
          seat_code: booking.seat_code,
          shift_name: booking.shift_name,
          valid_till: booking.valid_till,
        },
        duration_minutes: durationMins,
        message: `Checked out successfully after ${durationMins} minutes.`,
      });
      return;
    }

    // 5. Perform CHECK-IN
    await sql`
      insert into public.attendance (
        org_id, branch_id, member_id, booking_id, seat_id, shift_id, shift_date, check_in_at, mode
      )
      values (
        (select org_id from public.branches where id = ${branch_id}),
        ${branch_id}, ${member.id}, ${booking.id}, ${booking.seat_id}, ${booking.shift_id},
        ${today}::date, now(), ${mode}
      )
    `;

    await sql`
      update public.bookings
      set status = 'checked_in'
      where id = ${booking.id}
    `;

    await sql`
      update public.seat_assignments
      set status = 'occupied', updated_at = now()
      where seat_id = ${booking.seat_id}
        and shift_id = ${booking.shift_id}
        and for_date = ${today}::date
    `;

    res.json({
      ok: true,
      decision: 'checked_in',
      member: {
        id: member.id,
        full_name: member.full_name,
        roll_no: member.roll_no,
        seat_code: booking.seat_code,
        shift_name: booking.shift_name,
        valid_till: booking.valid_till,
      },
      message: `Checked in to Seat ${booking.seat_code} (${booking.shift_name}).`,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, message: (err as Error).message });
  }
});
