import { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, ChevronRight, Calendar, Flame, Droplets, Dumbbell, TrendingUp } from 'lucide-react';
import type { UserProfile, DailyRecord } from '../../types';
import { idbGetAllRecords } from '../../utils/indexedDB';
import { loadAllRecords } from '../../utils/storage';
import { sumMacrosWithEstimate } from '../../utils/calculations';
import { loadWeightRecords } from './TodayWeightCard';
import type { DayStats } from './AIHealingCard';
import WeeklyStatsModal from './WeeklyStatsModal';
import WeeklyCharts from './WeeklyCharts';
import TodayDualRingBar from './TodayDualRingBar';
import InflammationIndexCard from './InflammationIndexCard';
import SodiumAnalysisCard from './SodiumAnalysisCard';
import ActivityBurnCard from './ActivityBurnCard';
import MacroRhythmBars from './MacroRhythmBars';
import WaterWeightChart from './WaterWeightChart';

interface AnalyticsPanelProps {
  profile: UserProfile | null;
  record: DailyRecord;
  journalDate?: string;
}

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const PURE_WATER_KW = ['水', '矿泉', '开水', '温水', '凉水', '白水', '饮用', '纯净', '蒸馏', '自来'];

function isPureWater(note: string | undefined): boolean {
  if (!note || note.trim() === '') return true;
  return PURE_WATER_KW.some(kw => note.includes(kw));
}

function calcTarget(profile: UserProfile): number {
  const bmr =
    profile.gender === 'male'
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  const tdee = bmr * (ACTIVITY_FACTOR[profile.activityLevel] ?? 1.55);
  return Math.round(
    profile.goal === 'lose' ? tdee - 500 : profile.goal === 'gain' ? tdee + 300 : tdee,
  );
}

function calcTDEE(profile: UserProfile): number {
  const bmr =
    profile.gender === 'male'
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  return Math.round(bmr * (ACTIVITY_FACTOR[profile.activityLevel] ?? 1.55));
}

function dayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function makeDateLabel(journalDate?: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (!journalDate || journalDate === today) return '今日';
  const d = new Date(journalDate + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '年' : ''}${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function AnalyticsPanel({ profile, record, journalDate }: AnalyticsPanelProps) {
  const dateLabel = makeDateLabel(journalDate);
  const [stats, setStats] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      if (!mountedRef.current) return;
      setLoading(true);
      const allLS = loadAllRecords();
      const weightRecords = loadWeightRecords();

      let idbAll: DailyRecord[] = [];
      try {
        idbAll = await idbGetAllRecords();
      } catch {}

      const idbMap: Record<string, DailyRecord> = {};
      for (const r of idbAll) {
        if (r.date) idbMap[r.date] = r;
      }

      const allDates = new Set([...Object.keys(allLS), ...Object.keys(idbMap)]);
      const sortedDates = [...allDates].sort();
      const computed: DayStats[] = [];

      for (const date of sortedDates) {
        if (!mountedRef.current) return;
        const rec = idbMap[date] ?? (allLS[date] ? { ...allLS[date], water: allLS[date].water ?? [] } : null);
        if (!rec) continue;

        try {
          const allFoods = Object.values(rec.meals ?? {}).flat();
          const intake = allFoods.reduce((s, f) => s + (f.calories ?? 0), 0);
          const burn = (rec.exercises ?? []).reduce((s, e) => s + (e.calories ?? 0), 0);

          if (intake === 0 && burn === 0 && (rec.water ?? []).length === 0) continue;

          let pureWater = 0;
          let foodWater = 0;
          for (const w of rec.water ?? []) {
            if (isPureWater(w.note)) pureWater += w.amount;
            else foodWater += w.amount;
          }

          const { protein, carbs, fat } = sumMacrosWithEstimate(rec.meals ?? {});
          const fiber = Math.round(allFoods.reduce((s, f) => s + (f.fiber ?? 0), 0));
          const sodium = Math.round(allFoods.reduce((s, f) => s + (f.sodium ?? 0), 0));
          const exercises = (rec.exercises ?? []).map(e => ({
            name: e.name,
            duration: e.duration,
            calories: e.calories,
          }));

          // 四餐热量
          const mealCals = [
            (rec.meals?.breakfast ?? []).reduce((s, f) => s + (f.calories ?? 0), 0),
            (rec.meals?.lunch ?? []).reduce((s, f) => s + (f.calories ?? 0), 0),
            (rec.meals?.dinner ?? []).reduce((s, f) => s + (f.calories ?? 0), 0),
            (rec.meals?.snack ?? []).reduce((s, f) => s + (f.calories ?? 0), 0),
          ];

          computed.push({
            date,
            label: dayLabel(date),
            intake,
            burn,
            water: pureWater + foodWater,
            pureWater,
            foodWater,
            net: intake - burn,
            protein,
            carbs,
            fat,
            fiber,
            sodium,
            exercises,
            weight: weightRecords[date],
            mealCals,
          });
        } catch {}
      }

      if (mountedRef.current) {
        setStats(computed);
        if (computed.length > 0) {
          const first = computed[0].date;
          const last = computed[computed.length - 1].date;
          setDateRange(first === last ? fmtDate(first) : `${fmtDate(first)} — ${fmtDate(last)}`);
        }
        setLoading(false);
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, []);

  const targetCalories = profile ? calcTarget(profile) : 2000;
  const tdee = profile ? calcTDEE(profile) : 0;
  const activeDays = stats.filter(d => d.intake > 0);
  const daysOnTarget = stats.filter(d => d.intake > 0 && d.intake <= targetCalories).length;
  const waterDays = stats.filter(d => d.water >= 1500).length;
  const exerciseDays = stats.filter(d => d.burn > 0).length;
  const today = new Date().toISOString().split('T')[0];
  const todayWeightRecords = loadWeightRecords();
  const currentJournalDate = journalDate ?? today;
  const baseWeight = todayWeightRecords[today] ?? profile?.weight ?? 0;
  const currentDayWeight = todayWeightRecords[currentJournalDate];

  const totalWater = (record.water || []).reduce((s, w) => s + w.amount, 0);

  const allTimeMetrics = [
    { label: '记录天', value: activeDays.length, icon: Calendar, color: '#8B5CF6' },
    { label: '达标天', value: daysOnTarget, icon: Flame, color: '#F97316' },
    { label: '运动天', value: exerciseDays, icon: Dumbbell, color: '#22C55E' },
    { label: '补水天', value: waterDays, icon: Droplets, color: '#0EA5E9' },
  ];

  // 时光机主页仅展示最近 7 天
  const recentStats = useMemo(() => stats.slice(-7), [stats]);

  return (
    <div className="space-y-4">
      <TodayDualRingBar
        profile={profile}
        record={record}
        dateLabel={dateLabel}
        currentWeight={currentDayWeight}
      />

      {!loading && recentStats.length > 0 && (
        <WeeklyCharts stats={recentStats} targetCalories={targetCalories} />
      )}

      {!loading && recentStats.length > 0 && (
        <ActivityBurnCard stats={recentStats} />
      )}

      {!loading && recentStats.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/50 shadow-sm p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,248,240,0.55), rgba(255,240,235,0.45))',
              backdropFilter: 'blur(12px)',
            }}>
            <div className="flex items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(249,115,22,0.06))',
                    boxShadow: '0 2px 8px rgba(249,115,22,0.15)',
                  }}>
                  <Flame className="w-4 h-4" style={{ color: '#F97316' }} />
                </div>
                <p className="text-sm font-bold text-foreground">近 7 天热量明细</p>
              </div>
              <span className="text-[10px] text-muted-foreground/50">仅展示最近一周</span>
            </div>
            <div className="space-y-1">
              {recentStats.map(d => {
                const totalExp = (tdee > 0 ? tdee : targetCalories) + d.burn;
                const gap = d.intake > 0 ? d.intake - totalExp : null;
                const pctIntake = d.intake > 0 ? Math.min(d.intake / (targetCalories > 0 ? targetCalories : 2000), 1.2) : 0;
                const pctBurn = d.intake > 0 ? Math.min(totalExp / (targetCalories > 0 ? targetCalories : 2000), 1.2) : 0;
                const gapStatus = gap !== null ? (gap <= 0 ? 'green' : 'red') : 'none';
                return (
                  <div key={d.date} className="group flex items-center gap-2.5 py-2 px-2 rounded-xl transition-all hover:bg-muted/60">
                    <span className="text-[11px] font-semibold text-muted-foreground w-9 text-center tabular-nums">{d.label}</span>
                    <div className="flex-1 space-y-1">
                      {d.intake > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">{d.intake}</span>
                            <div className="flex-1 h-2 bg-orange-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(pctIntake * 100, 100)}%`,
                                  background: 'linear-gradient(90deg, #fb923c, #f97316)',
                                }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">{totalExp}</span>
                            <div className="flex-1 h-2 bg-indigo-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(pctBurn * 100, 100)}%`,
                                  background: 'linear-gradient(90deg, #818cf8, #6366f1)',
                                }} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30 italic">无记录</span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold tabular-nums w-12 text-right" style={{
                      color: gapStatus === 'green' ? '#22c55e' : gapStatus === 'red' ? '#ef4444' : '#9ca3af',
                    }}>
                      {gap !== null ? `${gap > 0 ? '+' : ''}${gap}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/50 shadow-sm p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(245,240,255,0.5), rgba(240,238,255,0.4))',
              backdropFilter: 'blur(12px)',
            }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.06))',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.15)',
                }}>
                <TrendingUp className="w-4 h-4" style={{ color: '#6366F1' }} />
              </div>
              <p className="text-sm font-bold text-foreground">营养节律</p>
            </div>
            <MacroRhythmBars stats={recentStats} targetCalories={targetCalories} />
          </div>

          <WaterWeightChart stats={recentStats} baseWeight={baseWeight} />
        </div>
      )}

      <InflammationIndexCard
        profile={profile}
        record={record}
        waterAmount={totalWater}
      />

      <SodiumAnalysisCard profile={profile} record={record} />

      <button
        data-tutorial="chart"
        onClick={() => setModalOpen(true)}
        className="w-full text-left cursor-pointer group"
        disabled={loading}
      >
        <div
          className="relative rounded-2xl overflow-hidden transition-all duration-500 group-hover:scale-[1.01] group-active:scale-[0.985]"
          style={{
            background: 'linear-gradient(135deg, #a3b899 0%, #7cb9e8 35%, #a78bfa 65%, #c084fc 100%)',
            padding: '24px',
            boxShadow: '0 12px 40px rgba(124,185,232,0.3), 0 4px 16px rgba(167,139,250,0.15)',
          }}
        >
          {/* 动态光斑 */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-1/2 -right-1/4 w-72 h-72 rounded-full opacity-30 animate-pulse"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 60%)', animationDuration: '3s' }} />
            <div className="absolute -bottom-1/2 -left-1/4 w-64 h-64 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, rgba(192,132,252,0.4) 0%, transparent 60%)' }} />
          </div>
          {/* 对角光条 */}
          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s ease-in-out infinite',
            }} />

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 group-hover:scale-110 duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-base leading-none tracking-tight">全程档案</p>
                  <p className="text-white/60 text-[11px] mt-1">{dateRange || '加载中...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-white/70 text-xs font-semibold">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="group-hover:underline decoration-white/30 underline-offset-4">翻开手账</span>
                    <ChevronRight className="w-4 h-4 transition-all group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </div>

            {/* Mini Sparkline — 热量趋势预览 */}
            {!loading && stats.length >= 3 && (
              <div className="mb-3">
                <svg width="100%" viewBox={`0 0 ${Math.max(stats.length * 8, 200)} 36`} className="w-full h-9 overflow-visible opacity-70">
                  {(() => {
                    const intakeVals = stats.map(d => d.intake);
                    const mx = Math.max(...intakeVals, 50);
                    const w = Math.max(stats.length * 8, 200);
                    const points = intakeVals.map((v, i) => {
                      const x = (i / Math.max(stats.length - 1, 1)) * w;
                      const y = 32 - (v / mx) * 28;
                      return `${x},${y}`;
                    }).join(' ');
                    const areaPts = `${0},32 ${points} ${w},32`;
                    return (
                      <>
                        <defs>
                          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="white" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <polygon points={areaPts} fill="url(#sparkGrad)" />
                        <polyline points={points} fill="none" stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            {!loading && (
              <div className="grid grid-cols-4 gap-2">
                {allTimeMetrics.map((m, idx) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
                      style={{
                        background: 'rgba(255,255,255,0.15)',
                        animation: `fadeSlideUp 0.4s ${0.1 * idx}s both`,
                      }}>
                      <Icon className="w-4 h-4 text-white/75" />
                      <p className="text-white font-black text-lg leading-none tabular-nums">{m.value}</p>
                      <p className="text-white/50 text-[10px] font-medium">{m.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {loading && (
              <div className="h-20 flex items-center justify-center">
                <p className="text-white/50 text-xs animate-pulse">正在加载历史数据...</p>
              </div>
            )}
          </div>
        </div>
      </button>

      <WeeklyStatsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        stats={stats}
        profile={profile}
        activeDaysCount={activeDays.length}
        waterDays={waterDays}
        exerciseDays={exerciseDays}
        daysOnTarget={daysOnTarget}
        targetCalories={targetCalories}
        tdee={tdee}
        baseWeight={baseWeight}
        dateRange={dateRange}
      />
    </div>
  );
}
