/**
 * Ashraya Component: AllotDrawer (Production Desk Allocation Flow)
 * Real-time per-shift seat assignment with advisory locks & conflict prevention
 */

import React, { useState, useEffect } from 'react';
import { Seat, Shift, Member } from '../data/mockData.ts';
import { X, CheckCircle, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { formatDisplayDate } from '@ashraya/utils';
import { createLiveBooking, isSupabaseConfigured } from '../lib/supabase.ts';

interface AllotDrawerProps {
  seat: Seat | null;
  shifts: Shift[];
  members: Member[];
  onClose: () => void;
  onConfirmAllotment: (booking: {
    seatId: string;
    seatCode: string;
    shiftId: string;
    shiftName: string;
    memberId: string;
    memberName: string;
    validTill: string;
  }) => void;
  onConflictDetected?: (seatCode: string | null) => void;
}

export const AllotDrawer: React.FC<AllotDrawerProps> = ({
  seat,
  shifts,
  members,
  onClose,
  onConfirmAllotment,
  onConflictDetected,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [selectedShiftName, setSelectedShiftName] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const selectedMember = members.find(m => m.id === selectedMemberId);
  const targetShift = shifts.find(s => s.name.toLowerCase() === selectedShiftName);

  // Calculate resulting valid_till date
  const targetValidTill = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + durationMonths);
    return d.toISOString().slice(0, 10);
  })();

  // Instant inline conflict check based on current state
  useEffect(() => {
    if (!seat) return;

    // Check if this seat has an active occupant in the selected shift
    const occupant = seat.occupants[selectedShiftName];
    const status = seat.shiftStatuses[selectedShiftName];

    if (occupant || status === 'occupied' || status === 'reserved') {
      const occName = occupant?.name || 'Another member';
      const occTill = occupant?.validTill ? formatDisplayDate(occupant.validTill) : 'Active Period';
      setConflictWarning(
        `Seat ${seat.code} (${targetShift?.name || selectedShiftName}) is currently held by ${occName} till ${occTill}.`
      );
      setAlternatives([]);
      if (onConflictDetected) onConflictDetected(seat.code);
    } else {
      setConflictWarning(null);
      setAlternatives([]);
      if (onConflictDetected) onConflictDetected(null);
    }
    setErrorMessage(null);
  }, [seat, selectedShiftName, targetShift, onConflictDetected]);

  // Keyboard shortcut Ctrl+Enter or Cmd+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember, targetShift, conflictWarning, seat]);

  if (!seat) return null;

  const handleSubmit = async () => {
    if (!selectedMember || !targetShift) return;
    if (conflictWarning) return; // Prevent double booking

    setIsSubmitting(true);
    setErrorMessage(null);

    const fromDate = new Date().toISOString().slice(0, 10);

    // Call live Supabase booking RPC if configured
    if (isSupabaseConfigured) {
      const res = await createLiveBooking({
        seatId: seat.id,
        shiftId: targetShift.id,
        memberId: selectedMember.id,
        fromDate,
        toDate: targetValidTill,
        source: 'desk',
      });

      if (!res.ok) {
        setIsSubmitting(false);
        if (res.conflict) {
          setConflictWarning(
            `Seat ${seat.code} was just booked by ${res.conflict.member} for ${res.conflict.shift} shift (till ${res.conflict.till}).`
          );
          if (res.alternatives && res.alternatives.length > 0) {
            setAlternatives(res.alternatives.map(a => a.code));
          }
        } else {
          setErrorMessage(res.error || 'Failed to complete booking. Please try another seat.');
        }
        return;
      }
    }

    // Success confirmation
    onConfirmAllotment({
      seatId: seat.id,
      seatCode: seat.code,
      shiftId: targetShift.id,
      shiftName: targetShift.name,
      memberId: selectedMember.id,
      memberName: selectedMember.fullName,
      validTill: targetValidTill,
    });

    setIsSubmitting(false);
    setSuccessNotice(`Seat ${seat.code} successfully allotted to ${selectedMember.fullName} for ${targetShift.name} shift.`);
    setTimeout(() => {
      setSuccessNotice(null);
      onClose();
    }, 1200);
  };

  return (
    <div
      id="allot-drawer-panel"
      className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-white dark:bg-[#0F1412] shadow-2xl border-l border-slate-200 dark:border-[#1E2621] z-50 flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 dark:border-[#1E2621] flex items-center justify-between bg-slate-50 dark:bg-[#0B100D]">
        <div>
          <div className="flex items-center gap-2">
            <span className="seat-code text-sm font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-[#0F2417] text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">
              {seat.code}
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Desk Allotment</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rapid seat allocation with live conflict protection</p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2621] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
        {/* Field 1: Member Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            1. Member / Student
          </label>
          <select
            value={selectedMemberId}
            onChange={e => setSelectedMemberId(e.target.value)}
            className="w-full text-xs py-2 px-3 bg-white dark:bg-[#141A17] border border-slate-300 dark:border-[#2C372F] rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.rollNo || m.phone}) — {m.status.toUpperCase()}
              </option>
            ))}
          </select>

          {selectedMember && (
            <div className="mt-2.5 p-3 bg-slate-50 dark:bg-[#141A17] border border-slate-200 dark:border-[#1E2621] rounded-xl text-xs flex items-center gap-3">
              {selectedMember.avatarUrl ? (
                <img
                  src={selectedMember.avatarUrl}
                  alt={selectedMember.fullName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg object-cover border border-slate-300 dark:border-[#2C372F] shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  {selectedMember.fullName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {selectedMember.fullName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedMember.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedMember.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {selectedMember.institute} · Roll: {selectedMember.rollNo}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Valid till: <strong className="text-slate-900 dark:text-slate-100">{formatDisplayDate(selectedMember.validTill)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field 2: Shift Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            2. Shift (Independent Slot)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['morning', 'afternoon', 'evening', 'night'] as const).map(s => {
              const sh = shifts.find(shf => shf.name.toLowerCase() === s);
              const isSelected = selectedShiftName === s;
              const hasOccupant = !!seat.occupants[s];

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedShiftName(s)}
                  className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-[#0F2417] text-slate-900 dark:text-white font-bold ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-[#1E2621] bg-white dark:bg-[#141A17] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between capitalize">
                    <span>{s}</span>
                    {hasOccupant && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Occupied</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    {sh ? `${sh.bookedCount}/${sh.capacity} filled` : '240 cap'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Field 3: Validity Duration Chips */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            3. Allotment Period (Eligibility Window)
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 3, 6, 12].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMonths(m)}
                className={`py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all ${
                  durationMonths === m
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white shadow-sm'
                    : 'bg-white dark:bg-[#141A17] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1E2621] hover:border-slate-300'
                }`}
              >
                {m} Mo
              </button>
            ))}
          </div>

          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Valid till: <strong className="text-slate-900 dark:text-white">{formatDisplayDate(targetValidTill)}</strong></span>
          </div>
        </div>

        {/* Inline Conflict or Availability Strip */}
        <div className="pt-2">
          {conflictWarning ? (
            <div className="p-3 bg-red-50 dark:bg-[#2A0D0D] border border-red-200 dark:border-red-900 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2 text-red-800 dark:text-red-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{conflictWarning}</span>
              </div>
              {alternatives.length > 0 && (
                <div className="text-slate-600 dark:text-slate-300 pl-6 text-[11px]">
                  <span>Nearest free chairs in {selectedShiftName}: </span>
                  <div className="flex gap-1.5 mt-1">
                    {alternatives.map(alt => (
                      <span key={alt} className="seat-code px-2 py-0.5 bg-white dark:bg-[#171E22] rounded border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
                        {alt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 dark:bg-[#0F2417] border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Seat {seat.code} is available for {selectedShiftName} shift.</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-2 p-2.5 bg-red-50 dark:bg-[#2A0D0D] border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Success Notice Card */}
        {successNotice && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold animate-in fade-in">
            {successNotice}
          </div>
        )}
      </div>

      {/* Drawer Sticky Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-[#1E2621] bg-slate-50 dark:bg-[#0B100D] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          Cancel
        </button>

        <button
          type="button"
          id="btn-confirm-allotment"
          disabled={isSubmitting || !!conflictWarning}
          onClick={handleSubmit}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
            conflictWarning
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
          }`}
        >
          <span>
            {isSubmitting 
              ? 'Processing...' 
              : conflictWarning 
              ? 'Conflict — Slot Occupied' 
              : 'Confirm Allotment'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
