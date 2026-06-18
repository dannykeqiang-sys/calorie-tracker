import { useMemo } from 'react';
import type { UserProfile, DailyRecord } from '../../types';
import { calcTargetCalories, calcMacroTargets, sumMacrosWithEstimate } from '../../utils/calculations';
import { Zap, TrendingDown, Minus, TrendingUp, Flame } from 'lucide-react';

interface TodayDualRingBarProps {
  profile: UserProfile | null;
  record: DailyRecord;
  dateLabel?: string;
  currentWeight?: number;
}

/* ───── 热量池 "Tank" 可视化 — 双区 ───── */
function CaloriePoolGauge({ intake, target, burn, baseTarget }: { intake: number; target: number; burn: number; baseTarget: number }) {
  const basePct = baseTarget / Math.max(target, 1); // 基础目标占总量比例
  const intakePct = Math.min(intake / Math.max(target, 1), 1.3);
  const fillH = Math.min(intakePct, 1) * 100; // 填充高度（%）
  const overH = Math.max(0, (intakePct - 1) * 100); // 溢出%

  const baseColor = intakePct < 0.75 ? '#22c55e' : intakePct < 0.95 ? '#f97316' : '#ef4444';
  const glowColor = intakePct < 0.75 ? '#4ade80' : intakePct < 0.95 ? '#fb923c' : '#f87171';

  return (
    <div className="relative flex items-end justify-center" style={{ height: 160, width: 80 }}>
      {/* 池子背景刻度 */}
      <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
        {[1, 0.75, 0.5, 0.25].map(pct => (
          <div key={pct} className="flex items-center gap-1">
            <div className="w-6 h-px" style={{ background: 'var(--ck-dock-scale)' }} />
            <span className="text-[8px] tabular-nums" style={{ color: 'var(--ck-dock-scale-text)' }}>{Math.round(target * pct)}</span>
          </div>
        ))}
      </div>

      {/* 池子容器 */}
      <div className="relative w-14 rounded-2xl overflow-hidden"
        style={{
          height: 'calc(100% - 8px)',
          background: 'var(--ck-dock-pool-bg)',
          border: `2px solid var(--ck-dock-pool-border)`,
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.08)',
        }}>
        {/* 基础目标区标记（底部到 basePct）*/}
        <div className="absolute left-0 right-0 bottom-0 pointer-events-none opacity-30 transition-all duration-1000"
          style={{
            height: `${basePct * 100}%`,
            background: `repeating-linear-gradient(0deg, transparent, transparent 3px, var(--ck-dock-stripe) 3px, var(--ck-dock-stripe) 4px)`,
          }} />

        {/* 液体填充 */}
        <div className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
          style={{
            height: `${fillH}%`,
            background: `linear-gradient(180deg, ${glowColor}88 0%, ${baseColor}CC 30%, ${baseColor} 100%)`,
            boxShadow: `inset 0 2px 8px rgba(255,255,255,0.3), 0 0 20px ${glowColor}44`,
          }}>
          {/* 液面波纹 */}
          <div className="absolute top-0 left-0 right-0 h-2 rounded-full"
            style={{
              background: `linear-gradient(180deg, rgba(255,255,255,0.6), transparent)`,
              animation: 'waveRipple 2s ease-in-out infinite',
            }} />
          <div className="absolute top-1 left-2 w-1.5 h-1 rounded-full bg-white/60" style={{ animation: 'bubble 3s ease-in-out infinite' }} />
          <div className="absolute top-2 right-1.5 w-1 h-1 rounded-full bg-white/40" style={{ animation: 'bubble 2.5s ease-in-out infinite 0.5s' }} />
        </div>

        {/* 运动加成区分隔线 */}
        {burn > 0 && (
          <div className="absolute left-0 right-0 pointer-events-none transition-all duration-1000"
            style={{
              bottom: `${basePct * 100}%`,
            }}>
            <div className="w-full border-t-2 border-dashed border-[#7CB9E8]/60" />
            <span className="absolute -right-10 top-1/2 -translate-y-1/2 text-[7px] text-[#7CB9E8]/70 whitespace-nowrap">运动+{burn}</span>
          </div>
        )}

        {/* 溢出 */}
        {intakePct > 1 && overH > 0 && (
          <div className="absolute top-0 left-0 right-0 transition-all duration-1000 ease-out"
            style={{
              height: `${Math.min(overH, 30)}%`,
              background: 'linear-gradient(180deg, #ef4444CC, #f8717188, transparent)',
            }}>
            <div className="absolute top-0 left-0 right-0 h-1.5 rounded-full bg-red-400/60" />
          </div>
        )}
      </div>

      {/* 中央数字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ top: '45%', transform: 'translateY(-50%)' }}>
        <p className="font-black text-lg leading-none tabular-nums drop-shadow-md" style={{ color: 'var(--ck-dock-title)' }}>{intake}</p>
        <p className="text-[9px] font-medium" style={{ color: 'var(--ck-dock-sub)' }}>/ {target} kcal</p>
        {burn > 0 && (
          <p className="text-[#7CB9E8]/80 text-[8px] font-medium mt-0.5">含运动 {burn}</p>
        )}
      </div>
    </div>
  );
}

/* ───── 宏量元素进度条 ───── */
function MacroBar({ label, actual, target, color, unit }: { label: string; actual: number; target: number; color: string; unit: string }) {
  const pct = target > 0 ? Math.min(actual / target, 1.5) : 0;
  const over = actual > target * 1.05;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold w-7 flex-shrink-0" style={{ color }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--ck-dock-macro-bg)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(pct * 100, 100)}%`,
            background: over
              ? `linear-gradient(90deg, ${color}, #ef4444)`
              : `linear-gradient(90deg, ${color}88, ${color})`,
          }} />
      </div>
      <span className="text-[10px] tabular-nums w-9 text-right" style={{ color: 'var(--ck-dock-macro-text)' }}>
        {actual}<span style={{ color: 'var(--ck-dock-macro-sub)' }}>/{target}{unit}</span>
      </span>
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

  // 真实剩余/超出（对比全面目标 targetCalories）
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
            <Zap className="w-3 h-3" />+{totalBurn} 运动
          </div>
        )}
        {!hasData && (
          <span className="text-[11px]" style={{ color: 'var(--ck-dock-sub)' }}>尚未记录</span>
        )}
      </div>

      {/* 热量池 + 宏量元素双栏 */}
      <div className="flex items-stretch px-4 pb-3 gap-4">
        {/* 左侧：热量池 gauge */}
        <div className="flex-shrink-0">
          <CaloriePoolGauge intake={intake} target={targetCalories} burn={totalBurn} baseTarget={goalBase} />
        </div>

        {/* 右侧：宏量元素 + 指标 */}
        <div className="flex-1 flex flex-col justify-center gap-2.5 min-w-0">
          <MacroBar label="蛋白" actual={protein} target={proteinTarget} color="#fb923c" unit="g" />
          <MacroBar label="碳水" actual={carbs} target={carbsTarget} color="#818cf8" unit="g" />
          <MacroBar label="脂肪" actual={fat} target={fatTarget} color="#38bdf8" unit="g" />

          {/* 底部三栏数据 */}
          <div className="grid grid-cols-3 gap-1 mt-1">
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
      </div>

      <style>{`
        @keyframes waveRipple {
          0%, 100% { opacity: 0.6; transform: translateY(0); }
          50% { opacity: 0.9; transform: translateY(-2px); }
        }
        @keyframes bubble {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          50% { opacity: 0.8; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
