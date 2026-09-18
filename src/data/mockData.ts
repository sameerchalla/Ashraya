/**
 * Ashraya Mock & Live Seed Data
 * Central Library (240 Seats, 4 Shifts, 3 Zones)
 */

import { formatISTDate } from '@ashraya/utils';

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  capacity: number;
  bookedCount: number;
}

export interface Zone {
  id: string;
  name: string;
  kind: 'ac' | 'regular' | 'girls' | 'pod';
  color: string;
  genderRestriction: 'any' | 'male' | 'female';
}

export interface Member {
  id: string;
  fullName: string;
  phone: string;
  rollNo: string;
  gender: 'male' | 'female' | 'other' | 'na';
  institute: string;
  status: 'active' | 'paused' | 'suspended' | 'lapsed';
  validTill: string;
  seatCode?: string;
  shiftName?: string;
  avatarUrl?: string;
}

export interface Seat {
  id: string;
  code: string;
  rowNo: number;
  colNo: number;
  zoneId: string;
  isAvailable: boolean;
  tags: string[];
  // Status per shift
  shiftStatuses: {
    morning: 'vacant' | 'reserved' | 'occupied' | 'expiring' | 'lapsed' | 'blocked' | 'offered';
    afternoon: 'vacant' | 'reserved' | 'occupied' | 'expiring' | 'lapsed' | 'blocked' | 'offered';
    evening: 'vacant' | 'reserved' | 'occupied' | 'expiring' | 'lapsed' | 'blocked' | 'offered';
    night: 'vacant' | 'reserved' | 'occupied' | 'expiring' | 'lapsed' | 'blocked' | 'offered';
  };
  occupants: {
    morning?: { name: string; roll: string; validTill: string };
    afternoon?: { name: string; roll: string; validTill: string };
    evening?: { name: string; roll: string; validTill: string };
    night?: { name: string; roll: string; validTill: string };
  };
}

// Generate clean 240 seats (12 rows x 20 cols) without placeholder occupancy
export function generateInitialSeats(): Seat[] {
  const seats: Seat[] = [];

  for (let r = 1; r <= 12; r++) {
    const rowLetter = String.fromCharCode(64 + r);
    for (let c = 1; c <= 20; c++) {
      const code = `${rowLetter}-${c.toString().padStart(2, '0')}`;
      
      let zoneId = 'zone-ac';
      if (r > 4 && r <= 10) zoneId = 'zone-reg';
      else if (r > 10) zoneId = 'zone-girls';

      seats.push({
        id: `seat-${code}`,
        code,
        rowNo: r,
        colNo: c,
        zoneId,
        isAvailable: true,
        tags: c === 1 || c === 20 ? ['near_window', 'socket'] : ['socket'],
        shiftStatuses: {
          morning: 'vacant',
          afternoon: 'vacant',
          evening: 'vacant',
          night: 'vacant',
        },
        occupants: {},
      });
    }
  }

  return seats;
}

export const DEFAULT_SHIFTS: Shift[] = [
  { id: '55555555-5555-5555-5555-555555555551', name: 'Morning', startTime: '06:30', endTime: '13:00', color: '#16A34A', capacity: 240, bookedCount: 0 },
  { id: '55555555-5555-5555-5555-555555555552', name: 'Afternoon', startTime: '13:00', endTime: '17:30', color: '#0284C7', capacity: 240, bookedCount: 0 },
  { id: '55555555-5555-5555-5555-555555555553', name: 'Evening', startTime: '17:30', endTime: '23:00', color: '#D97706', capacity: 240, bookedCount: 0 },
  { id: '55555555-5555-5555-5555-555555555554', name: 'Night', startTime: '23:00', endTime: '06:30', color: '#7C3AED', capacity: 120, bookedCount: 0 },
];

export const DEFAULT_ZONES: Zone[] = [
  { id: 'zone-ac', name: 'AC Silent Pods', kind: 'ac', color: '#0EA5E9', genderRestriction: 'any' },
  { id: 'zone-reg', name: 'General Hall', kind: 'regular', color: '#64748B', genderRestriction: 'any' },
  { id: 'zone-girls', name: 'Women Reserve Block', kind: 'girls', color: '#DB2777', genderRestriction: 'female' },
];
