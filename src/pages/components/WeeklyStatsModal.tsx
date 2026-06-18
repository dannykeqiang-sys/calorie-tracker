import { useEffect, useState, useRef } from 'react';
import { X, Calendar, Flame, Droplets, Dumbbell, TrendingUp, TrendingDown, Minus, Lightbulb, Gauge, Radar, Scale } from 'lucide-react';
import type { UserProfile } from '../../types';
import AIHealingCard, { type DayStats } from './AIHealingCard';
import {
  CalorieTrendChart,
  MacroLineChart,
  CalorieGauge,
  NutritionRadar,
  MacroSankey,
  MealHeatmap,
  ChartCard,
} from './WeeklyCharts';

interface WeeklyStatsModalProps {
  open: boolean;
  onClose: () => void;
  stats: DayStats[];
  profile: UserProfile | null;
  activeDaysCount: number;
  waterDays: number;
  exerciseDays: number;
  daysOnTarget: number;
  targetCalories: number;
  tdee: number;
  baseWeight: number;
  dateRange?: string;
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

function getSubline(activeDays: number, exerciseDays: number, waterDays: number): string {
  const parts: string[] = [];
  if (activeDays > 0) parts.push(`记录了 ${activeDays} 天`);
  if (exerciseDays > 0) parts.push(`运动了 ${exerciseDays} 天`);
  if (waterDays > 0) parts.push(`${waterDays} 天认真补水`);
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

/* ─── 全周期体重饮水趋势 ─── */
function FullWeightWaterChart({ stats, baseWeight }: { stats: DayStats[]; baseWeight: number }) {
  const weightData = stats.filter(d => d.weight != null && d.weight > 0);
  const waterData = stats.filter(d => d.water > 0);
  const hasAny = weightData.length > 0 || waterData.length > 0;
  if (!hasAny) return null;

  const w = Math.max(300, stats.length * 48);
  const H = 130, BAR = 100;
  const allVals = [...weightData.map(d => d.weight!), ...waterData.map(d => d.water)];
  const maxW = Math.max(...allVals, 50);
  const minWeight = weightData.length > 0 ? Math.min(...weightData.map(d => d.weight!)) : 0;

  function px(i: number) { return i * 44 + 22; }

  const [hover, setHover] = useState<number | null>(null);

  // 贝塞尔平滑
  function smoothPath(data: { i: number; val: number; norm: number }[]): string {
    if (data.length < 2) return '';
    const tension = 0.3;
    let d = `M${px(data[0].i)},${BAR - data[0].norm * BAR}`;
    for (let j = 0; j < data.length - 1; j++) {
      const p0 = data[j], p1 = data[j + 1];
      const cp1x = px(p0.i) + (px(p1.i) - px(p0.i)) * tension;
      const cp1y = BAR - p0.norm * BAR;
      const cp2x = px(p1.i) - (px(p1.i) - px(p0.i)) * tension;
      const cp2y = BAR - p1.norm * BAR;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${px(p1.i)},${BAR - p1.norm * BAR}`;
    }
    return d;
  }

  const weightPts = weightData.map((d, idx) => ({ i: idx, val: d.weight!, norm: (d.weight! - (minWeight - 0.5)) / Math.max(maxW - minWeight + 1, 1) }));
  const waterPts = waterData.map((d, idx) => ({ i: stats.indexOf(d), val: d.water, norm: d.water / maxW }));

  return (
    <ChartCard icon={Scale} title="体重 & 饮水全周期" iconColor="#0EA5E9"
      bg="linear-gradient(135deg, rgba(245,248,255,0.65), rgba(240,245,255,0.5))">
      <div className="relative overflow-x-auto no-scrollbar">
        <svg width={w} viewBox={`0 0 ${w} ${H}`} style={{ height: 130, minWidth: w, overflow: 'visible' }}>
          <defs>
            <linearGradient id="fwArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.12" /><stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="wwArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A3B899" stopOpacity="0.15" /><stop offset="100%" stopColor="#A3B899" stopOpacity="0.0" />
            </linearGradient>
            <filter id="fwGlow"><feGaussianBlur stdDeviation="1.5" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* 基线 */}
          {[0, 0.5].map(p => (
            <line key={p} x1={0} y1={BAR * (1 - p)} x2={w} y2={BAR * (1 - p)} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 3" />
          ))}
          {baseWeight > 0 && <line x1={0} y1={BAR - (baseWeight / maxW) * BAR} x2={w} y2={BAR - (baseWeight / maxW) * BAR}
            stroke="#A3B899" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />}

          {/* 饮水面积 + 线 */}
          {waterPts.length > 1 && (
            <>
              <polygon points={`${px(waterPts[0].i)},${BAR} ${waterPts.map(p => `${px(p.i)},${BAR - p.norm * BAR}`).join(' ')} ${px(waterPts[waterPts.length - 1].i)},${BAR}`}
                fill="url(#fwArea)" />
              <path d={smoothPath(waterPts)} fill="none" stroke="#0EA5E9" strokeWidth={2} opacity={0.7} />
            </>
          )}

          {/* 体重面积 + 线 */}
          {weightPts.length > 1 && (
            <>
              <polygon points={`${px(weightPts[0].i)},${BAR} ${weightPts.map(p => `${px(p.i)},${BAR - p.norm * BAR}`).join(' ')} ${px(weightPts[weightPts.length - 1].i)},${BAR}`}
                fill="url(#wwArea)" />
              <path d={smoothPath(weightPts)} fill="none" stroke="#A3B899" strokeWidth={2.5} filter="url(#fwGlow)" />
            </>
          )}

          {/* 体重数据点 */}
          {weightPts.map((p, i) => {
            const isH = hover === i;
            return (
              <g key={`w${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                <circle cx={px(p.i)} cy={BAR - p.norm * BAR} r={isH ? 5 : 3} fill="white"
                  stroke="#A3B899" strokeWidth={isH ? 2.5 : 1.5} filter={isH ? 'url(#fwGlow)' : undefined}
                  style={{ transition: 'all 0.2s' }} />
                {isH && (
                  <>
                    <rect x={px(p.i) - 24} y={BAR - p.norm * BAR - 22} width={48} height={16} rx={5} fill="var(--ck-chart-tooltip-bg)" opacity={0.9} />
                    <text x={px(p.i)} y={BAR - p.norm * BAR - 9} textAnchor="middle" fontSize={8} fill="var(--ck-chart-tooltip-fg)" fontWeight="800">
                      {p.val.toFixed(1)} kg
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* 标签 */}
          {stats.map((d, i) => (
            <text key={`l${i}`} x={px(i)} y={H - 4} textAnchor="middle" fontSize={7} fill="var(--ck-chart-label)">{d.label}</text>
          ))}
        </svg>
      </div>
      <div className="flex items-center gap-3 mt-1 flex-wrap opacity-60">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ background: '#A3B899' }} />体重
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ background: '#0EA5E9' }} />饮水
        </span>
      </div>
    </ChartCard>
  );
}

export default function WeeklyStatsModal({
  open, onClose, stats, profile,
  activeDaysCount, waterDays, exerciseDays, daysOnTarget,
  targetCalories, tdee, baseWeight, dateRange,
}: WeeklyStatsModalProps) {
  const trendItems = getTrendItems(stats);
  const suggestions = getSuggestions(stats, profile, targetCalories);

  // 计算全周期平均摄入用于仪表盘
  const activeDays = stats.filter(d => d.intake > 0);
  const avgIntake = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.intake, 0) / activeDays.length)
    : 0;

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const name = profile?.name || '你';
  const headline = getHeadline(name, activeDaysCount, daysOnTarget, exerciseDays);
  const subline = getSubline(activeDaysCount, exerciseDays, waterDays);

  const metrics = [
    { label: '记录', value: activeDaysCount, icon: Calendar, color: '#8B5CF6' },
    { label: '达标', value: daysOnTarget, icon: Flame, color: '#F97316' },
    { label: '运动', value: exerciseDays, icon: Dumbbell, color: '#22C55E' },
    { label: '补水', value: waterDays, icon: Droplets, color: '#0EA5E9' },
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
              <p className="text-white/65 text-[11px] font-medium tracking-widest uppercase mb-2">{dateRange || '全程档案'}</p>
              <h2 className="text-white text-xl font-bold leading-snug mb-1"
                style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>{headline}</h2>
              <p className="text-white/75 text-sm">{subline}</p>
            </div>
          </div>

          {/* ─── 指标卡 ─── */}
          <div className="flex-shrink-0 px-4 -mt-6 relative z-10">
            <div className="rounded-2xl grid grid-cols-5 gap-1 p-3"
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

          {/* ─── 滚动内容：全周期可视化 ─── */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-3">
            <AIHealingCard
              stats={stats} profile={profile}
              activeDaysCount={activeDaysCount} waterDays={waterDays}
              exerciseDays={exerciseDays} daysOnTarget={daysOnTarget}
            />

            {/* Gauge + Radar */}
            <div className="grid grid-cols-2 gap-3">
              <CalorieGauge stats={stats} target={targetCalories} />
              <NutritionRadar stats={stats} target={targetCalories} />
            </div>

            {/* 三大宏量全周期趋势 */}
            <MacroLineChart stats={stats} target={targetCalories} />

            {/* 热量全周期趋势 */}
            <ChartCard icon={Flame} title="全周期热量趋势" iconColor="#F97316"
              bg="linear-gradient(135deg, rgba(255,248,240,0.65), rgba(255,242,235,0.5))">
              <CalorieTrendChart stats={stats} target={targetCalories} />
            </ChartCard>

            {/* 体重饮水 + 宏量流向 */}
            <div className="grid grid-cols-2 gap-3">
              <MacroSankey stats={stats} />
            </div>

            {/* 全周期用餐热力图 */}
            <MealHeatmap stats={stats} maxDays={0} />

            {/* 体重饮水全周期 */}
            <FullWeightWaterChart stats={stats} baseWeight={baseWeight} />

            {/* 全程趋势对比 */}
            {trendItems.length > 0 && (
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
                    <TrendingUp className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm font-bold text-foreground">全程趋势对比</p>
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
