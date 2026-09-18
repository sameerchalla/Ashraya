/**
 * Ashraya API — Seats & Map Routes
 * Spec 3.architecture.md §6.1
 */

import { Router, Request, Response } from 'express';
import { sql, supabaseAdmin } from '../db.ts';
import { formatISTDate } from '@ashraya/utils';

export const seatsRouter = Router();

// GET /branches/:id/floors/:fid/seatmap?shift=&date=&mode=
seatsRouter.get('/branches/:id/floors/:fid/seatmap', async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.params.id;
    const floorId = req.params.fid;
    const shiftId = (req.query.shift as string) || null;
    const targetDate = (req.query.date as string) || formatISTDate();

    // Query physical seats on this floor
    const { data: seats, error: seatsErr } = await supabaseAdmin
      .from('seats')
      .select('id, code, row_no, col_no, x, y, kind, tags, is_available, zone_id, zones(name, kind, color, gender_restriction)')
      .eq('branch_id', branchId)
      .eq('floor_id', floorId)
      .order('code', { ascending: true });

    if (seatsErr) throw seatsErr;

    // Query assignments for target date
    let assignQuery = supabaseAdmin
      .from('seat_assignments')
      .select('seat_id, shift_id, status, member_id, members(full_name, status, roll_no), bookings(valid_till:membership_periods(valid_till))')
      .eq('branch_id', branchId)
      .eq('for_date', targetDate);

    if (shiftId) {
      assignQuery = assignQuery.eq('shift_id', shiftId);
    }

    const { data: assignments, error: assignErr } = await assignQuery;
    if (assignErr) throw assignErr;

    // Map assignments to seats
    const assignmentMap = new Map<string, any[]>();
    assignments?.forEach((a: any) => {
      const existing = assignmentMap.get(a.seat_id) || [];
      existing.push(a);
      assignmentMap.set(a.seat_id, existing);
    });

    const enrichedSeats = seats?.map((seat: any) => {
      const seatAssigns = assignmentMap.get(seat.id) || [];
      const primaryAssign = shiftId ? seatAssigns[0] : null;

      return {
        ...seat,
        status: primaryAssign?.status || (seat.is_available ? 'vacant' : 'blocked'),
        occupant: primaryAssign?.members ? {
          name: (primaryAssign.members as any).full_name,
          roll_no: (primaryAssign.members as any).roll_no,
          initials: (primaryAssign.members as any).full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
        } : null,
        shift_assignments: seatAssigns.map((sa: any) => ({
          shift_id: sa.shift_id,
          status: sa.status,
          occupant_name: (sa.members as any)?.full_name,
        })),
      };
    });

    res.json({
      ok: true,
      branch_id: branchId,
      floor_id: floorId,
      for_date: targetDate,
      shift_id: shiftId,
      seats: enrichedSeats || [],
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, message: (err as Error).message });
  }
});

// GET /availability?branch_id=&shift_id=&date=&zone_id=
seatsRouter.get('/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.query.branch_id as string;
    const shiftId = req.query.shift_id as string;
    const targetDate = (req.query.date as string) || formatISTDate();
    const zoneId = req.query.zone_id as string;

    if (!branchId || !shiftId) {
      res.status(400).json({ ok: false, message: 'branch_id and shift_id are required' });
      return;
    }

    // Call stored proc or SQL query to find free seats
    const freeSeats = await sql`
      select s.id, s.code, s.zone_id
      from public.seats s
      where s.branch_id = ${branchId}
        and s.is_available = true
        ${zoneId ? sql`and s.zone_id = ${zoneId}` : sql``}
        and not exists (
          select 1 from public.bookings b
          where b.seat_id = s.id
            and b.shift_id = ${shiftId}
            and b.status in ('pending','active','checked_in','checked_out')
            and daterange(b.start_date, b.end_date, '[]') && daterange(${targetDate}::date, ${targetDate}::date, '[]')
        )
      order by s.code asc
    `;

    res.json({
      ok: true,
      count: freeSeats.length,
      seats: freeSeats,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, message: (err as Error).message });
  }
});
