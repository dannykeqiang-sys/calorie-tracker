import type { UserProfile, DailyRecord } from '../../types';
import { calcTargetCalories, calcMacroTargets, sumMacrosWithEstimate } from '../../utils/calculations';
import MacroRingChart from './MacroRingChart';
import { Zap, TrendingDown, Minus, TrendingUp } from 'lucide-react';

interface TodayDualRingBarProps {
  profile: UserProfile | null;
  record: DailyRecord;
  dateLabel?: string;
  currentWeight?: number;
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
  const remaining = Math.max(0, targetCalories - intake);

  const baseMacros = effectiveProfile ? calcMacroTargets(effectiveProfile) : { proteinTarget: 125, carbsTarget: 250, fatTarget: 56 };
  const scale = goalBase > 0 && totalBurn > 0 ? targetCalories / goalBase : 1;
  const proteinTarget = Math.round(baseMacros.proteinTarget * scale);
  const carbsTarget = Math.round(baseMacros.carbsTarget * scale);
  const fatTarget = Math.round(baseMacros.fatTarget * scale);

  const statusInfo = isBalance
    ? { icon: Minus, color: '#A3B899', label: '完美平衡' }
    : isOver
    ? { icon: TrendingUp, color: '#EBB193', label: `超出 ${Math.abs(surplus)} kcal` }
    : { icon: TrendingDown, color: '#7CB9E8', label: `剩余 ${remaining} kcal` };

  const StatusIcon = statusInfo.icon;

  return (
    <div className="rounded-2xl bg-white border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <div>
          <p className="text-sm font-bold text-foreground">{dateLabel}营养状态</p>
          <div className="flex items-center gap-1 mt-0.5">
            <StatusIcon className="w-3 h-3" style={{ color: statusInfo.color }} />
            <span className="text-[11px] font-medium" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
          </div>
        </div>
        {totalBurn > 0 && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(124,185,232,0.12)', color: '#5199C8' }}
          >
            <Zap className="w-3 h-3" />
            +{totalBurn} 运动
          </div>
        )}
      </div>

      <div className="pb-1">
        <MacroRingChart
          intake={intake}
          targetCalories={targetCalories}
          protein={protein}
          carbs={carbs}
          fat={fat}
          proteinTarget={proteinTarget}
          carbsTarget={carbsTarget}
          fatTarget={fatTarget}
          hasData={hasData}
        />
      </div>

      <div className="grid grid-cols-3 border-t border-border/40">
        {[
          { label: '目标额度', value: targetCalories, unit: 'kcal', color: '#6B7280' },
          { label: '已摄入', value: intake, unit: 'kcal', color: '#1F2937' },
          {
            label: isOver ? '超出' : '还可吃',
            value: isOver ? Math.abs(surplus) : remaining,
            unit: 'kcal',
            color: isOver ? '#EBB193' : '#A3B899',
          },
        ].map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center py-3"
            style={{ borderRight: i < 2 ? '1px solid rgba(0,0,0,0.06)' : undefined }}
          >
            <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
            <p className="text-base font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground/60">{item.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
