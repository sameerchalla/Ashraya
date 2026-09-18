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

export const INITIAL_SHIFTS: Shift[] = [
  { id: 'shift-morn', name: 'Morning', startTime: '06:30', endTime: '13:00', color: '#16A34A', capacity: 240, bookedCount: 168 },
  { id: 'shift-aft', name: 'Afternoon', startTime: '13:00', endTime: '17:30', color: '#0284C7', capacity: 240, bookedCount: 114 },
  { id: 'shift-eve', name: 'Evening', startTime: '17:30', endTime: '23:00', color: '#D97706', capacity: 240, bookedCount: 192 },
  { id: 'shift-night', name: 'Night', startTime: '23:00', endTime: '06:30', color: '#7C3AED', capacity: 120, bookedCount: 48 },
];

export const INITIAL_ZONES: Zone[] = [
  { id: 'zone-ac', name: 'AC Silent Pods', kind: 'ac', color: '#0EA5E9', genderRestriction: 'any' },
  { id: 'zone-reg', name: 'General Hall', kind: 'regular', color: '#64748B', genderRestriction: 'any' },
  { id: 'zone-girls', name: 'Women Reserve Block', kind: 'girls', color: '#DB2777', genderRestriction: 'female' },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    fullName: 'Ravi Kumar',
    phone: '+91 98765 43210',
    rollNo: 'UPSC-2026-081',
    gender: 'male',
    institute: 'BrainTree Coaching',
    status: 'active',
    validTill: '2026-11-18',
    seatCode: 'A-12',
    shiftName: 'Morning',
  },
  {
    id: 'mem-2',
    fullName: 'Neha Sharma',
    phone: '+91 98765 43211',
    rollNo: 'GATE-2026-104',
    gender: 'female',
    institute: 'ACE Academy',
    status: 'active',
    validTill: '2026-10-31',
    seatCode: 'A-12',
    shiftName: 'Afternoon',
  },
  {
    id: 'mem-3',
    fullName: 'Arjun Mehta',
    phone: '+91 98765 43212',
    rollNo: 'TSPSC-2026-309',
    gender: 'male',
    institute: 'Vignan Study Circle',
    status: 'active',
    validTill: '2026-10-31',
    seatCode: 'A-12',
    shiftName: 'Evening',
  },
  {
    id: 'mem-4',
    fullName: 'Farah Khan',
    phone: '+91 98765 43213',
    rollNo: 'CA-FIN-2026-55',
    gender: 'female',
    institute: 'ICAI Hyderabad',
    status: 'active',
    validTill: '2026-12-31',
    seatCode: 'A-12',
    shiftName: 'Night',
  },
  {
    id: 'mem-5',
    fullName: 'Suresh Reddy',
    phone: '+91 98765 43214',
    rollNo: 'CAT-2025-019',
    gender: 'male',
    institute: 'TIME Institute',
    status: 'lapsed',
    validTill: '2026-09-12', // Expired
  },
];

// Generate 240 seats (12 rows x 20 cols)
export function generateInitialSeats(): Seat[] {
  const seats: Seat[] = [];
  const today = formatISTDate();

  for (let r = 1; r <= 12; r++) {
    const rowLetter = String.fromCharCode(64 + r);
    for (let c = 1; c <= 20; c++) {
      const code = `${rowLetter}-${c.toString().padStart(2, '0')}`;
      
      let zoneId = 'zone-ac';
      if (r > 4 && r <= 10) zoneId = 'zone-reg';
      else if (r > 10) zoneId = 'zone-girls';

      // Default distribution for demo realism
      const hash = (r * 29 + c * 17) % 100;
      
      let mornStatus: Seat['shiftStatuses']['morning'] = 'vacant';
      let aftStatus: Seat['shiftStatuses']['afternoon'] = 'vacant';
      let eveStatus: Seat['shiftStatuses']['evening'] = 'vacant';
      let nightStatus: Seat['shiftStatuses']['night'] = 'vacant';

      if (hash < 65) mornStatus = 'occupied';
      else if (hash < 80) mornStatus = 'reserved';
      else if (hash < 85) mornStatus = 'expiring';

      if (hash % 7 === 0) aftStatus = 'occupied';
      else if (hash % 4 === 0) aftStatus = 'reserved';

      if (hash % 3 === 0 || hash < 50) eveStatus = 'occupied';
      else if (hash % 5 === 0) eveStatus = 'reserved';

      if (hash % 6 === 0) nightStatus = 'occupied';

      const isA12 = code === 'A-12';

      seats.push({
        id: `seat-${code}`,
        code,
        rowNo: r,
        colNo: c,
        zoneId,
        isAvailable: true,
        tags: c === 1 || c === 20 ? ['near_window', 'socket'] : ['socket'],
        shiftStatuses: {
          morning: isA12 ? 'occupied' : mornStatus,
          afternoon: isA12 ? 'reserved' : aftStatus,
          evening: isA12 ? 'reserved' : eveStatus,
          night: isA12 ? 'reserved' : nightStatus,
        },
        occupants: {
          morning: isA12 ? { name: 'Ravi Kumar', roll: 'UPSC-2026-081', validTill: '2026-11-18' } : (mornStatus === 'occupied' ? { name: `Student ${code}-M`, roll: `REG-${r}${c}`, validTill: '2026-10-30' } : undefined),
          afternoon: isA12 ? { name: 'Neha Sharma', roll: 'GATE-2026-104', validTill: '2026-10-31' } : undefined,
          evening: isA12 ? { name: 'Arjun Mehta', roll: 'TSPSC-2026-309', validTill: '2026-10-31' } : undefined,
          night: isA12 ? { name: 'Farah Khan', roll: 'CA-FIN-2026-55', validTill: '2026-12-31' } : undefined,
        },
      });
    }
  }

  return seats;
}
