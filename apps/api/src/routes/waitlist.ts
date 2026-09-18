/**
 * Ashraya API — Waitlist Management Routes
 * Spec 1.prd.md F8 & 3.architecture.md §6.1
 */

import { Router, Request, Response } from 'express';
import { sql } from '../db.ts';
import { WaitlistJoinRequestSchema, WaitlistAcceptRequestSchema, ErrorCode } from '@ashraya/contracts';

export const waitlistRouter = Router();

// POST /waitlist (Join queue)
waitlistRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = WaitlistJoinRequestSchema.parse(req.body);

    const [branch] = await sql`select org_id from public.branches where id = ${input.branch_id}`;
    if (!branch) {
      res.status(404).json({ ok: false, message: 'Branch not found' });
      return;
    }

    // Insert into waitlist
    const entries = await sql`
      insert into public.waitlist_entries (
        org_id, branch_id, member_id, shift_id, scope, seat_id, zone_id, status
      )
      values (
        ${branch.org_id}, ${input.branch_id}, ${input.member_id}, ${input.shift_id},
        ${input.scope}, ${input.seat_id || null}, ${input.zone_id || null}, 'waiting'
      )
      returning id
    `;

    const entry = entries[0];

    // Calculate queue position
    const [count] = await sql`
      select count(*)::int as pos
      from public.waitlist_entries
      where branch_id = ${input.branch_id}
        and shift_id = ${input.shift_id}
        and status = 'waiting'
    `;

    res.status(201).json({
      ok: true,
      waitlist_id: entry.id,
      queue_position: count.pos,
      estimated_days: Math.max(1, Math.round(count.pos * 0.8)),
      message: `You are #${count.pos} in line for this shift.`,
    });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, message: (err as Error).message });
  }
});

// POST /waitlist/:id/accept (Convert hold into confirmed booking)
waitlistRouter.post('/:id/accept', async (req: Request, res: Response): Promise<void> => {
  try {
    const waitlistId = req.params.id;

    const [entry] = await sql`
      select * from public.waitlist_entries
      where id = ${waitlistId} and status = 'offered'
    `;

    if (!entry) {
      res.status(404).json({
        ok: false,
        code: ErrorCode.NOT_FOUND,
        message: 'No active hold offer found for this entry or hold has expired.',
      });
      return;
    }

    // Call book_seat() RPC to finalize slot
    const today = new Date().toISOString().slice(0, 10);
    const result = await sql`
      select public.book_seat(
        ${entry.seat_id}::uuid,
        ${entry.shift_id}::uuid,
        ${entry.member_id}::uuid,
        ${today}::date,
        ${today}::date + 30,
        'waitlist'
      ) as res
    `;

    const rpcRes = result[0]?.res;

    if (rpcRes && rpcRes.ok) {
      await sql`
        update public.waitlist_entries
        set status = 'seated', updated_at = now()
        where id = ${waitlistId}
      `;

      res.json({
        ok: true,
        booking_id: rpcRes.booking_id,
        message: 'Seat offer accepted! Booking confirmed.',
      });
    } else {
      res.status(409).json(rpcRes || { ok: false, message: 'Could not claim seat.' });
    }
  } catch (err: unknown) {
    res.status(500).json({ ok: false, message: (err as Error).message });
  }
});
