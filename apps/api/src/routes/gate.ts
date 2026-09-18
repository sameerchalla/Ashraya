/**
 * Ashraya API — Gate Access Control (Hot Path)
 * Spec 1.prd.md F5 & 3.architecture.md §8
 */

import { Router, Request, Response } from 'express';
import { sql } from '../db.ts';
import { GateVerifyRequestSchema, ErrorCode } from '@ashraya/contracts';
import { formatISTDate } from '@ashraya/utils';

export const gateRouter = Router();

gateRouter.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { device_id, qr_token, scan_nonce } = GateVerifyRequestSchema.parse(req.body);
    const today = formatISTDate();

    // 1. Verify gate device is active
    const devices = await sql`
      select id, branch_id, org_id, is_active
      from public.gate_devices
      where id = ${device_id}
      limit 1
    `;

    if (devices.length === 0 || !devices[0].is_active) {
      res.status(403).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.DEVICE_INACTIVE,
        message: 'Gate device is inactive or unauthorized.',
      });
      return;
    }

    const device = devices[0];

    // 2. Replay protection check
    const existingScans = await sql`
      select id from public.gate_events
      where device_id = ${device_id} and scan_nonce = ${scan_nonce}
      limit 1
    `;

    if (existingScans.length > 0) {
      res.status(409).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.REPLAY_DETECTED,
        message: 'QR code was already scanned. Rolling token expired.',
      });
      return;
    }

    // 3. Extract member identifier from token or mock test
    let memberQueryStr = qr_token;
    if (qr_token.startsWith('a1.')) {
      const parts = qr_token.split('.');
      if (parts.length >= 2) memberQueryStr = parts[1];
    }

    // 4. Resolve member & validity
    const members = await sql`
      select m.id, m.full_name, m.status, p.valid_till
      from public.members m
      left join public.membership_periods p on p.member_id = m.id and p.closed_at is null
      where m.org_id = ${device.org_id}
        and (m.id::text = ${memberQueryStr} or m.phone = ${memberQueryStr} or m.roll_no = ${memberQueryStr})
      order by p.valid_till desc limit 1
    `;

    if (members.length === 0) {
      await logGateEvent(device.org_id, device.branch_id, device.id, null, null, 'deny', ErrorCode.NOT_FOUND, scan_nonce, Date.now() - startTime);
      res.status(404).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.NOT_FOUND,
        message: 'Unknown QR or member identity.',
      });
      return;
    }

    const member = members[0];

    // Check validity window
    if (!member.valid_till || new Date(member.valid_till) < new Date(today)) {
      await logGateEvent(device.org_id, device.branch_id, device.id, member.id, null, 'deny', ErrorCode.MEMBERSHIP_LAPSED, scan_nonce, Date.now() - startTime);
      res.status(403).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.MEMBERSHIP_LAPSED,
        member_name: member.full_name,
        message: `Validity ended on ${member.valid_till || 'earlier'}. Desk notified to renew.`,
      });
      return;
    }

    // 5. Check active seat booking for today at this branch
    const bookings = await sql`
      select b.id, s.code as seat_code, sh.name as shift_name
      from public.bookings b
      join public.seats s on s.id = b.seat_id
      join public.shifts sh on sh.id = b.shift_id
      where b.member_id = ${member.id}
        and b.branch_id = ${device.branch_id}
        and b.status in ('active', 'checked_in')
        and daterange(b.start_date, b.end_date, '[]') && daterange(${today}::date, ${today}::date, '[]')
      limit 1
    `;

    if (bookings.length === 0) {
      await logGateEvent(device.org_id, device.branch_id, device.id, member.id, null, 'deny', ErrorCode.NO_ACTIVE_BOOKING, scan_nonce, Date.now() - startTime);
      res.status(403).json({
        ok: false,
        decision: 'deny',
        reason_code: ErrorCode.NO_ACTIVE_BOOKING,
        member_name: member.full_name,
        message: 'No active booking for this shift/today.',
      });
      return;
    }

    const booking = bookings[0];

    // 6. ALL CHECKS PASSED: Open Gate
    await logGateEvent(device.org_id, device.branch_id, device.id, member.id, booking.id, 'open', null, scan_nonce, Date.now() - startTime);

    res.json({
      ok: true,
      decision: 'open',
      relay_pulse_ms: 1500,
      member_name: member.full_name,
      seat_code: booking.seat_code,
      shift_name: booking.shift_name,
      message: 'Gate open. Welcome to Ashraya Library.',
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, decision: 'deny', message: (err as Error).message });
  }
});

async function logGateEvent(
  orgId: string,
  branchId: string,
  deviceId: string,
  memberId: string | null,
  bookingId: string | null,
  decision: string,
  reasonCode: string | null,
  nonce: string,
  latencyMs: number
) {
  try {
    await sql`
      insert into public.gate_events (
        org_id, branch_id, device_id, member_id, booking_id, decision, reason_code, scan_nonce, latency_ms
      )
      values (
        ${orgId}, ${branchId}, ${deviceId}, ${memberId}, ${bookingId}, ${decision}, ${reasonCode}, ${nonce}, ${latencyMs}
      )
    `;
  } catch {
    // Non-blocking error for hot path
  }
}
