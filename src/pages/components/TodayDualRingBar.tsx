import { useState, useEffect } from 'react';
import type { UserProfile, DailyRecord } from '../../types';
import { calcTargetCalories, calcMacroTargets, sumMacrosWithEstimate } from '../../utils/calculations';
import { TrendingDown, Minus, TrendingUp } from 'lucide-react';

interface TodayDualRingBarProps {
  profile: UserProfile | null;
  record: DailyRecord;
  dateLabel?: string;
  currentWeight?: number;
}

/* ───── 三环图 — Apple Watch 风格（重设计） ───── */
function ThreeRings({ intake, target, protein, proteinTarget, carbs, carbsTarget, fat, fatTarget }: {
  intake: number; target: number; protein: number; proteinTarget: number; carbs: number; carbsTarget: number; fat: number; fatTarget: number;
}) {
  const [hoverRing, setHoverRing] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const cx = 150, cy = 150;

  const rings = [
    {
      r: 90, sw: 16, value: intake, max: target,
      color: '#f97316', gradientId: 'grad-cal',
      label: '热量', unit: 'kcal',
      pct: Math.min(intake / Math.max(target, 1), 1.5) * 100
    },
    {
      r: 70, sw: 16, value: protein, max: proteinTarget,
      color: '#3b82f6', gradientId: 'grad-protein',
      label: '蛋白质', unit: 'g',
      pct: Math.min(protein / Math.max(proteinTarget, 1), 1.5) * 100
    },
    {
      r: 50, sw: 16, value: carbs, max: carbsTarget,
      color: '#22c55e', gradientId: 'grad-carbs',
      label: '碳水', unit: 'g',
      pct: Math.min(carbs / Math.max(carbsTarget, 1), 1.5) * 100
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  function getEndPoint(r: number, pct: number): { x: number; y: number } | null {
    if (pct <= 0) return null;
    const clampedPct = Math.min(pct, 100);
    const angle = (clampedPct / 100) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  const overallPct = Math.round((intake / Math.max(target, 1)) * 100);
  const isOver = intake > target;
  const overallColor = isOver ? '#ef4444' : '#22c55e';

  return (
    <div className="flex flex-col items-center w-full">
      {/* SVG 三环 */}
      <svg viewBox="0 0 300 300" className="w-full h-auto" style={{ maxWidth: 500 }}>
        <defs>
          {/* 渐变色 */}
          <linearGradient id="grad-cal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="grad-protein" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="grad-carbs" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="grad-over" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>

          {/* 发光滤镜 */}
          {rings.map((ring, i) => (
            <filter key={i} id={`glow${i}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* 背景环 */}
        {rings.map((ring, i) => (
          <circle
            key={`bg${i}`}
            cx={cx}
            cy={cy}
            r={ring.r}
            fill="none"
            stroke={ring.color}
            strokeWidth={ring.sw}
            opacity={hoverRing !== null && hoverRing !== i ? 0.08 : 0.08}
            style={{ transition: 'opacity 0.3s ease' }}
          />
        ))}

        {/* 进度环 */}
        {rings.map((ring, i) => {
          const isH = hoverRing === i;
          const circumference = 2 * Math.PI * ring.r;
          const pct = animated ? Math.min(ring.pct, 150) : 0;
          const dashoffset = circumference - (pct / 100) * circumference;
          const isOver = pct > 100;

          return (
            <g key={`ring${i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={ring.r}
                fill="none"
                stroke={`url(#${isOver ? 'grad-over' : ring.gradientId})`}
                strokeWidth={isH ? ring.sw + 3 : ring.sw}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashoffset}
                opacity={hoverRing !== null && !isH ? 0.4 : 1}
                filter={isH ? `url(#glow${i})` : undefined}
                style={{
                  transform: `rotate(-90deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'stroke-dashoffset 0.8s ease-out, stroke-width 0.3s ease, opacity 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoverRing(i)}
                onMouseLeave={() => setHoverRing(null)}
                onTouchStart={() => setHoverRing(hoverRing === i ? null : i)}
              />

              {/* 端点装饰 */}
              {pct > 0 && (() => {
                const endPoint = getEndPoint(ring.r, pct);
                if (!endPoint) return null;
                return (
                  <circle
                    cx={endPoint.x}
                    cy={endPoint.y}
                    r={isH ? (ring.sw + 3) / 2 : ring.sw / 2}
                    fill={isOver ? '#ef4444' : ring.color}
                    opacity={hoverRing !== null && !isH ? 0.4 : 1}
                    style={{
                      transition: 'all 0.3s ease',
                      pointerEvents: 'none',
                    }}
                  />
                );
              })()}
            </g>
          );
        })}

        {/* 中心文字 */}
        {hoverRing === null ? (
          <>
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              fontSize={30}
              fontWeight="900"
              fill="var(--ck-dock-title)"
              style={{ transition: 'all 0.3s ease' }}
            >
              {intake}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fontSize={12}
              fill="var(--ck-dock-sub)"
              style={{ transition: 'all 0.3s ease' }}
            >
              / {target} kcal
            </text>
            <text
              x={cx}
              y={cy + 28}
              textAnchor="middle"
              fontSize={11}
              fontWeight="700"
              fill={overallColor}
              style={{ transition: 'all 0.3s ease' }}
            >
              {overallPct}%
            </text>
          </>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fontSize={13}
              fontWeight="700"
              fill={rings[hoverRing].color}
              style={{ transition: 'all 0.3s ease' }}
            >
              {rings[hoverRing].label}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fontSize={26}
              fontWeight="900"
              fill="var(--ck-dock-title)"
              style={{ transition: 'all 0.3s ease' }}
            >
              {rings[hoverRing].value}
            </text>
            <text
              x={cx}
              y={cy + 24}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ck-dock-sub)"
              style={{ transition: 'all 0.3s ease' }}
            >
              / {rings[hoverRing].max} {rings[hoverRing].unit}
            </text>
            <text
              x={cx}
              y={cy + 40}
              textAnchor="middle"
              fontSize={10}
              fontWeight="700"
              fill={rings[hoverRing].pct > 100 ? '#ef4444' : rings[hoverRing].color}
              style={{ transition: 'all 0.3s ease' }}
            >
              {Math.round(rings[hoverRing].pct)}%
            </text>
          </>
        )}
      </svg>

      {/* 底部指标卡片 */}
      <div className="flex gap-3 mt-4 w-full max-w-md justify-center">
        {rings.map((ring, i) => {
          const isH = hoverRing === i;
          const pct = Math.round(ring.pct);
          const isOver = pct > 100;

          return (
            <div
              key={i}
              className="flex-1 px-3 py-2 rounded-xl transition-all duration-300 cursor-pointer"
              style={{
                background: isH ? `${ring.color}15` : 'rgba(0,0,0,0.02)',
                border: `1.5px solid ${isH ? ring.color : 'rgba(0,0,0,0.08)'}`,
                transform: isH ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isH ? `0 4px 12px ${ring.color}30` : 'none',
              }}
              onMouseEnter={() => setHoverRing(i)}
              onMouseLeave={() => setHoverRing(null)}
              onTouchStart={() => setHoverRing(hoverRing === i ? null : i)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: isOver ? '#ef4444' : ring.color }}
                />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--ck-dock-sub)' }}>
                  {ring.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ck-dock-title)' }}>
                  {ring.value}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--ck-dock-sub)' }}>
                  / {ring.max}{ring.unit}
                </span>
              </div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: isOver ? '#ef4444' : ring.color }}>
                {pct}%
              </div>
            </div>
          );
        })}
      </div>
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
