/**
 * Ashraya API — Auth Routes
 * POST /api/v1/auth/session
 */

import { Router, Request, Response } from 'express';
import { AuthSessionRequestSchema } from '@ashraya/contracts';
import { supabaseAdmin } from '../db.ts';

export const authRouter = Router();

authRouter.post('/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const { access_token } = AuthSessionRequestSchema.parse(req.body);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
    if (error || !user) {
      res.status(401).json({ ok: false, message: 'Invalid or expired Supabase token' });
      return;
    }

    // Query org membership & role claims
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id, role, branch_ids')
      .eq('user_id', user.id)
      .single();

    const role = membership?.role || 'member';
    const org_id = membership?.org_id || '11111111-1111-1111-1111-111111111111';
    const branch_ids = membership?.branch_ids || [];

    res.json({
      ok: true,
      user_id: user.id,
      role,
      org_id,
      branch_ids,
    });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, message: (err as Error).message });
  }
});
