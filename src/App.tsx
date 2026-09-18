/**
 * Ashraya — Campus Library Seat Booking System
 * Production Operational Console, Digital Pass & Gate Access Terminal
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  generateInitialSeats,
  DEFAULT_SHIFTS,
  DEFAULT_ZONES,
  Seat,
  Shift,
  Zone,
  Member,
} from './data/mockData.ts';
import { SeatMap } from './components/SeatMap.tsx';
import { AllotDrawer } from './components/AllotDrawer.tsx';
import { MemberPass } from './components/MemberPass.tsx';
import { GateKiosk } from './components/GateKiosk.tsx';
import {
  LayoutGrid,
  Smartphone,
  ShieldCheck,
  Sun,
  Moon,
  Building2,
  Clock,
  Database,
  RefreshCw,
} from 'lucide-react';
import { formatISTTime } from '@ashraya/utils';
import {
  isSupabaseConfigured,
  checkSupabaseHealth,
  fetchLiveLibraryState,
  supabase,
  SupabaseHealthStatus,
} from './lib/supabase.ts';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeTab, setActiveTab] = useState<'console' | 'member' | 'gate'>('console');

  // Dynamic Application State (populated from live Supabase)
  const [seats, setSeats] = useState<Seat[]>(() => generateInitialSeats());
  const [shifts, setShifts] = useState<Shift[]>(DEFAULT_SHIFTS);
  const [zones, setZones] = useState<Zone[]>(DEFAULT_ZONES);
  const [members, setMembers] = useState<Member[]>([]);
  const [dbStatus, setDbStatus] = useState<SupabaseHealthStatus | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);

  // Map & Drawer state
  const [activeShift, setActiveShift] = useState<'morning' | 'afternoon' | 'evening' | 'night' | 'all'>('morning');
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [conflictingSeatCode, setConflictingSeatCode] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Sync theme with document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Dynamic data synchronizer from Supabase
  const loadLiveState = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoadingLive(false);
      return;
    }

    setIsLoadingLive(true);
    try {
      const [status, liveState] = await Promise.all([
        checkSupabaseHealth(),
        fetchLiveLibraryState(),
      ]);

      setDbStatus(status);

      if (liveState) {
        setSeats(liveState.seats);
        setShifts(liveState.shifts);
        setZones(liveState.zones);
        setMembers(liveState.members);

        setSelectedMemberId(prev => {
          if (prev && liveState.members.some(m => m.id === prev)) return prev;
          return liveState.members[0]?.id || '';
        });
      }
    } catch (err) {
      console.error('Failed to synchronize live library state:', err);
    } finally {
      setIsLoadingLive(false);
    }
  }, []);

  // Initial load & real-time subscription
  useEffect(() => {
    loadLiveState();

    if (supabase) {
      const client = supabase;
      const channel = client
        .channel('library-db-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
          loadLiveState();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'seats' }, () => {
          loadLiveState();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
          loadLiveState();
        })
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    }
  }, [loadLiveState]);

  // Handle Allotment Confirmation
  const handleConfirmAllotment = async (allotment: {
    seatId: string;
    seatCode: string;
    shiftId: string;
    shiftName: string;
    memberId: string;
    memberName: string;
    validTill: string;
  }) => {
    const shiftKey = allotment.shiftName.toLowerCase() as 'morning' | 'afternoon' | 'evening' | 'night';

    // Optimistically update seat status
    setSeats(prev =>
      prev.map(seat => {
        if (seat.id === allotment.seatId || seat.code === allotment.seatCode) {
          return {
            ...seat,
            shiftStatuses: {
              ...seat.shiftStatuses,
              [shiftKey]: 'reserved',
            },
            occupants: {
              ...seat.occupants,
              [shiftKey]: {
                name: allotment.memberName,
                roll: 'REG',
                validTill: allotment.validTill,
              },
            },
          };
        }
        return seat;
      })
    );

    // Refresh state directly from Supabase DB to reflect real database counts and bindings
    await loadLiveState();
  };

  const handleSelectSeat = useCallback((seat: Seat) => {
    setSelectedSeat(seat);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedSeat(null);
    setConflictingSeatCode(null);
  }, []);

  const handleConflictDetected = useCallback((code: string | null) => {
    setConflictingSeatCode(code);
  }, []);

  const handleSelectMember = useCallback((m: Member) => {
    setSelectedMemberId(m.id);
  }, []);

  const handleOpenReadOnlyMap = useCallback(() => {
    setActiveTab('console');
  }, []);

  const currentMember = useMemo(() => {
    return (
      members.find(m => m.id === selectedMemberId) ||
      members[0] ||
      null
    );
  }, [members, selectedMemberId]);

  const currentShift = useMemo(() => {
    if (!currentMember?.shiftName) return shifts[0] || null;
    const targetName = currentMember.shiftName.toLowerCase();
    return (
      shifts.find(s => s.name.toLowerCase() === targetName) ||
      shifts[0] ||
      null
    );
  }, [shifts, currentMember?.shiftName]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0F1412]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1E2621] px-4 sm:px-6 py-2.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Location */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-display font-bold text-lg shadow-sm">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
                  Ashraya
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#0F2417] dark:text-emerald-400 dark:border-emerald-800">
                  v1.1 Production
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>Central Library & Study Hall (240 Seats)</span>
              </p>
            </div>
          </div>

          {/* Center Navigation Switcher Tabs */}
          <nav className="flex items-center bg-slate-200/70 dark:bg-[#141A17] p-1 rounded-2xl border border-slate-300/70 dark:border-[#1E2621]">
            <button
              id="nav-tab-console"
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'console'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 dark:bg-[#22C55E] dark:text-black dark:border-transparent'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Ops Console</span>
            </button>

            <button
              id="nav-tab-member"
              onClick={() => setActiveTab('member')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'member'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 dark:bg-[#22C55E] dark:text-black dark:border-transparent'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Member Pass</span>
            </button>

            <button
              id="nav-tab-gate"
              onClick={() => setActiveTab('gate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'gate'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 dark:bg-[#22C55E] dark:text-black dark:border-transparent'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Gate Kiosk</span>
            </button>
          </nav>

          {/* Right Status Indicator & Controls */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* Supabase Connection Status Badge */}
            <button
              onClick={() => loadLiveState()}
              className={`flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-xl border transition-all cursor-pointer hover:opacity-90 active:scale-95 ${
                dbStatus?.connected
                  ? 'bg-emerald-50/80 dark:bg-[#0C1F14] text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                  : isSupabaseConfigured
                  ? 'bg-amber-50/80 dark:bg-[#1F190C] text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                  : 'bg-slate-100 dark:bg-[#141A17] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#1E2621]'
              }`}
              title={
                dbStatus?.connected
                  ? `Supabase: Connected (${dbStatus.tablesCount?.seats || 240} seats, ${dbStatus.tablesCount?.bookings || 0} bookings) · Click to sync`
                  : 'Supabase status · Click to reconnect'
              }
            >
              <Database className="w-3 h-3" />
              <span className="hidden sm:inline">
                {isLoadingLive ? (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>Syncing...</span>
                  </span>
                ) : dbStatus?.connected ? (
                  'Supabase: Live'
                ) : isSupabaseConfigured ? (
                  'Supabase: Connecting'
                ) : (
                  'Local Cache'
                )}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  dbStatus?.connected
                    ? 'bg-emerald-500 animate-pulse'
                    : isSupabaseConfigured
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
            </button>

            {/* IST Clock */}
            <div className="hidden md:flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#141A17] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-[#1E2621]">
              <Clock className="w-3 h-3 text-emerald-500" />
              <span>{formatISTTime()} IST</span>
            </div>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              className="p-1.5 rounded-xl border border-slate-300 dark:border-[#2C372F] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E2621] transition-colors"
              title="Toggle Light / Dark theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'console' && (
          <div className="h-[calc(100vh-120px)]">
            <SeatMap
              seats={seats}
              zones={zones}
              shifts={shifts}
              activeShift={activeShift}
              onShiftChange={setActiveShift}
              selectedSeat={selectedSeat}
              onSelectSeat={handleSelectSeat}
              conflictingSeatCode={conflictingSeatCode}
            />
          </div>
        )}

        {activeTab === 'member' && (
          <div className="py-6">
            {currentMember && currentShift ? (
              <MemberPass
                member={currentMember}
                shift={currentShift}
                members={members}
                onSelectMember={handleSelectMember}
                onOpenReadOnlyMap={handleOpenReadOnlyMap}
              />
            ) : (
              <div className="max-w-md mx-auto p-12 text-center text-slate-500 font-mono text-sm bg-white dark:bg-[#0F1412] rounded-2xl border border-slate-200 dark:border-[#1E2621]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-emerald-500" />
                <div>Loading member pass from Supabase...</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gate' && (
          <div className="h-[calc(100vh-170px)] min-h-[580px]">
            <GateKiosk members={members} />
          </div>
        )}
      </main>

      {/* Application Footer */}
      <footer
        id="app-footer"
        className="mt-auto py-3.5 px-4 text-center border-t border-slate-200 dark:border-[#1E2621] bg-white/80 dark:bg-[#0F1412]/80 backdrop-blur-sm text-xs text-slate-500 dark:text-slate-400"
      >
        Built with ❤️ by{' '}
        <a
          href="https://www.linkedin.com/in/sameer-challa/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-slate-300 dark:decoration-slate-600 hover:decoration-emerald-500 transition-colors"
        >
          Sameer Challa
        </a>
      </footer>

      {/* Allotment Drawer Overlay */}
      {selectedSeat && (
        <AllotDrawer
          seat={selectedSeat}
          shifts={shifts}
          members={members}
          onClose={handleCloseDrawer}
          onConfirmAllotment={handleConfirmAllotment}
          onConflictDetected={handleConflictDetected}
        />
      )}
    </div>
  );
}
