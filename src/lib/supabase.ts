/**
 * Ashraya — Production Supabase Client & Data Services
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Seat, Shift, Zone, Member, DEFAULT_SHIFTS, DEFAULT_ZONES } from '../data/mockData.ts';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('[YOUR-PROJECT-REF]') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Lazy or initialized client
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface SupabaseHealthStatus {
  connected: boolean;
  projectUrl?: string;
  hasTables?: boolean;
  error?: string | null;
  tablesCount?: {
    seats?: number;
    shifts?: number;
    members?: number;
    bookings?: number;
  };
}

/**
 * Checks connectivity to the configured Supabase instance
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  if (!supabase || !isSupabaseConfigured) {
    return {
      connected: false,
      error: 'Supabase URL or Anon Key is not configured',
    };
  }

  try {
    const [seatsRes, shiftsRes, membersRes, bookingsRes] = await Promise.all([
      supabase.from('seats').select('id', { count: 'exact', head: true }),
      supabase.from('shifts').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
    ]);

    const hasErrors = seatsRes.error || shiftsRes.error;
    if (hasErrors) {
      return {
        connected: true,
        projectUrl: supabaseUrl,
        hasTables: false,
        error: seatsRes.error?.message || shiftsRes.error?.message,
      };
    }

    return {
      connected: true,
      projectUrl: supabaseUrl,
      hasTables: true,
      tablesCount: {
        seats: seatsRes.count ?? 0,
        shifts: shiftsRes.count ?? 0,
        members: membersRes.count ?? 0,
        bookings: bookingsRes.count ?? 0,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      projectUrl: supabaseUrl,
      error: message,
    };
  }
}

export interface LiveLibraryState {
  shifts: Shift[];
  zones: Zone[];
  members: Member[];
  seats: Seat[];
}

/**
 * Loads live data from Supabase, seamlessly populating 240 seats with active bookings
 */
export async function fetchLiveLibraryState(): Promise<LiveLibraryState | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const [shiftsRes, zonesRes, membersRes, bookingsRes, seatsRes] = await Promise.all([
      supabase.from('shifts').select('*').order('start_time'),
      supabase.from('zones').select('*'),
      supabase.from('members').select('*'),
      supabase.from('bookings').select('*, member:members(full_name, phone, roll_no), seat:seats(code), shift:shifts(name)'),
      supabase.from('seats').select('*').order('code'),
    ]);

    // If tables are empty or failed, return null to use default base
    if (!seatsRes.data || seatsRes.data.length === 0) {
      return null;
    }

    // Build shifts dynamically from Supabase
    const shifts: Shift[] = (shiftsRes.data && shiftsRes.data.length > 0)
      ? shiftsRes.data.map(s => {
          const name = s.name;
          const colorMap: Record<string, string> = {
            Morning: '#16A34A',
            Afternoon: '#0284C7',
            Evening: '#D97706',
            Night: '#7C3AED',
          };
          return {
            id: s.id,
            name: s.name,
            startTime: s.start_time?.slice(0, 5) || '06:30',
            endTime: s.end_time?.slice(0, 5) || '13:00',
            color: colorMap[name] || '#16A34A',
            capacity: s.capacity || 240,
            bookedCount: bookingsRes.data?.filter(b => b.shift_id === s.id && b.status !== 'cancelled').length || 0,
          };
        })
      : DEFAULT_SHIFTS;

    // Build zones dynamically from Supabase
    const zones: Zone[] = (zonesRes.data && zonesRes.data.length > 0)
      ? zonesRes.data.map(z => ({
          id: z.id,
          name: z.name,
          kind: (z.kind || 'regular') as 'ac' | 'regular' | 'girls' | 'pod',
          color: z.color || '#64748B',
          genderRestriction: z.gender_restriction || 'any',
        }))
      : DEFAULT_ZONES;

    // Build members dynamically from Supabase with their active seat and shift
    const members: Member[] = (membersRes.data && membersRes.data.length > 0)
      ? membersRes.data.map(m => {
          // Find member's active booking if any
          const memberBooking = bookingsRes.data?.find(b => b.member_id === m.id && b.status !== 'cancelled');
          return {
            id: m.id,
            fullName: m.full_name,
            phone: m.phone || '',
            rollNo: m.roll_no || '',
            gender: (m.gender || 'na') as 'male' | 'female' | 'other' | 'na',
            institute: m.institute || 'Library Scholar',
            status: m.status as 'active' | 'paused' | 'suspended' | 'lapsed',
            validTill: memberBooking?.end_date || '2026-12-31',
            seatCode: memberBooking?.seat?.code || undefined,
            shiftName: memberBooking?.shift?.name || undefined,
            avatarUrl: m.photo_path || undefined,
          };
        })
      : [];

    // Build 240 seats purely from Supabase records
    const seatMapByCode = new Map<string, Seat>();

    seatsRes.data.forEach(dbSeat => {
      const parts = dbSeat.code.split('-');
      const rowLetter = parts[0] || 'A';
      const rowNo = dbSeat.row_no || (rowLetter.charCodeAt(0) - 64);
      const colNo = dbSeat.col_no || parseInt(parts[1] || '1', 10);

      seatMapByCode.set(dbSeat.code, {
        id: dbSeat.id,
        code: dbSeat.code,
        rowNo,
        colNo,
        zoneId: dbSeat.zone_id || 'zone-reg',
        isAvailable: dbSeat.is_active ?? true,
        tags: dbSeat.tags && Array.isArray(dbSeat.tags) && dbSeat.tags.length > 0
          ? dbSeat.tags
          : (colNo === 1 || colNo === 20 ? ['near_window', 'socket'] : ['socket']),
        shiftStatuses: {
          morning: 'vacant',
          afternoon: 'vacant',
          evening: 'vacant',
          night: 'vacant',
        },
        occupants: {},
      });
    });

    // Overlay ONLY real active bookings from Supabase
    if (bookingsRes.data) {
      bookingsRes.data.forEach(bk => {
        if (bk.status === 'cancelled') return;
        const seatCode = bk.seat?.code;
        if (!seatCode) return;
        const seat = seatMapByCode.get(seatCode);
        if (!seat) return;

        const shiftNameLower = (bk.shift?.name || '').toLowerCase() as 'morning' | 'afternoon' | 'evening' | 'night';
        if (shiftNameLower && seat.shiftStatuses[shiftNameLower] !== undefined) {
          seat.shiftStatuses[shiftNameLower] = bk.status === 'checked_in' ? 'occupied' : 'reserved';
          seat.occupants[shiftNameLower] = {
            name: bk.member?.full_name || 'Registered Member',
            roll: bk.member?.roll_no || '',
            validTill: bk.end_date,
          };
        }
      });
    }

    return {
      shifts,
      zones,
      members,
      seats: Array.from(seatMapByCode.values()),
    };
  } catch (err) {
    console.error('Error fetching live library state:', err);
    return null;
  }
}

export interface BookingResult {
  ok: boolean;
  bookingId?: string;
  code?: string;
  error?: string;
  conflict?: {
    till: string;
    shift: string;
    member: string;
    booking_id: string;
  };
  alternatives?: Array<{ id: string; code: string; distance: number }>;
}

/**
 * Creates a real booking via PostgreSQL public.book_seat RPC with advisory locks & GiST constraints
 */
export async function createLiveBooking(params: {
  seatId: string;
  shiftId: string;
  memberId: string;
  fromDate: string;
  toDate: string;
  source?: string;
}): Promise<BookingResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { ok: true, bookingId: `local-${Date.now()}` };
  }

  try {
    const { data, error } = await supabase.rpc('book_seat', {
      p_seat: params.seatId,
      p_shift: params.shiftId,
      p_member: params.memberId,
      p_from: params.fromDate,
      p_to: params.toDate,
      p_source: params.source || 'desk',
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (data && data.ok) {
      return { ok: true, bookingId: data.booking_id };
    }

    return {
      ok: false,
      code: data?.code || 'BOOKING_FAILED',
      conflict: data?.conflict,
      alternatives: data?.alternatives,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
