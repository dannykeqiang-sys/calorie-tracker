import { useEffect, useState, useMemo, useRef } from 'react';
import { X, Calendar, Flame, Dumbbell, TrendingUp, TrendingDown, Minus, Lightbulb, Gauge, Droplets } from 'lucide-react';
import type { UserProfile } from '../../types';
import AIHealingCard, { type DayStats, classifyDay, STATE_CONFIGS } from './AIHealingCard';
import {
  CalorieTrendChart,
  MacroLineChart,
  MacroSankey,
  MealHeatmap,
  ChartCard,
  DailyKLineChart,
} from './WeeklyCharts';

interface WeeklyStatsModalProps {
  open: boolean;
  onClose: () => void;
  stats: DayStats[];
  profile: UserProfile | null;
  activeDaysCount: number;
  exerciseDays: number;
  daysOnTarget: number;
  targetCalories: number;
  tdee: number;
  dateRange?: string;
  selectedDate?: string;
}

function getHeadline(name: string, activeDays: number, daysOnTarget: number, exerciseDays: number): string {
  if (activeDays === 0) return `${name}，翻开这里，是你旅程的第一步`;
  if (activeDays >= 60 && daysOnTarget >= 45) return `${name}，这份坚持是真正属于你的财富`;
  if (activeDays >= 30 && daysOnTarget >= 20) return `${name}，你一直都很闪光`;
  if (exerciseDays >= 20 && daysOnTarget >= 20) return `${name}，自律让你更美`;
  if (daysOnTarget >= Math.round(activeDays * 0.7)) return `${name}，你的节制令人心疼地美`;
  if (activeDays >= 10) return `${name}，每一天的记录都是爱自己`;
  return `${name}，你一直都在路上`;
}

function getSubline(activeDays: number, exerciseDays: number): string {
  const parts: string[] = [];
  if (activeDays > 0) parts.push(`记录了 ${activeDays} 天`);
  if (exerciseDays > 0) parts.push(`运动了 ${exerciseDays} 天`);
  if (parts.length === 0) return '开启你的健康旅程吧';
  return parts.join('，');
}

interface TrendItem {
  label: string;
  early: number;
  late: number;
  unit: string;
  higherIsBetter: boolean;
}

function getTrendItems(stats: DayStats[]): TrendItem[] {
  const activeDays = stats.filter(d => d.intake > 0);
  if (activeDays.length < 2) return [];
  const mid = Math.ceil(activeDays.length / 2);
  const early = activeDays.slice(0, mid);
  const late = activeDays.slice(mid);
  if (late.length === 0) return [];
  const avg = (arr: DayStats[], key: keyof DayStats) =>
    Math.round(arr.reduce((s, d) => s + (d[key] as number), 0) / arr.length);

  return [
    { label: '平均摄入', early: avg(early, 'intake'), late: avg(late, 'intake'), unit: 'kcal', higherIsBetter: false },
    { label: '平均运动', early: avg(early, 'burn'), late: avg(late, 'burn'), unit: 'kcal', higherIsBetter: true },
    { label: '平均饮水', early: avg(early, 'water'), late: avg(late, 'water'), unit: 'ml', higherIsBetter: true },
    { label: '平均蛋白', early: avg(early, 'protein'), late: avg(late, 'protein'), unit: 'g', higherIsBetter: true },
  ];
}

interface Suggestion {
  text: string;
  color: string;
  priority: number;
}

function getSuggestions(stats: DayStats[], profile: UserProfile | null, targetCalories: number): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const activeDays = stats.filter(d => d.intake > 0);
  const exerciseDays = stats.filter(d => d.burn > 0).length;
  const lowWaterDays = stats.filter(d => d.intake > 0 && d.water < 1500).length;
  const overTargetDays = activeDays.filter(d => d.intake > targetCalories + 100).length;
  const overTargetRate = activeDays.length > 0 ? overTargetDays / activeDays.length : 0;
  const exerciseRate = activeDays.length > 0 ? exerciseDays / activeDays.length : 0;

  const weightDays = stats.filter(d => d.weight !== undefined && d.weight !== null) as (DayStats & { weight: number })[];
  const weightTrend = weightDays.length >= 2
    ? weightDays[weightDays.length - 1].weight - weightDays[0].weight
    : null;

  if (activeDays.length < 7) {
    suggestions.push({ text: `目前仅有 ${activeDays.length} 天有效记录，坚持每天记录才能让数据真正帮到你`, color: '#8B5CF6', priority: 1 });
  }
  if (exerciseDays === 0 && activeDays.length >= 3) {
    suggestions.push({ text: '暂无运动记录，每周 2-3 次有氧运动对热量管理帮助很大', color: '#F97316', priority: 2 });
  } else if (exerciseRate < 0.3 && activeDays.length >= 7) {
    suggestions.push({ text: `运动频率偏低（${exerciseDays}/${activeDays.length} 天），尝试提升到每 3 天至少运动 1 次`, color: '#F59E0B', priority: 3 });
  }
  if (lowWaterDays >= 3) {
    suggestions.push({ text: `有 ${lowWaterDays} 天饮水不足 1500ml，充足的水分有助于代谢和减脂`, color: '#0EA5E9', priority: 4 });
  }
  if (overTargetRate >= 0.4 && overTargetDays >= 3) {
    suggestions.push({ text: `${overTargetDays} 天热量超标，占记录天数 ${Math.round(overTargetRate * 100)}%，可减少精制碳水和晚餐分量`, color: '#EF4444', priority: 5 });
  }
  if (weightTrend !== null) {
    if (weightTrend > 1 && profile?.goal === 'lose') {
      suggestions.push({ text: `体重整体上升了 ${weightTrend.toFixed(1)} kg，建议减少热量摄入并增加有氧运动`, color: '#EF4444', priority: 2 });
    } else if (weightTrend < -1 && profile?.goal === 'gain') {
      suggestions.push({ text: `体重整体下降了 ${Math.abs(weightTrend).toFixed(1)} kg，增加蛋白质和热量摄入很重要`, color: '#F97316', priority: 2 });
    } else if (weightTrend < -0.5 && profile?.goal === 'lose') {
      suggestions.push({ text: `减重 ${Math.abs(weightTrend).toFixed(1)} kg，控制节奏很棒，继续保持`, color: '#22C55E', priority: 6 });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({ text: '整体表现均衡，继续保持当前的饮食和运动节奏', color: '#A3B899', priority: 99 });
  }
  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

/* ─── 周K线图已迁移为日K线图 — 使用 WeeklyCharts.tsx 中的 DailyKLineChart ─── */

export default function WeeklyStatsModal({
  open, onClose, stats, profile,
  activeDaysCount, exerciseDays, daysOnTarget,
  targetCalories, tdee, dateRange, selectedDate,
}: WeeklyStatsModalProps) {
  // 时光机只展示近 7 天数据
  const recentStats = useMemo(() => stats.slice(-7), [stats]);

  const trendItems = getTrendItems(recentStats);
  const suggestions = getSuggestions(recentStats, profile, targetCalories);

  // 近 7 天有效记录
  const activeDays = recentStats.filter(d => d.intake > 0);
  const avgIntake = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.intake, 0) / activeDays.length)
    : 0;
  const waterDays = recentStats.filter(d => d.water >= 1500).length;

  // ─── 日期导航状态 ───
  const [activeDate, setActiveDate] = useState<string>(
    selectedDate || (activeDays.length > 0 ? activeDays[activeDays.length - 1].date : '')
  );
  const dateNavRef = useRef<HTMLDivElement>(null);

  // 当 selectedDate 变化时同步
  useEffect(() => {
    if (selectedDate) {
      setActiveDate(selectedDate);
    }
  }, [selectedDate]);

  // 近 7 天统计指标
  const recentActiveDaysCount = activeDays.length;
  const recentExerciseDays = recentStats.filter(d => d.burn > 0).length;
  const recentDaysOnTarget = recentStats.filter(d => d.intake > 0 && d.intake <= targetCalories).length;

  // 当前选中日期的数据（从近 7 天中查找）
  const activeDayData = useMemo(() => {
    return recentStats.find(d => d.date === activeDate) || null;
  }, [recentStats, activeDate]);

  // 动态标题：基于选中日期的状态（使用近 7 天指标）
  const dynamicHeadline = useMemo(() => {
    if (!activeDayData || activeDayData.intake === 0) {
      return getHeadline(profile?.name || '你', recentActiveDaysCount, recentDaysOnTarget, recentExerciseDays);
    }
    const state = classifyDay(activeDayData, targetCalories);
    const cfg = STATE_CONFIGS[state];
    const name = profile?.name || '你';
    return `${cfg.emoji} ${name}，${cfg.title}`;
  }, [activeDayData, profile, recentActiveDaysCount, recentDaysOnTarget, recentExerciseDays, targetCalories]);

  const dynamicSubline = useMemo(() => {
    if (!activeDayData || activeDayData.intake === 0) {
      return getSubline(recentActiveDaysCount, recentExerciseDays);
    }
    const state = classifyDay(activeDayData, targetCalories);
    const cfg = STATE_CONFIGS[state];
    const dateObj = new Date(activeDayData.date + 'T00:00:00');
    const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    return `${dateStr} · ${cfg.tone}`;
  }, [activeDayData, targetCalories, recentActiveDaysCount, recentExerciseDays]);

  // 滚动日期导航到选中项
  useEffect(() => {
    if (dateNavRef.current && activeDate) {
      const activeBtn = dateNavRef.current.querySelector(`[data-date="${activeDate}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeDate]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const name = profile?.name || '你';

  // 单日指标 vs 近 7 天汇总指标
  const metrics = activeDayData && activeDayData.intake > 0
    ? [
        { label: '摄入', value: `${activeDayData.intake}`, icon: Flame, color: '#F97316' },
        { label: '消耗', value: `${activeDayData.burn}`, icon: Dumbbell, color: '#22C55E' },
        { label: '饮水', value: `${activeDayData.water}`, icon: Droplets, color: '#0EA5E9' },
        { label: '蛋白', value: `${activeDayData.protein}`, icon: Gauge, color: '#8B5CF6' },
      ]
    : [
        { label: '记录', value: recentActiveDaysCount, icon: Calendar, color: '#8B5CF6' },
        { label: '达标', value: recentDaysOnTarget, icon: Flame, color: '#F97316' },
        { label: '运动', value: recentExerciseDays, icon: Dumbbell, color: '#22C55E' },
        { label: '均摄入', value: `${avgIntake}`, icon: Gauge, color: '#6366F1' },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-md"
        style={{ animation: 'fadeIn 0.25s ease' }} onClick={onClose} />

      <div className="relative w-full sm:max-w-lg sm:mx-4"
        style={{ animation: 'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '94vh' }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.28)', backdropFilter: 'blur(8px)' }}>
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="w-full sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden"
          style={{
            maxHeight: '94vh',
            background: 'var(--ck-modal-bg)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}>
          {/* ─── 头部 ─── */}
          <div className="flex-shrink-0 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9E8 55%, #C084FC 100%)', padding: '24px 20px 44px' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.22) 0%, transparent 55%)' }} />
            <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 65%)' }} />

            <div className="relative pr-10">
              <p className="text-white/65 text-[11px] font-medium tracking-widest uppercase mb-2">近 7 天 · 时光机</p>
              <h2 className="text-white text-xl font-bold leading-snug mb-1"
                style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>{dynamicHeadline}</h2>
              <p className="text-white/75 text-sm">{dynamicSubline}</p>
            </div>
          </div>

          {/* ─── 指标卡 ─── */}
          <div className="flex-shrink-0 px-4 -mt-6 relative z-10">
            <div className="rounded-2xl grid grid-cols-4 gap-1 p-3"
              style={{ background: 'var(--ck-modal-card)', backdropFilter: 'blur(16px)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
              {metrics.map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="flex flex-col items-center gap-1 py-1">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${m.color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                    </div>
                    <p className="text-sm font-bold text-foreground leading-none">{m.value}</p>
                    <p className="text-[9px] text-muted-foreground">{m.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── 日期导航条 ─── */}
          {activeDays.length > 1 && (
            <div className="flex-shrink-0 px-4 pt-3 pb-2 relative z-10">
              <div
                ref={dateNavRef}
                className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {activeDays.map(d => {
                  const isActive = d.date === activeDate;
                  const dateObj = new Date(d.date + 'T00:00:00');
                  const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                  return (
                    <button
                      key={d.date}
                      data-date={d.date}
                      onClick={() => setActiveDate(d.date)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── 滚动内容：近 7 天可视化 ─── */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-3">
            <AIHealingCard
              stats={recentStats} profile={profile}
              activeDaysCount={recentActiveDaysCount} waterDays={waterDays}
              exerciseDays={recentExerciseDays} daysOnTarget={recentDaysOnTarget}
              targetCalories={targetCalories} selectedDate={activeDate}
            />

            {/* 三大宏量近 7 天趋势 */}
            <MacroLineChart stats={recentStats} target={targetCalories} />

            {/* 热量近 7 天趋势 */}
            <ChartCard icon={Flame} title="近 7 天热量趋势" iconColor="#F97316" kind="orange">
              <CalorieTrendChart stats={recentStats} target={targetCalories} />
            </ChartCard>

            {/* 宏量流向 全宽 */}
            <MacroSankey stats={recentStats} profile={profile} selectedDate={activeDate} />

            {/* 近 7 天用餐热力图 */}
            <MealHeatmap stats={recentStats} />

            {/* K线图 */}
            <DailyKLineChart stats={recentStats} targetCalories={targetCalories} />

            {/* 近 7 天趋势对比 */}
            {trendItems.length > 0 && (
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
                    <TrendingUp className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm font-bold text-foreground">近 7 天趋势对比</p>
                  <span className="text-[10px] text-muted-foreground ml-auto">前半段 vs 后半段</span>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  {trendItems.map(item => {
                    const diff = item.late - item.early;
                    const improved = item.higherIsBetter ? diff > 0 : diff < 0;
                    const neutral = Math.abs(diff) < (item.unit === 'kcal' ? 50 : 5);
                    const TrendIcon = neutral ? Minus : improved ? TrendingUp : TrendingDown;
                    const color = neutral ? '#9CA3AF' : improved ? '#22C55E' : '#EF4444';
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <div className="flex items-center gap-1">
                            <TrendIcon className="w-3 h-3" style={{ color }} />
                            <span className="text-[11px] font-semibold" style={{ color }}>
                              {neutral ? '持平' : `${diff > 0 ? '+' : ''}${diff} ${item.unit}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="bg-muted/60 rounded px-1.5 py-0.5">前：{item.early} {item.unit}</span>
                          <span>→</span>
                          <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${color}15`, color }}>
                            后：{item.late} {item.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 个性化建议 */}
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #F97316)' }}>
                  <Lightbulb className="w-3 h-3 text-white" />
                </div>
                <p className="text-sm font-bold text-foreground">个性化建议</p>
              </div>
              <div className="px-4 pb-4 space-y-2.5">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl"
                    style={{ backgroundColor: `${s.color}0D`, borderLeft: `3px solid ${s.color}` }}>
                    <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${s.color}20`, color: s.color }}>{i + 1}</span>
                    <p className="text-xs text-foreground leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
