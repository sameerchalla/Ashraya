/**
 * Ashraya Contracts — Status Enums
 * Spec 2.design.md §2.2 and 3.architecture.md §4.2
 */

export const SeatStatus = {
  VACANT: 'vacant',
  RESERVED: 'reserved',
  OCCUPIED: 'occupied',
  EXPIRING: 'expiring',
  LAPSED: 'lapsed',
  BLOCKED: 'blocked',
  YOURS: 'yours',
  OFFERED: 'offered',
  CONFLICT: 'conflict',
} as const;

export type SeatStatusType = typeof SeatStatus[keyof typeof SeatStatus];

export const BookingStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  RELEASED: 'released',
  TRANSFERRED: 'transferred',
  NO_SHOW: 'no_show',
} as const;

export type BookingStatusType = typeof BookingStatus[keyof typeof BookingStatus];

export const MemberStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  SUSPENDED: 'suspended',
  GRADUATED: 'graduated',
  LAPSED: 'lapsed',
} as const;

export type MemberStatusType = typeof MemberStatus[keyof typeof MemberStatus];

export const GateDecision = {
  OPEN: 'open',
  DENY: 'deny',
  OVERRIDE: 'override',
  OFFLINE_OPEN: 'offline_open',
} as const;

export type GateDecisionType = typeof GateDecision[keyof typeof GateDecision];

export const WaitlistStatus = {
  WAITING: 'waiting',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  SEATED: 'seated',
  EXPIRED_HOLD: 'expired_hold',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
} as const;

export type WaitlistStatusType = typeof WaitlistStatus[keyof typeof WaitlistStatus];
