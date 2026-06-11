import { useState, useEffect, useRef } from 'react';
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
          const sodium = Math.round(allFoods.reduce((s, f) => s + (f.sodium ?? 0), 0));
          const exercises = (rec.exercises ?? []).map(e => ({
            name: e.name,
            duration: e.duration,
            calories: e.calories,
          }));

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
            sodium,
            exercises,
            weight: weightRecords[date],
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

  return (
    <div className="space-y-4">
      <TodayDualRingBar
        profile={profile}
        record={record}
        dateLabel={dateLabel}
        currentWeight={currentDayWeight}
      />

      {!loading && stats.length > 0 && (
        <WeeklyCharts stats={stats} targetCalories={targetCalories} />
      )}

      {!loading && stats.length > 0 && (
        <ActivityBurnCard stats={stats} />
      )}

      {!loading && stats.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white border border-border shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: '#F9731618' }}>
                <Flame className="w-3 h-3" style={{ color: '#F97316' }} />
              </div>
              <p className="text-xs font-bold text-foreground">近期热量</p>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-1.5 font-medium">日期</th>
                  <th className="text-right pb-1.5 font-medium pr-2">摄入</th>
                  <th className="text-right pb-1.5 font-medium pr-2">消耗</th>
                  <th className="text-right pb-1.5 font-medium">缺口</th>
                </tr>
              </thead>
              <tbody>
                {stats.slice(-7).map(d => {
                  const totalExp = (tdee > 0 ? tdee : targetCalories) + d.burn;
                  const gap = d.intake > 0 ? d.intake - totalExp : null;
                  return (
                    <tr key={d.date} className="border-b border-border/30 last:border-0">
                      <td className="py-1 text-muted-foreground">{d.label}</td>
                      <td className="py-1 text-right tabular-nums pr-2" style={{ color: '#F97316' }}>
                        {d.intake > 0 ? d.intake : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums pr-2" style={{ color: '#22C55E' }}>
                        {d.intake > 0 ? totalExp : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-1 text-right tabular-nums font-semibold">
                        {gap !== null ? (
                          <span style={{ color: gap <= 0 ? '#22C55E' : '#F97316' }}>
                            {gap > 0 ? '+' : ''}{gap}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-white border border-border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#6366F118' }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#6366F1' }} />
              </div>
              <p className="text-xs font-bold text-foreground">营养节律</p>
            </div>
            <MacroRhythmBars stats={stats} targetCalories={targetCalories} />
          </div>

          <WaterWeightChart stats={stats} baseWeight={baseWeight} />
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
          className="relative rounded-2xl overflow-hidden transition-transform active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #A3B899 0%, #7CB9E8 55%, #C084FC 100%)',
            padding: '20px',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 85% 15%, rgba(255,255,255,0.2) 0%, transparent 50%)',
            }}
          />
          <div
            className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)' }}
          />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.25)' }}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">全程档案</p>
                  <p className="text-white/65 text-[10px] mt-0.5">{dateRange || '加载中...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-white/80 text-xs font-medium">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>翻开手账 <ChevronRight className="w-4 h-4" /></>
                )}
              </div>
            </div>

            {!loading && (
              <div className="grid grid-cols-4 gap-2">
                {allTimeMetrics.map(m => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.label}
                      className="flex flex-col items-center gap-1 py-2 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.18)' }}
                    >
                      <Icon className="w-3.5 h-3.5 text-white/80" />
                      <p className="text-white font-bold text-base leading-none">{m.value}</p>
                      <p className="text-white/65 text-[10px]">{m.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {loading && (
              <div className="h-16 flex items-center justify-center">
                <p className="text-white/60 text-xs">正在加载历史数据...</p>
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
