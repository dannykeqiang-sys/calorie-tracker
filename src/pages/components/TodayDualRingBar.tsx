import { useMemo } from 'react';
import type { UserProfile, DailyRecord } from '../../types';
import { calcTargetCalories, calcMacroTargets, sumMacrosWithEstimate } from '../../utils/calculations';
import { TrendingDown, Minus, TrendingUp } from 'lucide-react';

interface TodayDualRingBarProps {
  profile: UserProfile | null;
  record: DailyRecord;
  dateLabel?: string;
  currentWeight?: number;
}

/* ───── 三环图 — Apple Watch 风格 ───── */
function ThreeRings({ intake, target, protein, proteinTarget, carbs, carbsTarget, fat, fatTarget }: {
  intake: number; target: number; protein: number; proteinTarget: number; carbs: number; carbsTarget: number; fat: number; fatTarget: number;
}) {
  const cx = 100, cy = 100;
  const rings = [
    { r: 78, sw: 12, value: intake, max: target, color: '#f97316', bgColor: 'rgba(249,115,22,0.12)', label: '热量', unit: 'kcal', pct: Math.round(Math.min(intake / Math.max(target, 1), 1.5) * 100) },
    { r: 62, sw: 12, value: protein, max: proteinTarget, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.12)', label: '蛋白', unit: 'g', pct: Math.round(Math.min(protein / Math.max(proteinTarget, 1), 1.5) * 100) },
    { r: 46, sw: 12, value: carbs, max: carbsTarget, color: '#22c55e', bgColor: 'rgba(34,197,94,0.12)', label: '碳水', unit: 'g', pct: Math.round(Math.min(carbs / Math.max(carbsTarget, 1), 1.5) * 100) },
  ];

  function ringPath(r: number, sw: number, pct: number): string {
    const p = Math.min(pct / 100, 1);
    if (p <= 0) return '';
    if (p >= 1) {
      // 完整圆
      return `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} A${r},${r} 0 1 1 ${cx},${cy - r}`;
    }
    const angle = p * 2 * Math.PI - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const largeArc = p > 0.5 ? 1 : 0;
    return `M${cx},${cy - r} A${r},${r} 0 ${largeArc} 1 ${x},${y}`;
  }

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-auto" style={{ maxWidth: 220 }}>
        <defs>
          {rings.map((ring, i) => (
            <filter key={i} id={`ringGlow${i}`}>
              <feGaussianBlur stdDeviation="2" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>
        {/* 背景圆环 */}
        {rings.map((ring, i) => (
          <circle key={`bg${i}`} cx={cx} cy={cy} r={ring.r} fill="none"
            stroke={ring.bgColor} strokeWidth={ring.sw} />
        ))}
        {/* 进度圆环 */}
        {rings.map((ring, i) => {
          const p = Math.min(ring.pct, 150);
          const path = ringPath(ring.r, ring.sw, p);
          return path ? (
            <path key={`fg${i}`} d={path} fill="none"
              stroke={ring.color} strokeWidth={ring.sw} strokeLinecap="round"
              filter={`url(#ringGlow${i})`} opacity={0.9}
              style={{ transition: 'all 0.6s var(--ease-spring)' }} />
          ) : null;
        })}
        {/* 中心文字 */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight="900" fill="var(--ck-dock-title)">{intake}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="var(--ck-dock-sub)">/ {target} kcal</text>

        {/* 环标签 */}
        {rings.map((ring, i) => {
          const labelR = ring.r + 3;
          return (
            <text key={`lbl${i}`} x={cx} y={cy - labelR - 2} textAnchor="middle" fontSize={9}
              fill={ring.color} fontWeight="700">
              {ring.label} {ring.pct}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function TodayDualRingBar({ profile, record, dateLabel = '今日', currentWeight }: TodayDualRingBarProps) {
  const allFoods = Object.values(record.meals).flat();
  const intake = allFoods.reduce((sum, f) => sum + f.calories, 0);
  const totalBurn = record.exercises.reduce((sum, e) => sum + e.calories, 0);
  const hasData = allFoods.length > 0;
  const { protein, carbs, fat } = sumMacrosWithEstimate(record.meals);

  const effectiveProfile = profile && currentWeight !== undefined ? { ...profile, weight: currentWeight } : profile;
  const goalBase = effectiveProfile ? calcTargetCalories(effectiveProfile) : 2000;
  const targetCalories = goalBase + totalBurn;
  const surplus = intake - targetCalories;
  const isBalance = Math.abs(surplus) <= 50;
  const isOver = surplus > 50;

  const statusDelta = isOver ? Math.abs(surplus) : Math.max(0, targetCalories - intake);
  const statusLabel = isBalance ? '完美平衡' : isOver ? `超出 ${Math.abs(surplus)} kcal` : `还可吃 ${Math.max(0, targetCalories - intake)} kcal`;
  const statusColor = isBalance ? '#A3B899' : isOver ? '#EBB193' : '#7CB9E8';
  const statusIcon = isBalance ? Minus : isOver ? TrendingUp : TrendingDown;

  const baseMacros = effectiveProfile ? calcMacroTargets(effectiveProfile) : { proteinTarget: 125, carbsTarget: 250, fatTarget: 56 };
  const scale = goalBase > 0 && totalBurn > 0 ? targetCalories / goalBase : 1;
  const proteinTarget = Math.round(baseMacros.proteinTarget * scale);
  const carbsTarget = Math.round(baseMacros.carbsTarget * scale);
  const fatTarget = Math.round(baseMacros.fatTarget * scale);

  const StatusIcon = statusIcon;

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm"
      style={{
        background: 'var(--ck-dock-bg)',
        border: `1px solid var(--ck-dock-border)`,
      }}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--ck-dock-title)' }}>{dateLabel}营养状态</p>
          <div className="flex items-center gap-1 mt-0.5">
            <StatusIcon className="w-3 h-3" style={{ color: statusColor }} />
            <span className="text-[11px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>
        {totalBurn > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'var(--ck-dock-exercise-chip-bg)', color: '#7CB9E8' }}>
            <TrendingUp className="w-3 h-3" />+{totalBurn} 运动
          </div>
        )}
        {!hasData && (
          <span className="text-[11px]" style={{ color: 'var(--ck-dock-sub)' }}>尚未记录</span>
        )}
      </div>

      {/* 三环图 */}
      <div className="px-4 pb-3">
        <ThreeRings
          intake={intake} target={targetCalories}
          protein={protein} proteinTarget={proteinTarget}
          carbs={carbs} carbsTarget={carbsTarget}
          fat={fat} fatTarget={fatTarget}
        />
      </div>

      {/* 底部三栏数据 */}
      <div className="grid grid-cols-3 px-4 pb-3 gap-1">
        {[
          { label: '基础目标', value: goalBase, color: 'var(--ck-dock-metric-label)' },
          { label: '已摄入', value: intake, color: 'var(--ck-dock-metric-val)' },
          { label: isOver ? '超出' : '还可吃', value: statusDelta, color: isOver ? '#fca5a5' : '#86efac' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center py-1.5 rounded-lg"
            style={{ background: i === 2 ? (isOver ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)') : 'transparent' }}>
            <span className="text-[9px]" style={{ color: 'var(--ck-dock-metric-label)' }}>{item.label}</span>
            <span className="text-xs font-bold tabular-nums mt-0.5" style={{ color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
