import type { DailyRecord, UserProfile } from '../../types';
import { Droplets, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const WHO_LIMIT = 2300;
const IDEAL_LIMIT = 1500;

interface SodiumAnalysisCardProps {
  record: DailyRecord;
  profile: UserProfile | null;
}

function getSodiumStatus(total: number): { color: string; bg: string; border: string; label: string } {
  if (total < IDEAL_LIMIT) return { color: '#22C55E', bg: 'bg-green-50', border: 'border-green-100', label: '摄入理想' };
  if (total < WHO_LIMIT) return { color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-100', label: '接近上限' };
  return { color: '#EF4444', bg: 'bg-red-50', border: 'border-red-100', label: '超出建议' };
}

function SodiumBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function SodiumAnalysisCard({ record }: SodiumAnalysisCardProps) {
  const allFoods = Object.values(record.meals).flat();
  const hasSodiumData = allFoods.some(f => f.sodium !== undefined && f.sodium > 0);

  if (!hasSodiumData) return null;

  const totalSodium = Math.round(allFoods.reduce((s, f) => s + (f.sodium ?? 0), 0));
  const { color, bg, border, label } = getSodiumStatus(totalSodium);

  const highSodiumFoods = allFoods
    .filter(f => (f.sodium ?? 0) > 300)
    .sort((a, b) => (b.sodium ?? 0) - (a.sodium ?? 0))
    .slice(0, 4);

  const mealSodium: Record<string, number> = {
    早餐: Math.round(record.meals.breakfast.reduce((s, f) => s + (f.sodium ?? 0), 0)),
    午餐: Math.round(record.meals.lunch.reduce((s, f) => s + (f.sodium ?? 0), 0)),
    晚餐: Math.round(record.meals.dinner.reduce((s, f) => s + (f.sodium ?? 0), 0)),
    加餐: Math.round(record.meals.snack.reduce((s, f) => s + (f.sodium ?? 0), 0)),
  };

  const StatusIcon = totalSodium < IDEAL_LIMIT ? TrendingDown : totalSodium < WHO_LIMIT ? Minus : TrendingUp;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
            <Droplets className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <p className="text-sm font-semibold text-foreground">今日钠摄入</p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon className="w-3.5 h-3.5" style={{ color }} />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {label}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-black tabular-nums" style={{ color }}>{totalSodium.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground mb-1">mg</span>
        <span className="text-xs text-muted-foreground mb-1 ml-auto">/ {WHO_LIMIT} mg</span>
      </div>

      <div className="space-y-1.5">
        <SodiumBar value={totalSodium} max={WHO_LIMIT} color={color} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span className="text-green-500">{IDEAL_LIMIT} 理想</span>
          <span className="text-amber-500">{WHO_LIMIT} WHO上限</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {Object.entries(mealSodium).map(([label, val]) => val > 0 ? (
          <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-xs font-bold tabular-nums mt-0.5" style={{ color: getSodiumStatus(val).color }}>{val}</p>
            <p className="text-[9px] text-muted-foreground">mg</p>
          </div>
        ) : null)}
      </div>

      {highSodiumFoods.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">高钠食物</p>
          <div className="space-y-1">
            {highSodiumFoods.map((f, i) => {
              const pct = Math.min(((f.sodium ?? 0) / WHO_LIMIT) * 100, 100);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-foreground flex-1 truncate">{f.name}</span>
                  <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-14 text-right" style={{ color }}>
                    {f.sodium}mg
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`rounded-xl ${bg} border ${border} p-3`}>
        {totalSodium > WHO_LIMIT ? (
          <p className="text-xs leading-relaxed" style={{ color: '#B91C1C' }}>
            今日钠摄入已超出 WHO 建议值 {totalSodium - WHO_LIMIT}mg。建议多饮水帮助排钠，下一餐选择清淡食物，避免腌制品、酱料和加工食品。长期高钠饮食会增加高血压风险。
          </p>
        ) : totalSodium >= IDEAL_LIMIT ? (
          <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
            钠摄入已接近 WHO 上限，建议减少食盐和调料的使用，以天然食物代替加工食品，烹饪时尝试用葱姜蒜、柠檬汁等替代部分食盐提味。
          </p>
        ) : (
          <p className="text-xs leading-relaxed" style={{ color: '#166534' }}>
            钠摄入控制得很好！低钠饮食有助于维持健康血压和心血管健康，继续保持这个好习惯。
          </p>
        )}
      </div>
    </div>
  );
}
