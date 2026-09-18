/**
 * Ashraya Contracts — Role-Based Access Control (RBAC) Matrix
 * Spec 3.architecture.md §5 & 1.prd.md S8
 */

export const Role = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  BRANCH_MANAGER: 'branch_manager',
  STAFF: 'staff',
  GATE_GUARD: 'gate_guard',
  MEMBER: 'member',
} as const;

export type RoleType = typeof Role[keyof typeof Role];

export const Permission = {
  SEAT_VIEW: 'seat.view',
  SEAT_ALLOT: 'seat.allot',
  SEAT_FORCE_ASSIGN: 'seat.force_assign',
  SEAT_BLOCK: 'seat.block',
  
  BOOKING_VIEW: 'booking.view',
  BOOKING_CANCEL: 'booking.cancel',
  BOOKING_SHIFT_SWITCH: 'booking.shift_switch',
  
  MEMBER_VIEW: 'member.view',
  MEMBER_CREATE: 'member.create',
  MEMBER_EDIT: 'member.edit',
  
  VALIDITY_VIEW: 'validity.view',
  VALIDITY_GRANT: 'validity.grant',
  VALIDITY_EXTEND: 'validity.extend',
  VALIDITY_REVOKE: 'validity.revoke',
  
  ATTENDANCE_SCAN: 'attendance.scan',
  ATTENDANCE_CORRECT: 'attendance.correct',
  
  GATE_OVERRIDE: 'gate.override',
  GATE_MANAGE_DEVICES: 'gate.manage_devices',
  
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  
  RULES_EDIT: 'rules.edit',
} as const;

export type PermissionType = typeof Permission[keyof typeof Permission];

export const RolePermissionMatrix: Record<RoleType, readonly PermissionType[]> = {
  super_admin: Object.values(Permission),
  owner: [
    Permission.SEAT_VIEW,
    Permission.SEAT_ALLOT,
    Permission.SEAT_FORCE_ASSIGN,
    Permission.SEAT_BLOCK,
    Permission.BOOKING_VIEW,
    Permission.BOOKING_CANCEL,
    Permission.BOOKING_SHIFT_SWITCH,
    Permission.MEMBER_VIEW,
    Permission.MEMBER_CREATE,
    Permission.MEMBER_EDIT,
    Permission.VALIDITY_VIEW,
    Permission.VALIDITY_GRANT,
    Permission.VALIDITY_EXTEND,
    Permission.VALIDITY_REVOKE,
    Permission.ATTENDANCE_SCAN,
    Permission.ATTENDANCE_CORRECT,
    Permission.GATE_OVERRIDE,
    Permission.GATE_MANAGE_DEVICES,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
    Permission.RULES_EDIT,
  ],
  branch_manager: [
    Permission.SEAT_VIEW,
    Permission.SEAT_ALLOT,
    Permission.SEAT_FORCE_ASSIGN,
    Permission.SEAT_BLOCK,
    Permission.BOOKING_VIEW,
    Permission.BOOKING_CANCEL,
    Permission.BOOKING_SHIFT_SWITCH,
    Permission.MEMBER_VIEW,
    Permission.MEMBER_CREATE,
    Permission.MEMBER_EDIT,
    Permission.VALIDITY_VIEW,
    Permission.VALIDITY_GRANT,
    Permission.VALIDITY_EXTEND,
    Permission.ATTENDANCE_SCAN,
    Permission.ATTENDANCE_CORRECT,
    Permission.GATE_OVERRIDE,
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
  ],
  staff: [
    Permission.SEAT_VIEW,
    Permission.SEAT_ALLOT,
    Permission.SEAT_BLOCK,
    Permission.BOOKING_VIEW,
    Permission.BOOKING_CANCEL,
    Permission.MEMBER_VIEW,
    Permission.MEMBER_CREATE,
    Permission.VALIDITY_VIEW,
    Permission.VALIDITY_GRANT,
    Permission.VALIDITY_EXTEND,
    Permission.ATTENDANCE_SCAN,
  ],
  gate_guard: [
    Permission.SEAT_VIEW,
    Permission.ATTENDANCE_SCAN,
    Permission.GATE_OVERRIDE,
  ],
  member: [
    Permission.SEAT_VIEW,
    Permission.BOOKING_VIEW,
    Permission.VALIDITY_VIEW,
  ],
};

export function hasPermission(role: RoleType, permission: PermissionType): boolean {
  const permissions = RolePermissionMatrix[role] || [];
  return permissions.includes(permission);
}
