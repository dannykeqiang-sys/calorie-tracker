import type { UserProfile, DailyRecord } from '../../types';
import { calcTargetCalories, calcTDEE } from '../../utils/calculations';
import { TrendingUp, TrendingDown, Minus, Flame, Zap } from 'lucide-react';

interface CalorieDashboardProps {
  profile: UserProfile | null;
  record: DailyRecord;
  dateLabel?: string;
  currentWeight?: number;
}

function RingChart({ value, max, color, size = 140 }: { value: number; max: number; color: string; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(value / Math.max(max, 1), 1);
  const strokeDashoffset = circumference * (1 - ratio);
  const isOver = value > max;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E3DC" strokeWidth={10} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isOver ? '#EBB193' : color}
        strokeWidth={10}
        strokeDasharray={circumference}
        strokeDashoffset={isOver ? 0 : strokeDashoffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export default function CalorieDashboard({ profile, record, dateLabel = '今日', currentWeight }: CalorieDashboardProps) {
  const totalIntake = Object.values(record.meals).flat().reduce((sum, f) => sum + f.calories, 0);
  const totalBurn = record.exercises.reduce((sum, e) => sum + e.calories, 0);
  const effectiveProfile = profile && currentWeight !== undefined ? { ...profile, weight: currentWeight } : profile;
  const tdee = effectiveProfile ? calcTDEE(effectiveProfile) : 2000;
  const targetCalories = effectiveProfile ? calcTargetCalories(effectiveProfile) : 2000;
  const dynamicTarget = tdee + totalBurn;
  const surplus = totalIntake - dynamicTarget;
  const surplusAbs = Math.abs(surplus);
  const isOver = surplus > 50;
  const isBalance = surplusAbs <= 50;
  const remaining = Math.max(0, dynamicTarget - totalIntake);

  const goalOffset = totalBurn > 0
    ? `基础 ${tdee} + 运动 ${totalBurn} = ${dynamicTarget} kcal`
    : `基础代谢额度 ${tdee} kcal`;

  const getSurplusInfo = () => {
    if (isBalance) return {
      icon: Minus,
      color: '#A3B899',
      label: '完美平衡',
      text: `你${dateLabel}的热量管理非常棒！运动让今天的额度来到 ${dynamicTarget} kcal`,
      bg: 'bg-primary/5',
    };
    if (isOver) return {
      icon: TrendingUp,
      color: '#EBB193',
      label: '轻微盈余',
      text: `${dateLabel}超出 ${surplusAbs} 大卡，明天多运动一点或减少精制碳水就能补回来`,
      bg: 'bg-secondary/5',
    };
    return {
      icon: TrendingDown,
      color: '#7CB9E8',
      label: '热量缺口',
      text: `${dateLabel}还有 ${remaining} 大卡可以吃，${totalBurn > 0 ? `运动让你多赚了 ${totalBurn} kcal 空间，` : ''}继续向目标迈进！`,
      bg: 'bg-blue-50',
    };
  };

  const surplusInfo = getSurplusInfo();
  const SurplusIcon = surplusInfo.icon;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative flex-shrink-0">
            <RingChart value={totalIntake} max={dynamicTarget} color="#A3B899" size={140} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Flame className="w-5 h-5 text-secondary mb-1" />
              <p className="text-2xl font-bold text-foreground leading-none">{totalIntake}</p>
              <p className="text-[11px] text-muted-foreground">/ {dynamicTarget}</p>
              <p className="text-[10px] text-muted-foreground/60">kcal</p>
            </div>
          </div>

          <div className="flex-1 w-full space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{dateLabel}摄入</span>
                <span className="font-semibold text-primary">{totalIntake} kcal</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((totalIntake / dynamicTarget) * 100, 100)}%`,
                    background: totalIntake > dynamicTarget
                      ? 'linear-gradient(to right, #EBB193, #e8976e)'
                      : 'linear-gradient(to right, #A3B899, #8aab7e)',
                  }}
                />
              </div>
            </div>

            {totalBurn > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-400" />
                    运动额外获得
                  </span>
                  <span className="font-semibold text-blue-500">+{totalBurn} kcal</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((totalBurn / tdee) * 100, 100)}%`,
                      background: 'linear-gradient(to right, #7CB9E8, #5aa0d4)',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(163,184,153,0.08)', border: '1px solid rgba(163,184,153,0.2)' }}>
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">{goalOffset}</p>
              {remaining > 0 && !isOver && (
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#A3B899' }}>
                  还可摄入 {remaining} kcal
                </p>
              )}
              {totalBurn === 0 && targetCalories !== tdee && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  目标热量 {targetCalories} kcal（含 {targetCalories < tdee ? `赤字 ${tdee - targetCalories}` : `盈余 ${targetCalories - tdee}`} kcal）
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border border-border p-4 flex items-start gap-3 ${surplusInfo.bg}`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${surplusInfo.color}20` }}>
          <SurplusIcon className="w-4 h-4" style={{ color: surplusInfo.color }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: surplusInfo.color }}>
            {surplusInfo.label}
            {!isBalance && <span className="ml-1 font-normal">· {surplusAbs} kcal</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{surplusInfo.text}</p>
        </div>
      </div>
    </div>
  );
}
