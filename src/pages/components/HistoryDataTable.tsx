import { useState } from 'react';
import { Calendar, Flame, Droplets, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import type { DayStats } from './AIHealingCard';

interface HistoryDataTableProps {
  stats: DayStats[];
  targetCalories: number;
}

function formatDate(date: string) {
  const d = new Date(date + 'T00:00:00');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekDay: weekDays[d.getDay()],
  };
}

function CalorieBar({ intake, target, isOver }: { intake: number; target: number; isOver: boolean }) {
  const pct = Math.min((intake / (target || 2000)) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold tabular-nums" style={{ color: isOver ? '#EF4444' : '#111827' }}>
          {intake.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">/ {target}</span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: isOver
              ? 'linear-gradient(90deg, #FCA5A5, #EF4444)'
              : 'linear-gradient(90deg, #A3B899, #7CB9A8)',
            transition: 'width 0.5s ease',
          }}
        />
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{ left: '76.9%', background: 'rgba(0,0,0,0.14)' }}
        />
      </div>
    </div>
  );
}

interface MacroBarProps {
  label: string;
  value: number;
  maxVal: number;
  color: string;
  unit?: string;
}

function MacroBar({ label, value, maxVal, color, unit = 'g' }: MacroBarProps) {
  return (
    <div className="rounded-xl px-3 py-2.5 border" style={{ borderColor: `${color}22`, backgroundColor: `${color}07` }}>
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>
        {value}
        <span className="text-[10px] font-normal ml-0.5">{unit}</span>
      </p>
      <div className="h-1 rounded-full mt-1.5" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min((value / maxVal) * 100, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function HistoryDataTable({ stats, targetCalories }: HistoryDataTableProps) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) return null;

  const target = targetCalories || 2000;

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50" style={{ background: '#fff' }}>
      <div
        className="px-5 py-4 border-b border-border/40 flex items-center gap-3"
        style={{ background: 'linear-gradient(to right, rgba(163,184,153,0.08), rgba(124,185,168,0.04))' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9A8)' }}
        >
          <Calendar className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">全程档案</p>
          <p className="text-[10px] text-muted-foreground">{sorted.length} 天有效记录 · 点击行展开详情</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 hidden sm:flex">
          <span className="flex items-center gap-1"><Flame className="w-3 h-3" />热量</span>
          <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />饮水</span>
          <span className="flex items-center gap-1"><Dumbbell className="w-3 h-3" />运动</span>
        </div>
      </div>

      <div
        className="hidden sm:grid border-b border-border/30 px-5 py-2"
        style={{ gridTemplateColumns: '72px 1fr 72px 80px 68px 28px', gap: '12px', background: 'rgba(0,0,0,0.015)' }}
      >
        {['日期', '热量摄入 / 目标', '饮水', '运动消耗', '体重', ''].map(h => (
          <span key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-border/25">
        {sorted.map(day => {
          const date = formatDate(day.date);
          const isExpanded = expandedDate === day.date;
          const isHovered = hoveredDate === day.date;
          const isOver = day.intake > target;

          return (
            <div
              key={day.date}
              className="transition-colors"
              style={{
                backgroundColor: isExpanded
                  ? 'rgba(163,184,153,0.05)'
                  : isHovered
                  ? 'rgba(0,0,0,0.012)'
                  : 'transparent',
              }}
              onMouseEnter={() => setHoveredDate(day.date)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <div
                className="px-5 py-3.5 flex sm:grid items-center gap-3 cursor-pointer"
                style={{ gridTemplateColumns: '72px 1fr 72px 80px 68px 28px' }}
                onClick={() => setExpandedDate(isExpanded ? null : day.date)}
              >
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isExpanded
                        ? 'linear-gradient(135deg, #A3B899, #7CB9A8)'
                        : 'rgba(0,0,0,0.04)',
                    }}
                  >
                    <span
                      className="text-[9px] leading-none"
                      style={{ color: isExpanded ? 'rgba(255,255,255,0.75)' : '#9CA3AF' }}
                    >
                      {date.month}月
                    </span>
                    <span
                      className="text-sm font-black leading-none mt-0.5"
                      style={{ color: isExpanded ? '#fff' : '#111827' }}
                    >
                      {date.day}
                    </span>
                    <span
                      className="text-[9px] leading-none mt-0.5"
                      style={{ color: isExpanded ? 'rgba(255,255,255,0.6)' : '#D1D5DB' }}
                    >
                      周{date.weekDay}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <CalorieBar intake={day.intake} target={target} isOver={isOver} />
                </div>

                <div className="text-center flex-shrink-0">
                  {day.water > 0 ? (
                    <div>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: '#0EA5E9' }}>
                        {day.water >= 1000 ? `${(day.water / 1000).toFixed(1)}L` : `${day.water}ml`}
                      </p>
                      <div
                        className="h-1 rounded-full mt-1"
                        style={{
                          background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
                          width: `${Math.min((day.water / 2000) * 100, 100)}%`,
                          minWidth: '20%',
                          margin: '4px auto 0',
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/35">--</span>
                  )}
                </div>

                <div className="text-center flex-shrink-0">
                  {day.burn > 0 ? (
                    <div>
                      <p className="text-xs font-semibold tabular-nums" style={{ color: '#22C55E' }}>
                        -{day.burn}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50">kcal</p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/35">--</span>
                  )}
                </div>

                <div className="text-center flex-shrink-0">
                  {day.weight ? (
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#8B5CF6' }}>
                        {day.weight}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50">kg</p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/35">--</span>
                  )}
                </div>

                <div
                  className="flex items-center justify-center flex-shrink-0 transition-opacity"
                  style={{ opacity: isHovered || isExpanded ? 1 : 0.3 }}
                >
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-4" style={{ animation: 'tableRowIn 0.2s ease' }}>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <MacroBar label="蛋白质" value={day.protein} maxVal={150} color="#F97316" />
                    <MacroBar label="碳水化合物" value={day.carbs} maxVal={300} color="#EAB308" />
                    <MacroBar label="脂肪" value={day.fat} maxVal={80} color="#EC4899" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div
                      className="rounded-xl px-3 py-2 flex items-center justify-between"
                      style={{ background: 'rgba(0,0,0,0.03)' }}
                    >
                      <span className="text-[10px] text-muted-foreground">净摄入</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: day.net > target ? '#EF4444' : '#22C55E' }}
                      >
                        {day.net > 0 ? '+' : ''}{day.net} kcal
                      </span>
                    </div>
                    {day.sodium > 0 && (
                      <div
                        className="rounded-xl px-3 py-2 flex items-center justify-between"
                        style={{ background: 'rgba(0,0,0,0.03)' }}
                      >
                        <span className="text-[10px] text-muted-foreground">钠摄入</span>
                        <span
                          className="text-xs font-bold"
                          style={{ color: day.sodium > 2300 ? '#F59E0B' : '#6B7280' }}
                        >
                          {day.sodium} mg
                          {day.sodium > 2300 && (
                            <span className="text-[9px] ml-1" style={{ color: '#F59E0B' }}>偏高</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {day.exercises.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">运动详情</p>
                      <div className="space-y-1">
                        {day.exercises.map((ex, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-1.5 px-3 rounded-xl text-xs"
                            style={{ background: '#22C55E0A', border: '1px solid #22C55E18' }}
                          >
                            <span className="text-foreground">{ex.name}</span>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {ex.duration > 0 && <span>{ex.duration} 分钟</span>}
                              <span className="font-semibold" style={{ color: '#22C55E' }}>
                                -{ex.calories} kcal
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes tableRowIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
