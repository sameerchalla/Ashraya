/**
 * Ashraya Contracts — API Request & Response DTO Schemas (Zod)
 * Spec 3.architecture.md §6.1
 */

import { z } from 'zod';
import { SeatStatus, BookingStatus, MemberStatus, GateDecision } from './status.ts';
import { ErrorCode } from './errors.ts';

// 1. Auth Session
export const AuthSessionRequestSchema = z.object({
  access_token: z.string().min(1),
});

export const AuthSessionResponseSchema = z.object({
  ok: z.boolean(),
  user_id: z.string().uuid(),
  role: z.string(),
  org_id: z.string().uuid(),
  branch_ids: z.array(z.string().uuid()),
});

// 2. Booking & Conflict Preview
export const BookingPreviewRequestSchema = z.object({
  seat_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  member_id: z.string().uuid(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const BookingPreviewResponseSchema = z.object({
  ok: z.boolean(),
  code: z.string().optional(),
  message: z.string(),
  conflict: z.object({
    booking_id: z.string().uuid(),
    member_name: z.string(),
    shift_name: z.string(),
    valid_till: z.string(),
  }).optional(),
  alternatives: z.array(z.object({
    id: z.string().uuid(),
    code: z.string(),
    zone_id: z.string().uuid(),
  })).optional(),
});

export const BookSeatRequestSchema = z.object({
  seat_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  member_id: z.string().uuid(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['desk', 'self', 'waitlist', 'import', 'rotation']).default('desk'),
  idempotency_key: z.string().uuid().optional(),
});

export const BookSeatResponseSchema = z.object({
  ok: z.boolean(),
  booking_id: z.string().uuid().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  conflict: z.record(z.string(), z.unknown()).optional(),
  alternatives: z.array(z.record(z.string(), z.unknown())).optional(),
});

// 3. Attendance & Gate Verification
export const AttendanceScanRequestSchema = z.object({
  token_or_code: z.string().min(1),
  mode: z.enum(['qr_desk', 'qr_gate', 'kiosk_self', 'manual', 'pin']).default('qr_desk'),
  branch_id: z.string().uuid(),
  shift_id: z.string().uuid().optional(),
  pin: z.string().optional(),
});

export const AttendanceScanResponseSchema = z.object({
  ok: z.boolean(),
  decision: z.enum(['open', 'deny', 'checked_in', 'checked_out']),
  reason_code: z.string().optional(),
  member: z.object({
    id: z.string().uuid(),
    full_name: z.string(),
    roll_no: z.string().nullable().optional(),
    photo_path: z.string().nullable().optional(),
    seat_code: z.string().optional(),
    shift_name: z.string().optional(),
    valid_till: z.string().optional(),
  }).optional(),
  duration_minutes: z.number().optional(),
  message: z.string(),
});

export const GateVerifyRequestSchema = z.object({
  device_id: z.string().uuid(),
  qr_token: z.string().min(1),
  scan_nonce: z.string().min(4),
  timestamp: z.number().int(),
});

export const GateVerifyResponseSchema = z.object({
  ok: z.boolean(),
  decision: z.enum(['open', 'deny']),
  relay_pulse_ms: z.number().default(1500),
  reason_code: z.string().optional(),
  member_name: z.string().optional(),
  seat_code: z.string().optional(),
  shift_name: z.string().optional(),
  message: z.string(),
});

// 4. Validity Grant / Renewal (Zero payments/fees)
export const ValidityGrantRequestSchema = z.object({
  member_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  shift_id: z.string().uuid().nullable().optional(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_till: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
  source: z.enum(['desk', 'import', 'institution', 'self_request']).default('desk'),
});

export const ValidityGrantResponseSchema = z.object({
  ok: z.boolean(),
  period_id: z.string().uuid(),
  valid_till: z.string(),
  message: z.string(),
});

// 5. Waitlist Queue
export const WaitlistJoinRequestSchema = z.object({
  branch_id: z.string().uuid(),
  member_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  scope: z.enum(['seat', 'shift_zone', 'shift']).default('shift'),
  seat_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
});

export const WaitlistJoinResponseSchema = z.object({
  ok: z.boolean(),
  waitlist_id: z.string().uuid(),
  queue_position: z.number().int(),
  estimated_days: z.number(),
  message: z.string(),
});

export const WaitlistAcceptRequestSchema = z.object({
  waitlist_id: z.string().uuid(),
});
