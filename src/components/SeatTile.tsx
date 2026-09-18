/**
 * Ashraya Component: SeatTile
 * Spec 2.design.md §2.2, §2.8, §5
 */

import React from 'react';
import { Seat } from '../data/mockData.ts';
import { Check, Clock, User, AlertCircle, X, Wrench, Hourglass } from 'lucide-react';

interface SeatTileProps {
  seat: Seat;
  activeShift: 'morning' | 'afternoon' | 'evening' | 'night' | 'all';
  isSelected: boolean;
  zoneKind: 'ac' | 'regular' | 'girls' | 'pod';
  onSelect: (seat: Seat) => void;
  flashConflict?: boolean;
  liveChanged?: boolean;
}

export const SeatTile: React.FC<SeatTileProps> = ({
  seat,
  activeShift,
  isSelected,
  zoneKind,
  onSelect,
  flashConflict,
  liveChanged,
}) => {
  const isQuadrantMode = activeShift === 'all';
  const currentStatus = isQuadrantMode ? 'vacant' : seat.shiftStatuses[activeShift];
  const currentOccupant = !isQuadrantMode ? seat.occupants[activeShift] : null;

  // Status icon component helper
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'vacant':
        return <Check className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      case 'reserved':
        return <Clock className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      case 'occupied':
        return <User className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      case 'expiring':
        return <AlertCircle className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      case 'lapsed':
        return <X className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      case 'blocked':
        return <Wrench className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      case 'offered':
        return <Hourglass className="w-2.5 h-2.5 opacity-90 stroke-[2.5]" />;
      default:
        return null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(seat);
    }
  };

  const ariaLabel = isQuadrantMode
    ? `Seat ${seat.code}, ${zoneKind} zone. Quadrants: Morning ${seat.shiftStatuses.morning}, Afternoon ${seat.shiftStatuses.afternoon}, Evening ${seat.shiftStatuses.evening}, Night ${seat.shiftStatuses.night}`
    : `Seat ${seat.code}, ${zoneKind} zone, ${activeShift} shift, status ${currentStatus}${currentOccupant ? `, occupied by ${currentOccupant.name}, valid till ${currentOccupant.validTill}` : ''}`;

  return (
    <div
      id={`seat-tile-${seat.code}`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => onSelect(seat)}
      onKeyDown={handleKeyDown}
      className={`seat group relative cursor-pointer select-none transition-all ${
        isSelected ? 'ring-3 ring-brand-500 scale-105 z-10' : ''
      }`}
      data-status={!isQuadrantMode ? currentStatus : undefined}
      data-zone={zoneKind}
      data-flash={flashConflict ? 'conflict' : undefined}
      data-live={liveChanged ? 'changed' : undefined}
    >
      {isQuadrantMode ? (
        /* 4-Quadrant Mode for All Shifts */
        <div className="seat-quadrant-grid">
          <div
            className="quadrant-cell"
            data-status={seat.shiftStatuses.morning}
            title={`Morning: ${seat.shiftStatuses.morning}`}
          >
            M
          </div>
          <div
            className="quadrant-cell"
            data-status={seat.shiftStatuses.afternoon}
            title={`Afternoon: ${seat.shiftStatuses.afternoon}`}
          >
            A
          </div>
          <div
            className="quadrant-cell"
            data-status={seat.shiftStatuses.evening}
            title={`Evening: ${seat.shiftStatuses.evening}`}
          >
            E
          </div>
          <div
            className="quadrant-cell"
            data-status={seat.shiftStatuses.night}
            title={`Night: ${seat.shiftStatuses.night}`}
          >
            N
          </div>
        </div>
      ) : (
        /* Single Shift View */
        <div className="flex flex-col items-center justify-center w-full h-full p-0.5">
          <div className="leading-none mb-0.5 flex items-center justify-center">
            {renderStatusIcon(currentStatus)}
          </div>
          <span className="seat-code text-[9px] font-semibold tracking-tighter leading-none opacity-90">
            {seat.code}
          </span>
        </div>
      )}

      {/* Hover Card / Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-slate-900 text-slate-100 text-[11px] p-2 rounded shadow-xl whitespace-nowrap z-50 border border-slate-700 min-w-[130px]">
        <div className="flex items-center justify-between font-semibold border-b border-slate-700 pb-1 mb-1">
          <span className="seat-code text-amber-400">{seat.code}</span>
          <span className="capitalize text-[10px] text-slate-300">{zoneKind}</span>
        </div>
        {!isQuadrantMode ? (
          <div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Status:</span>
              <span className="capitalize font-medium text-emerald-400">{currentStatus}</span>
            </div>
            {currentOccupant && (
              <>
                <div className="flex justify-between gap-2 mt-0.5">
                  <span className="text-slate-400">Member:</span>
                  <span className="font-medium text-slate-200">{currentOccupant.name}</span>
                </div>
                <div className="flex justify-between gap-2 mt-0.5 text-[10px] text-slate-400">
                  <span>Valid till:</span>
                  <span>{currentOccupant.validTill}</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
            <div>M: <span className="text-emerald-400">{seat.shiftStatuses.morning}</span></div>
            <div>A: <span className="text-sky-400">{seat.shiftStatuses.afternoon}</span></div>
            <div>E: <span className="text-amber-400">{seat.shiftStatuses.evening}</span></div>
            <div>N: <span className="text-violet-400">{seat.shiftStatuses.night}</span></div>
          </div>
        )}
      </div>
    </div>
  );
};
