/**
 * Ashraya Contracts — Branch Policy Rules Schema
 * Spec 1.prd.md §8 (Explicit product rules / policy knobs)
 */

import { z } from 'zod';

export const BranchRulesSchema = z.object({
  mid_shift_rebooking_allowed: z.boolean().default(false),
  grace_checkout_minutes: z.number().int().nonnegative().default(30),
  no_checkin_release_minutes: z.number().int().nonnegative().default(120),
  grace_days_after_validity: z.number().int().nonnegative().default(3),
  release_seat_on_lapse: z.boolean().default(true),
  hold_time_minutes: z.number().int().positive().default(20),
  max_pending_offers: z.number().int().positive().default(1),
  member_self_shift_switch: z.boolean().default(false),
  pre_entry_window_minutes: z.number().int().nonnegative().default(15),
  late_entry_lockout_hours: z.number().int().nonnegative().default(4),
  min_age_night_shift: z.number().int().default(18),
  exam_holiday_mode: z.boolean().default(false),
});

export type BranchRules = z.infer<typeof BranchRulesSchema>;

export const defaultBranchRules: BranchRules = {
  mid_shift_rebooking_allowed: false,
  grace_checkout_minutes: 30,
  no_checkin_release_minutes: 120,
  grace_days_after_validity: 3,
  release_seat_on_lapse: true,
  hold_time_minutes: 20,
  max_pending_offers: 1,
  member_self_shift_switch: false,
  pre_entry_window_minutes: 15,
  late_entry_lockout_hours: 4,
  min_age_night_shift: 18,
  exam_holiday_mode: false,
};
