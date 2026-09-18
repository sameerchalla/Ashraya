/**
 * Ashraya Component: SeatMap
 * Spec 2.design.md S1 & §5
 */

import React, { useState, useMemo } from 'react';
import { Seat, Zone, Shift } from '../data/mockData.ts';
import { SeatTile } from './SeatTile.tsx';
import { Search, ZoomIn, ZoomOut, Maximize2, Users, AlertCircle, ShieldCheck } from 'lucide-react';

interface SeatMapProps {
  seats: Seat[];
  zones: Zone[];
  shifts: Shift[];
  activeShift: 'morning' | 'afternoon' | 'evening' | 'night' | 'all';
  onShiftChange: (shift: 'morning' | 'afternoon' | 'evening' | 'night' | 'all') => void;
  selectedSeat: Seat | null;
  onSelectSeat: (seat: Seat) => void;
  conflictingSeatCode?: string | null;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  zones,
  shifts,
  activeShift,
  onShiftChange,
  selectedSeat,
  onSelectSeat,
  conflictingSeatCode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const zoneMap = useMemo(() => {
    const map = new Map<string, Zone>();
    zones.forEach(z => map.set(z.id, z));
    return map;
  }, [zones]);

  // Filter seats based on query, zone, and status
  const filteredSeats = useMemo(() => {
    return seats.filter(seat => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = seat.code.toLowerCase().includes(q);
        const occupants = Object.values(seat.occupants);
        const matchesOccupant = occupants.some(occ => occ?.name.toLowerCase().includes(q) || occ?.roll.toLowerCase().includes(q));
        if (!matchesCode && !matchesOccupant) return false;
      }

      // Zone filter
      if (selectedZoneFilter !== 'all' && seat.zoneId !== selectedZoneFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all' && activeShift !== 'all') {
        if (seat.shiftStatuses[activeShift] !== selectedStatusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [seats, searchQuery, selectedZoneFilter, selectedStatusFilter, activeShift]);

  // Counts for legend & status bar
  const stats = useMemo(() => {
    if (activeShift === 'all') {
      return { total: seats.length, vacant: 0, occupied: 0, reserved: 0, expiring: 0 };
    }
    let vacant = 0;
    let occupied = 0;
    let reserved = 0;
    let expiring = 0;
    let lapsed = 0;

    seats.forEach(s => {
      const st = s.shiftStatuses[activeShift];
      if (st === 'vacant') vacant++;
      else if (st === 'occupied') occupied++;
      else if (st === 'reserved') reserved++;
      else if (st === 'expiring') expiring++;
      else if (st === 'lapsed') lapsed++;
    });

    return { total: seats.length, vacant, occupied, reserved, expiring, lapsed };
  }, [seats, activeShift]);

  const activeShiftObj = shifts.find(s => s.name.toLowerCase() === activeShift);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B100D] border border-slate-200 dark:border-[#1E2621] rounded-2xl shadow-sm overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="p-3 border-b border-slate-200 dark:border-[#1E2621] bg-slate-50 dark:bg-[#0F1412] flex flex-wrap items-center justify-between gap-3">
        {/* Shift Segmented Control */}
        <div className="flex items-center bg-slate-200 dark:bg-[#141A17] p-1 rounded-xl gap-1">
          {(['morning', 'afternoon', 'evening', 'night', 'all'] as const).map(s => {
            const isActive = activeShift === s;
            return (
              <button
                key={s}
                id={`shift-tab-${s}`}
                onClick={() => onShiftChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all capitalize ${
                  isActive
                    ? 'bg-white dark:bg-[#22C55E] text-slate-900 dark:text-black shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All Shifts (4-Quadrant)' : s}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search seat (A-12) or student..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#141A17] border border-slate-300 dark:border-[#2C372F] rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedZoneFilter}
            onChange={e => setSelectedZoneFilter(e.target.value)}
            className="text-xs py-1.5 px-2 bg-white dark:bg-[#141A17] border border-slate-300 dark:border-[#2C372F] rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Zones</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>

          {activeShift !== 'all' && (
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="text-xs py-1.5 px-2 bg-white dark:bg-[#141A17] border border-slate-300 dark:border-[#2C372F] rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="expiring">Expiring Soon</option>
              <option value="lapsed">Lapsed</option>
            </select>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-slate-300 dark:border-[#2C372F] pl-2">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.7, z - 0.1))}
              className="p-1 hover:bg-slate-200 dark:hover:bg-[#1E2621] rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-[#1E2621] rounded"
              title="Reset view"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </button>
            <button
              onClick={() => setZoomLevel(z => Math.min(1.4, z + 0.1))}
              className="p-1 hover:bg-slate-200 dark:hover:bg-[#1E2621] rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Zone Ribbon */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-[#1E2621] bg-slate-50/50 dark:bg-[#080B09] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Status:</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#DCFCE7] dark:bg-[#0F2417] border border-[#86EFAC] dark:border-[#22C55E]"></span> Free ({stats.vacant || 0})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#EDE9FE] dark:bg-[#1B1533] border border-[#C4B5FD] dark:border-[#8B5CF6]"></span> Booked ({stats.reserved || 0})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FEF3C7] dark:bg-[#2A2008] border border-[#F59E0B]"></span> In Now ({stats.occupied || 0})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FFEDD5] dark:bg-[#2A1608] border border-[#EA580C]"></span> Ending (6)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FEE2E2] dark:bg-[#2A0D0D] border border-[#EF4444]"></span> Lapsed (1)</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#0EA5E9]"></span> AC Silent</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#64748B]"></span> General</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded-sm bg-[#DB2777]"></span> Women Reserve</span>
        </div>
      </div>

      {/* Main Floor Plan Grid */}
      <div className="flex-1 overflow-auto p-6 bg-slate-100/60 dark:bg-[#080B09]">
        <div
          className="mx-auto transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            maxWidth: '1100px',
          }}
        >
          {/* Floor Header Label */}
          <div className="mb-4 flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1E2621]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ground Floor — Main Reading Hall</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">240 physical seats · 4-shift capacity: 840 daily occupant-slots</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-[#1E2621] text-slate-700 dark:text-slate-300">
                Shift: {activeShift.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Grid Layout: 20 columns */}
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: 'repeat(20, minmax(36px, 1fr))',
            }}
          >
            {filteredSeats.map(seat => {
              const zone = zoneMap.get(seat.zoneId) || zones.find(z => z.id === seat.zoneId) || zones[0];
              const zoneKind: 'ac' | 'regular' | 'girls' | 'pod' = (
                zone?.kind ||
                (seat.zoneId.includes('ac') ? 'ac' : seat.zoneId.includes('girls') ? 'girls' : 'regular')
              );
              const isSelected = selectedSeat?.id === seat.id;
              const isConflict = conflictingSeatCode === seat.code;

              return (
                <SeatTile
                  key={seat.id}
                  seat={seat}
                  activeShift={activeShift}
                  isSelected={isSelected}
                  zoneKind={zoneKind}
                  onSelect={onSelectSeat}
                  flashConflict={isConflict}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Status Summary Strip */}
      <div className="px-4 py-2.5 border-t border-slate-200 dark:border-[#1E2621] bg-white dark:bg-[#0F1412] flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300 font-medium">
          <span>
            <strong className="text-emerald-600 dark:text-emerald-400">{activeShiftObj?.name || 'Shift'}</strong>:{' '}
            {stats.occupied + stats.reserved}/240 booked ({Math.round(((stats.occupied + stats.reserved) / 240) * 100)}% fill)
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>{stats.vacant} free chairs today</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-amber-600 dark:text-amber-400 font-semibold">34 in waitlist queue</span>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
          <span>Live sync:</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Active</span>
          </span>
          <span className="hidden sm:inline">(Supabase Realtime delta)</span>
        </div>
      </div>
    </div>
  );
};
