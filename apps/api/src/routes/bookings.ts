/**
 * Ashraya API — Bookings & Conflict Engine Routes
 * Spec 3.architecture.md §6.1, §6.2
 */

import { Router, Request, Response } from 'express';
import { sql } from '../db.ts';
import { BookSeatRequestSchema, BookingPreviewRequestSchema, ErrorCode } from '@ashraya/contracts';

export const bookingsRouter = Router();

// POST /bookings/preview (Drawer debounced pre-check)
bookingsRouter.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seat_id, shift_id, member_id, from_date, to_date } = BookingPreviewRequestSchema.parse(req.body);

    // 1. Check member validity
    const periods = await sql`
      select id, valid_till from public.membership_periods
      where member_id = ${member_id}
        and closed_at is null
        and daterange(valid_from, valid_till, '[]') && daterange(${from_date}::date, ${to_date}::date, '[]')
      order by valid_till desc limit 1
    `;

    if (periods.length === 0) {
      res.json({
        ok: false,
        code: ErrorCode.MEMBERSHIP_LAPSED,
        message: 'Member has no active validity period covering this duration. Please extend validity first.',
      });
      return;
    }

    // 2. Check seat availability and conflict
    const conflicts = await sql`
      select b.id, m.full_name, s.name as shift_name, b.end_date
      from public.bookings b
      join public.members m on m.id = b.member_id
      join public.shifts s on s.id = b.shift_id
      where b.seat_id = ${seat_id}
        and b.shift_id = ${shift_id}
        and b.status in ('pending','active','checked_in','checked_out')
        and daterange(b.start_date, b.end_date, '[]') && daterange(${from_date}::date, ${to_date}::date, '[]')
      limit 1
    `;

    if (conflicts.length > 0) {
      const c = conflicts[0];
      // Fetch nearest alternative free seats
      const [seat] = await sql`select zone_id from public.seats where id = ${seat_id}`;
      const alternatives = await sql`
        select s.id, s.code, s.zone_id
        from public.seats s
        where s.zone_id = ${seat.zone_id}
          and s.is_available = true
          and not exists (
            select 1 from public.bookings b
            where b.seat_id = s.id
              and b.shift_id = ${shift_id}
              and b.status in ('pending','active','checked_in','checked_out')
              and daterange(b.start_date, b.end_date, '[]') && daterange(${from_date}::date, ${to_date}::date, '[]')
          )
        order by s.code asc limit 3
      `;

      res.json({
        ok: false,
        code: ErrorCode.SEAT_SHIFT_TAKEN,
        message: `This seat is already booked in ${c.shift_name} by ${c.full_name} until ${c.end_date}.`,
        conflict: {
          booking_id: c.id,
          member_name: c.full_name,
          shift_name: c.shift_name,
          valid_till: c.end_date,
        },
        alternatives: (alternatives as unknown as Array<{ id: string; code: string; zone_id: string }>).map(a => ({ id: a.id, code: a.code, zone_id: a.zone_id })),
      });
      return;
    }

    // 3. Check shift capacity
    const [shift] = await sql`select capacity, name from public.shifts where id = ${shift_id}`;
    if (shift && shift.capacity) {
      const [sold] = await sql`
        select count(distinct seat_id)::int as count
        from public.bookings
        where shift_id = ${shift_id}
          and status in ('pending','active','checked_in')
          and daterange(start_date, end_date, '[]') && daterange(${from_date}::date, ${to_date}::date, '[]')
      `;
      if (sold.count >= shift.capacity) {
        res.json({
          ok: false,
          code: ErrorCode.SHIFT_CAPACITY_FULL,
          message: `${shift.name} shift is at full capacity (${sold.count}/${shift.capacity}). Join waitlist.`,
        });
        return;
      }
    }

    res.json({
      ok: true,
      message: 'Seat is available for this shift and date range.',
    });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, message: (err as Error).message });
  }
});

// POST /bookings (Executes transactional book_seat RPC)
bookingsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = BookSeatRequestSchema.parse(req.body);

    // Call stored procedure book_seat()
    const result = await sql`
      select public.book_seat(
        ${input.seat_id}::uuid,
        ${input.shift_id}::uuid,
        ${input.member_id}::uuid,
        ${input.from_date}::date,
        ${input.to_date}::date,
        ${input.source},
        ${input.idempotency_key ? input.idempotency_key : null}::uuid
      ) as res
    `;

    const rpcRes = result[0]?.res;

    if (!rpcRes || !rpcRes.ok) {
      res.status(409).json(rpcRes || { ok: false, code: ErrorCode.RACE_LOST_RETRY });
      return;
    }

    res.status(201).json({
      ok: true,
      booking_id: rpcRes.booking_id,
      message: 'Allotment successfully created and confirmed.',
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, message: (err as Error).message });
  }
});
