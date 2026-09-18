/**
 * Ashraya Component: MemberPass (Mobile-first PWA Pass Screen)
 * Spec 2.design.md S5 & 1.prd.md F4
 */

import React, { useState, useEffect } from 'react';
import { Member, Shift } from '../data/mockData.ts';
import { QrCode, Clock, ShieldCheck, Sun, Download, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDisplayDate, formatDurationMinutes } from '@ashraya/utils';

interface MemberPassProps {
  member: Member;
  shift: Shift;
  onOpenReadOnlyMap: () => void;
}

export const MemberPass: React.FC<MemberPassProps> = ({
  member,
  shift,
  onOpenReadOnlyMap,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(55);
  const [useStaticFallback, setUseStaticFallback] = useState<boolean>(false);
  const [isBrightMode, setIsBrightMode] = useState<boolean>(false);

  // 60-second rolling token refresh cycle
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute SVG circular countdown stroke
  const strokeDashoffset = (1 - secondsRemaining / 60) * 100;

  // Generate deterministic QR pattern blocks based on member & rolling nonce
  const qrNonce = Math.floor(Date.now() / 60000);

  return (
    <div
      id="member-pass-view"
      className={`max-w-md mx-auto p-4 sm:p-6 transition-all duration-300 ${
        isBrightMode ? 'bg-white text-black' : ''
      }`}
    >
      {/* Header Tag */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Ashraya Pass</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Central Library · Ground Floor</p>
          </div>
        </div>

        <button
          onClick={() => setIsBrightMode(b => !b)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#141A17] text-slate-700 dark:text-slate-300"
          title="Max Screen Brightness for Turnstile Scanner"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{isBrightMode ? 'Normal' : 'Bright'}</span>
        </button>
      </div>

      {/* Main Pass Card */}
      <div className="bg-white dark:bg-[#0F1412] rounded-3xl border border-slate-200 dark:border-[#1E2621] shadow-xl overflow-hidden p-6 text-center relative">
        {/* Rolling QR Code Canvas */}
        <div className="relative mx-auto w-56 h-56 bg-slate-50 dark:bg-[#141A17] p-3 rounded-2xl border border-slate-200 dark:border-[#2C372F] shadow-inner flex flex-col items-center justify-center">
          {useStaticFallback ? (
            /* Static 6-digit backup code */
            <div className="text-center p-4">
              <span className="text-xs text-slate-400 font-medium">Static Guard PIN</span>
              <div className="text-4xl font-mono font-bold tracking-widest text-slate-900 dark:text-white my-3">
                842-109
              </div>
              <p className="text-[10px] text-slate-500">Show to security guard for manual desk verification.</p>
            </div>
          ) : (
            /* Rolling SVG QR representation */
            <div className="relative w-full h-full flex items-center justify-center">
              <svg className="w-44 h-44" viewBox="0 0 100 100">
                {/* 3 Standard Corner Position Patterns */}
                <rect x="5" y="5" width="22" height="22" fill="#000" rx="3" />
                <rect x="8" y="8" width="16" height="16" fill="#fff" rx="2" />
                <rect x="11" y="11" width="10" height="10" fill="#000" rx="1.5" />

                <rect x="73" y="5" width="22" height="22" fill="#000" rx="3" />
                <rect x="76" y="8" width="16" height="16" fill="#fff" rx="2" />
                <rect x="79" y="11" width="10" height="10" fill="#000" rx="1.5" />

                <rect x="5" y="73" width="22" height="22" fill="#000" rx="3" />
                <rect x="8" y="76" width="16" height="16" fill="#fff" rx="2" />
                <rect x="11" y="79" width="10" height="10" fill="#000" rx="1.5" />

                {/* Simulated Rolling Data Matrix Elements */}
                {Array.from({ length: 36 }).map((_, i) => {
                  const x = 32 + (i % 6) * 6;
                  const y = 20 + Math.floor(i / 6) * 10;
                  const isFilled = ((i * 17 + qrNonce) % 3) !== 0;
                  return isFilled ? (
                    <rect key={i} x={x} y={y} width="4.5" height="4.5" fill="#16A34A" rx="0.5" />
                  ) : null;
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Circular Countdown Indicator */}
        {!useStaticFallback && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-500 ${secondsRemaining < 5 ? 'animate-spin' : ''}`} />
            <span>Refreshes in <strong className="text-slate-800 dark:text-slate-200">{secondsRemaining}s</strong></span>
          </div>
        )}

        {/* Member Seat & Shift Card */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-[#141A17] border border-slate-200 dark:border-[#1E2621] text-left">
          <div className="flex items-center justify-between">
            <span className="seat-code text-2xl font-extrabold text-slate-900 dark:text-white">
              Seat {member.seatCode || 'A-12'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> In Now
            </span>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
            Shift: <strong className="text-emerald-600 dark:text-emerald-400">{member.shiftName || 'Morning'}</strong> (6:30 AM – 1:00 PM)
          </div>

          {/* Peer Trust Notice: Next occupant */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#1E2621] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Next seat occupant:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Neha S. (1:00 PM Afternoon)</span>
          </div>
        </div>

        {/* Validity Countdown Bar */}
        <div className="mt-4 text-left">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Eligibility Window:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">Valid till {formatDisplayDate(member.validTill)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }}></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">42 days remaining. Auto-flagged for renewal 7 days prior.</p>
        </div>

        {/* Action Toggle Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => setUseStaticFallback(s => !s)}
            className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1E2621] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            {useStaticFallback ? 'Show Rolling QR' : 'Static PIN Fallback'}
          </button>

          <button
            onClick={onOpenReadOnlyMap}
            className="py-2 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-semibold shadow hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Floor Map</span>
          </button>
        </div>
      </div>
    </div>
  );
};
