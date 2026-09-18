/**
 * Ashraya Component: GateVerdict
 * Spec 2.design.md S8 & 1.prd.md F5
 */

import React, { useEffect } from 'react';
import { ShieldCheck, ShieldAlert, WifiOff, Volume2, KeyRound } from 'lucide-react';

interface GateVerdictProps {
  decision: 'open' | 'deny' | 'idle';
  memberName?: string;
  seatCode?: string;
  shiftName?: string;
  reason?: string;
  isOffline?: boolean;
  latencyMs?: number;
  onOverride?: (reason: string) => void;
  onDismiss: () => void;
}

export const GateVerdict: React.FC<GateVerdictProps> = ({
  decision,
  memberName,
  seatCode,
  shiftName,
  reason,
  isOffline,
  latencyMs,
  onOverride,
  onDismiss,
}) => {
  // Web Audio API Sound generator
  useEffect(() => {
    if (decision === 'idle') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (decision === 'open') {
        // High-pitched double chime for GATE OPEN
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.1); // D6
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Low double buzz for GATE LOCKED
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }

    // Auto dismiss after 4 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => clearTimeout(timer);
  }, [decision, onDismiss]);

  if (decision === 'idle') return null;

  const isOpen = decision === 'open';

  return (
    <div
      id="gate-verdict-overlay"
      className="fixed inset-0 z-50 flex flex-col justify-between p-6 sm:p-12 animate-in fade-in duration-200"
      style={{
        backgroundColor: isOpen ? '#15803D' : '#7F1D1D',
        color: '#FFFFFF',
      }}
    >
      {/* Top Banner: Verdict & Latency */}
      <div className="flex items-center justify-between border-b border-white/20 pb-4">
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ShieldCheck className="w-10 h-10 text-emerald-200" />
          ) : (
            <ShieldAlert className="w-10 h-10 text-red-200" />
          )}
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight font-display">
              {isOpen ? 'GATE OPEN' : 'LOCKED — DENIED'}
            </h1>
            <p className="text-xs sm:text-sm font-medium opacity-80 mt-1">
              {isOpen ? 'Verified & Valid Shift Allotment' : 'Access Prohibited at Turnstile 1'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs bg-black/30 px-3 py-1.5 rounded-xl">
          {isOffline && <WifiOff className="w-4 h-4 text-amber-300" />}
          <span>{latencyMs ? `${latencyMs} ms` : '620 ms'}</span>
        </div>
      </div>

      {/* Middle Hero: Student Details or Denial Reason */}
      <div className="my-auto max-w-2xl mx-auto w-full text-center space-y-4">
        {isOpen ? (
          <div className="bg-black/25 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl space-y-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-400 text-black font-extrabold text-sm tracking-wider uppercase">
              Relay Pulse 1.5s Active
            </div>

            <div className="text-4xl sm:text-6xl font-bold tracking-tight">
              {memberName || 'Ravi Kumar'}
            </div>

            <div className="flex items-center justify-center gap-4 text-lg sm:text-2xl font-semibold">
              <span className="seat-code bg-white/20 px-3 py-1 rounded-xl">
                Seat {seatCode || 'A-12'}
              </span>
              <span>•</span>
              <span className="text-emerald-200">
                {shiftName || 'Morning'} Shift
              </span>
            </div>
            
            <p className="text-sm opacity-80 font-mono">
              Timestamp: {new Date().toLocaleTimeString('en-IN')} IST · Audit #{Math.floor(Math.random() * 8999 + 1000)}
            </p>
          </div>
        ) : (
          <div className="bg-black/30 backdrop-blur-sm p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl space-y-4">
            <div className="text-2xl sm:text-4xl font-bold text-red-200">
              {reason || 'Membership validity ended on 12 Sep. Ask front desk to renew.'}
            </div>

            {memberName && (
              <div className="text-lg font-semibold text-white/90">
                Member: {memberName}
              </div>
            )}

            <p className="text-xs opacity-75 font-mono">
              Desk Renewal Ticket #481 auto-dispatched to Sunita (Warden)
            </p>
          </div>
        )}
      </div>

      {/* Bottom Action Strip: Guard Override */}
      <div className="flex items-center justify-between pt-4 border-t border-white/20">
        <button
          onClick={onDismiss}
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          Dismiss (Esc)
        </button>

        {!isOpen && onOverride && (
          <button
            onClick={() => onOverride('Warden emergency manual admit')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-400 text-black text-sm font-bold shadow-lg hover:bg-amber-300 transition-transform active:scale-95"
          >
            <KeyRound className="w-5 h-5" />
            <span>Guard Override (Log Incident)</span>
          </button>
        )}
      </div>
    </div>
  );
};
