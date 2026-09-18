/**
 * Ashraya Contracts — Machine-Readable Error & Reason Codes
 * Spec 1.prd.md §5 (F3) & 3.architecture.md §6.2
 */

export const ErrorCode = {
  // Booking & Conflict Errors
  SEAT_SHIFT_TAKEN: 'SEAT_SHIFT_TAKEN',
  SHIFT_OVERLAP: 'SHIFT_OVERLAP',
  SHIFT_CAPACITY_FULL: 'SHIFT_CAPACITY_FULL',
  MEMBERSHIP_LAPSED: 'MEMBERSHIP_LAPSED',
  SEAT_BLOCKED: 'SEAT_BLOCKED',
  ELIGIBILITY_ZONE: 'ELIGIBILITY_ZONE',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  BRANCH_CLOSED: 'BRANCH_CLOSED',
  RACE_LOST_RETRY: 'RACE_LOST_RETRY',
  IDEMPOTENT_REPLAY: 'IDEMPOTENT_REPLAY',

  // Verification & Gate Errors
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  WRONG_SHIFT: 'WRONG_SHIFT',
  PRE_ENTRY_EARLY: 'PRE_ENTRY_EARLY',
  LATE_ENTRY_LOCKOUT: 'LATE_ENTRY_LOCKOUT',
  DEVICE_INACTIVE: 'DEVICE_INACTIVE',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  NO_ACTIVE_BOOKING: 'NO_ACTIVE_BOOKING',
  REPLAY_DETECTED: 'REPLAY_DETECTED',

  // System & Permission Errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export interface ErrorResponse {
  ok: false;
  code: ErrorCodeType;
  message: string;
  details?: Record<string, unknown>;
  alternatives?: Array<{
    id: string;
    code: string;
    zone_id: string;
  }>;
  next_step?: {
    action: string;
    [key: string]: unknown;
  };
}
