import { useEffect, useState, useMemo, useRef } from 'react';
import { X, Calendar, Flame, Dumbbell, TrendingUp, TrendingDown, Minus, Lightbulb, Gauge, Droplets, ChevronDown, ChevronUp, Utensils, Apple, Moon, Cookie, List } from 'lucide-react';
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
  // ─── 视图模式：byDay（单日查看）或 7day（近7天趋势）───
  const [viewMode, setViewMode] = useState<'byDay' | '7day'>(
    selectedDate ? 'byDay' : '7day'
  );

  // 近 7 天数据（始终用于趋势图表）
  const recent7Days = useMemo(() => stats.slice(-7), [stats]);
  const recent7Active = recent7Days.filter(d => d.intake > 0);

  const trendItems = getTrendItems(recent7Days);
  const suggestions = getSuggestions(recent7Days, profile, targetCalories);

  const avgIntake = recent7Active.length > 0
    ? Math.round(recent7Active.reduce((s, d) => s + d.intake, 0) / recent7Active.length)
    : 0;
  const waterDays = recent7Days.filter(d => d.water >= 1500).length;

  // ─── 日期导航状态 ───
  // 所有有数据的天数（用于日期导航条，展示全部历史）
  const allActiveDays = useMemo(() => stats.filter(d => d.intake > 0), [stats]);

  const [activeDate, setActiveDate] = useState<string>(
    selectedDate || (allActiveDays.length > 0 ? allActiveDays[allActiveDays.length - 1].date : '')
  );
  const [detailExpanded, setDetailExpanded] = useState(false);
  const dateNavRef = useRef<HTMLDivElement>(null);

  // 当 selectedDate 变化时同步
  useEffect(() => {
    if (selectedDate) {
      setActiveDate(selectedDate);
      setViewMode('byDay');
    } else {
      setViewMode('7day');
    }
  }, [selectedDate]);

  // 全部历史统计指标（用于标题等）
  const recentActiveDaysCount = allActiveDays.length;
  const recentExerciseDays = stats.filter(d => d.burn > 0).length;
  const recentDaysOnTarget = stats.filter(d => d.intake > 0 && d.intake <= targetCalories).length;

  // 当前选中日期的数据（从全部历史中查找）
  const activeDayData = useMemo(() => {
    return stats.find(d => d.date === activeDate) || null;
  }, [stats, activeDate]);

  // 图表周期标签
  const chartPeriodLabel = '近 7 天';

  // 动态标题：基于选中日期的状态
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
              <p className="text-white/65 text-[11px] font-medium tracking-widest uppercase mb-2">
                {viewMode === 'byDay' ? '单日详情 · 时光机' : '近 7 天 · 时光机'}
              </p>
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

          {/* ─── 日期导航条（展示全部历史）─── */}
          {allActiveDays.length > 1 && (
            <div className="flex-shrink-0 px-4 pt-3 pb-2 relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground font-medium">
                  全部 {allActiveDays.length} 天记录
                </span>
                <button
                  onClick={() => setViewMode(viewMode === 'byDay' ? '7day' : 'byDay')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer"
                  style={{
                    background: viewMode === 'byDay' ? 'rgba(139,92,246,0.12)' : 'rgba(99,102,241,0.12)',
                    color: viewMode === 'byDay' ? '#8B5CF6' : '#6366F1',
                  }}
                >
                  <List className="w-3 h-3" />
                  {viewMode === 'byDay' ? '切换到7天趋势' : '切换到单日查看'}
                </button>
              </div>
              <div
                ref={dateNavRef}
                className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {allActiveDays.map(d => {
                  const isActive = d.date === activeDate;
                  const dateObj = new Date(d.date + 'T00:00:00');
                  const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                  return (
                    <button
                      key={d.date}
                      data-date={d.date}
                      onClick={() => {
                        setActiveDate(d.date);
                        setViewMode('byDay');
                      }}
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

          {/* ─── 滚动内容：可视化 ─── */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-3">

            {/* ─── 当日详情（可折叠，仅 byDay 模式显示）─── */}
            {viewMode === 'byDay' && activeDayData && activeDayData.intake > 0 && (
              <div className="rounded-2xl border border-border overflow-hidden"
                style={{ background: 'var(--ck-modal-card)', backdropFilter: 'blur(12px)' }}>
                <button
                  onClick={() => setDetailExpanded(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                      <Calendar className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-bold text-foreground">当日详情</span>
                    <span className="text-[10px] text-muted-foreground">
                      {(() => { const d = new Date(activeDayData.date + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}`; })()}
                    </span>
                  </div>
                  {detailExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground transition-transform" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />}
                </button>

                {detailExpanded && (
                  <div className="px-4 pb-4 space-y-3" style={{ animation: 'fadeIn 0.2s ease' }}>
                    {/* 四餐明细 */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">用餐明细</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: '早餐', cal: activeDayData.mealCals?.[0] ?? 0, icon: Apple, color: '#fbbf24' },
                          { label: '午餐', cal: activeDayData.mealCals?.[1] ?? 0, icon: Utensils, color: '#f97316' },
                          { label: '晚餐', cal: activeDayData.mealCals?.[2] ?? 0, icon: Moon, color: '#ef4444' },
                          { label: '加餐', cal: activeDayData.mealCals?.[3] ?? 0, icon: Cookie, color: '#a78bfa' },
                        ].map(meal => {
                          const MealIcon = meal.icon;
                          return (
                            <div key={meal.label} className="flex items-center gap-2 p-2 rounded-xl"
                              style={{ backgroundColor: `${meal.color}10` }}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${meal.color}20` }}>
                                <MealIcon className="w-3.5 h-3.5" style={{ color: meal.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground">{meal.label}</p>
                                <p className="text-xs font-bold text-foreground">{meal.cal} <span className="text-[9px] font-normal text-muted-foreground">kcal</span></p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 宏量营养素 */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">宏量营养素</p>
                      <div className="space-y-2">
                        {(() => {
                          const macroT = { protein: Math.round(targetCalories * 0.25 / 4), carbs: Math.round(targetCalories * 0.5 / 4), fat: Math.round(targetCalories * 0.25 / 9) };
                          const macroList = [
                            { label: '蛋白质', value: activeDayData.protein, target: macroT.protein, unit: 'g', color: '#fb923c' },
                            { label: '碳水', value: activeDayData.carbs, target: macroT.carbs, unit: 'g', color: '#818cf8' },
                            { label: '脂肪', value: activeDayData.fat, target: macroT.fat, unit: 'g', color: '#38bdf8' },
                          ];
                          return macroList.map(m => {
                            const pct = m.target > 0 ? Math.round((m.value / m.target) * 100) : 0;
                            const barPct = Math.min(pct, 150);
                            return (
                              <div key={m.label}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] text-muted-foreground">{m.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-foreground">{m.value}{m.unit}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                      style={{
                                        backgroundColor: pct >= 95 && pct <= 110 ? '#22c55e20' : pct > 110 ? '#ef444420' : '#f59e0b20',
                                        color: pct >= 95 && pct <= 110 ? '#22c55e' : pct > 110 ? '#ef4444' : '#f59e0b'
                                      }}>
                                      {pct}%
                                    </span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${m.color}15` }}>
                                  <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${(barPct / 150) * 100}%`, backgroundColor: m.color }} />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* 运动记录 */}
                    {activeDayData.exercises && activeDayData.exercises.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">运动记录</p>
                        <div className="space-y-1.5">
                          {activeDayData.exercises.map((ex, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg"
                              style={{ backgroundColor: 'rgba(34,197,94,0.06)' }}>
                              <div className="flex items-center gap-2">
                                <Dumbbell className="w-3.5 h-3.5" style={{ color: '#22C55E' }} />
                                <span className="text-xs text-foreground">{ex.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>{ex.duration}min</span>
                                <span className="font-semibold" style={{ color: '#22C55E' }}>{ex.calories} kcal</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 饮水 + 膳食纤维 + 钠 */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">其他指标</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-xl text-center" style={{ backgroundColor: 'rgba(14,165,233,0.08)' }}>
                          <Droplets className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: '#0EA5E9' }} />
                          <p className="text-xs font-bold text-foreground">{activeDayData.water}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">ml</span></p>
                          <p className="text-[9px] text-muted-foreground">饮水</p>
                        </div>
                        <div className="p-2 rounded-xl text-center" style={{ backgroundColor: 'rgba(34,197,94,0.08)' }}>
                          <p className="text-sm font-bold text-foreground leading-none mt-1">{activeDayData.fiber}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">g</span></p>
                          <p className="text-[9px] text-muted-foreground">膳食纤维</p>
                        </div>
                        <div className="p-2 rounded-xl text-center" style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
                          <p className="text-sm font-bold text-foreground leading-none mt-1">{activeDayData.sodium}<span className="text-[9px] font-normal text-muted-foreground ml-0.5">mg</span></p>
                          <p className="text-[9px] text-muted-foreground">钠</p>
                        </div>
                      </div>
                    </div>

                    {/* 体重（如果有） */}
                    {activeDayData.weight != null && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl"
                        style={{ backgroundColor: 'rgba(139,92,246,0.08)' }}>
                        <span className="text-xs text-muted-foreground">当日体重</span>
                        <span className="text-sm font-bold" style={{ color: '#8B5CF6' }}>{activeDayData.weight} <span className="text-[10px] font-normal">kg</span></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <AIHealingCard
              stats={recent7Days} profile={profile}
              activeDaysCount={recentActiveDaysCount} waterDays={waterDays}
              exerciseDays={recentExerciseDays} daysOnTarget={recentDaysOnTarget}
              targetCalories={targetCalories} selectedDate={activeDate}
            />

            {/* 三大宏量趋势 */}
            <MacroLineChart stats={recent7Days} target={targetCalories} onDateClick={setActiveDate} activeDate={activeDate} />

            {/* 热量趋势 */}
            <ChartCard icon={Flame} title={`${chartPeriodLabel}热量趋势`} iconColor="#F97316" kind="orange">
              <CalorieTrendChart stats={recent7Days} target={targetCalories} onDateClick={setActiveDate} activeDate={activeDate} />
            </ChartCard>

            {/* 宏量流向 */}
            <MacroSankey stats={recent7Days} profile={profile} selectedDate={activeDate} onDateChange={setActiveDate} />

            {/* 用餐热力图 */}
            <MealHeatmap stats={recent7Days} onDateClick={setActiveDate} activeDate={activeDate} />

            {/* K线图 */}
            <DailyKLineChart stats={recent7Days} targetCalories={targetCalories} onDateClick={setActiveDate} activeDate={activeDate} />

            {/* 趋势对比（仅 7day 模式） */}
            {viewMode === '7day' && trendItems.length > 0 && (
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
