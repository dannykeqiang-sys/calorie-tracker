import { useState } from 'react';
import { Dumbbell, Flame, Trophy, Clock } from 'lucide-react';
import type { DayStats } from './AIHealingCard';

interface ActivityBurnCardProps {
  stats: DayStats[];
}

const today = new Date().toISOString().split('T')[0];

export default function ActivityBurnCard({ stats }: ActivityBurnCardProps) {
  const defaultDate = stats.find(d => d.date === today)?.date ?? stats[stats.length - 1]?.date ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultDate);

  const maxBurn = Math.max(...stats.map(d => d.burn), 1);
  const totalBurn = stats.reduce((s, d) => s + d.burn, 0);
  const activeDays = stats.filter(d => d.burn > 0);
  const bestDay = activeDays.length > 0
    ? activeDays.reduce((best, d) => d.burn > best.burn ? d : best, activeDays[0])
    : null;
  const avgBurn = activeDays.length > 0 ? Math.round(totalBurn / activeDays.length) : 0;

  const selectedDay = stats.find(d => d.date === selectedDate) ?? null;

  if (stats.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
          >
            <Dumbbell className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-sm font-bold text-foreground flex-1">本周运动消耗</p>
          {totalBurn > 0 && (
            <span
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{ color: '#16A34A', backgroundColor: 'rgba(34,197,94,0.1)' }}
            >
              共 {totalBurn} kcal
            </span>
          )}
        </div>

        {/* 柱状图 */}
        <div className="flex items-end gap-1.5 h-20">
          {stats.map(day => {
            const pct = maxBurn > 0 ? (day.burn / maxBurn) : 0;
            const barH = Math.max(pct * 64, day.burn > 0 ? 6 : 0);
            const isSelected = day.date === selectedDate;
            const isToday = day.date === today;

            return (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                style={{ outline: 'none' }}
              >
                {day.burn > 0 && (
                  <span
                    className="text-[9px] tabular-nums font-semibold transition-opacity"
                    style={{ color: isSelected ? '#16A34A' : '#9CA3AF', opacity: isSelected ? 1 : 0.7 }}
                  >
                    {day.burn}
                  </span>
                )}
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full rounded-t-md transition-all duration-300"
                    style={{
                      height: `${barH}px`,
                      minHeight: day.burn > 0 ? '6px' : '0px',
                      background: day.burn === 0
                        ? 'rgba(0,0,0,0.06)'
                        : isSelected
                          ? 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)'
                          : 'linear-gradient(180deg, rgba(34,197,94,0.5) 0%, rgba(22,163,74,0.4) 100%)',
                      boxShadow: isSelected && day.burn > 0 ? '0 2px 8px rgba(34,197,94,0.35)' : 'none',
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium leading-none"
                  style={{
                    color: isToday ? '#16A34A' : isSelected ? 'var(--foreground)' : '#9CA3AF',
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {day.label}
                </span>
                {isSelected && (
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#16A34A' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 选中日运动明细 */}
      {selectedDay && (
        <div className="mx-4 border-t border-border/50" />
      )}
      {selectedDay && (
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-foreground mb-2">
            {selectedDay.date === today ? '今日' : (() => {
              const d = new Date(selectedDay.date + 'T00:00:00');
              return `${d.getMonth() + 1}月${d.getDate()}日`;
            })()}运动明细
          </p>
          {selectedDay.exercises.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 py-1">无运动记录</p>
          ) : (
            <div className="space-y-1.5">
              {selectedDay.exercises.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}
                  >
                    <Dumbbell className="w-2.5 h-2.5" style={{ color: '#16A34A' }} />
                  </div>
                  <span className="text-[11px] text-foreground flex-1 truncate">{ex.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ex.duration > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="w-2.5 h-2.5" />
                        {ex.duration}min
                      </span>
                    )}
                    <span
                      className="text-[10px] font-semibold tabular-nums"
                      style={{ color: '#16A34A' }}
                    >
                      -{ex.calories} kcal
                    </span>
                  </div>
                </div>
              ))}
              <div
                className="flex items-center justify-between pt-1.5 mt-1 border-t"
                style={{ borderColor: 'rgba(34,197,94,0.15)' }}
              >
                <span className="text-[10px] text-muted-foreground">合计消耗</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: '#16A34A' }}>
                  {selectedDay.burn} kcal
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 汇总指标 */}
      {totalBurn > 0 && (
        <>
          <div className="mx-4 border-t border-border/50" />
          <div className="grid grid-cols-3 gap-0 divide-x divide-border/50">
            <div className="flex flex-col items-center py-3 gap-0.5">
              <Flame className="w-3 h-3 mb-0.5" style={{ color: '#F97316' }} />
              <p className="text-[13px] font-bold text-foreground tabular-nums">{totalBurn}</p>
              <p className="text-[9px] text-muted-foreground">本周总消耗</p>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <Dumbbell className="w-3 h-3 mb-0.5" style={{ color: '#22C55E' }} />
              <p className="text-[13px] font-bold text-foreground tabular-nums">{activeDays.length}</p>
              <p className="text-[9px] text-muted-foreground">运动天数</p>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <Trophy className="w-3 h-3 mb-0.5" style={{ color: '#F59E0B' }} />
              <p className="text-[13px] font-bold text-foreground tabular-nums">{bestDay ? bestDay.burn : avgBurn}</p>
              <p className="text-[9px] text-muted-foreground">最佳单日</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
