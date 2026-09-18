/**
 * Ashraya API — Member Validity & Renewal Routes
 * (Zero payment/fee/invoice concepts — purely validity eligibility window)
 * Spec 1.prd.md S2 & 3.architecture.md §4.2
 */

import { Router, Request, Response } from 'express';
import { sql } from '../db.ts';
import { ValidityGrantRequestSchema } from '@ashraya/contracts';

export const validityRouter = Router();

// POST /validity/grant
validityRouter.post('/grant', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = ValidityGrantRequestSchema.parse(req.body);

    // Resolve org from branch
    const [branch] = await sql`select org_id from public.branches where id = ${input.branch_id}`;
    if (!branch) {
      res.status(404).json({ ok: false, message: 'Branch not found' });
      return;
    }

    // Upsert membership period
    const periods = await sql`
      insert into public.membership_periods (
        org_id, branch_id, member_id, shift_id, valid_from, valid_till, source, reason, set_by
      )
      values (
        ${branch.org_id}, ${input.branch_id}, ${input.member_id},
        ${input.shift_id || null}, ${input.valid_from}::date, ${input.valid_till}::date,
        ${input.source}, ${input.reason}, ${branch.org_id}
      )
      returning id, valid_till
    `;

    const period = periods[0];

    // Log append-only audit in validity_records
    await sql`
      insert into public.validity_records (
        org_id, branch_id, member_id, period_id, action, from_till, to_till, reason, set_by
      )
      values (
        ${branch.org_id}, ${input.branch_id}, ${input.member_id}, ${period.id},
        'extended', ${input.valid_from}::date, ${input.valid_till}::date,
        ${input.reason}, ${branch.org_id}
      )
    `;

    // Ensure member status is active
    await sql`
      update public.members set status = 'active' where id = ${input.member_id}
    `;

    res.status(201).json({
      ok: true,
      period_id: period.id,
      valid_till: period.valid_till,
      message: `Validity window extended until ${period.valid_till}.`,
    });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, message: (err as Error).message });
  }
});

// GET /validity/expiring?days=7&branch_id=
validityRouter.get('/expiring', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const branchId = req.query.branch_id as string;

    const expiringMembers = await sql`
      select m.id, m.full_name, m.phone, m.roll_no, p.valid_till, s.name as shift_name,
             p.valid_till - current_date as days_left
      from public.members m
      join public.membership_periods p on p.member_id = m.id and p.closed_at is null
      left join public.shifts s on s.id = p.shift_id
      where (${branchId ? sql`p.branch_id = ${branchId}` : sql`true`})
        and p.valid_till between current_date and current_date + ${days}
      order by p.valid_till asc
    `;

    res.json({
      ok: true,
      count: expiringMembers.length,
      members: expiringMembers,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, message: (err as Error).message });
  }
});
