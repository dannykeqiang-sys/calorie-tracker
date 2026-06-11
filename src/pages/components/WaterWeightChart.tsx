import type { DayStats } from './AIHealingCard';

interface WaterWeightChartProps {
  stats: DayStats[];
  baseWeight: number;
}

function loadWeight(date: string): number | null {
  const raw = localStorage.getItem(`weight_log_${date}`);
  if (!raw) return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

export default function WaterWeightChart({ stats, baseWeight }: WaterWeightChartProps) {
  const rows = stats.slice(-7);
  const hasAny = rows.some(d => d.water > 0 || loadWeight(d.date) !== null);

  return (
    <div className="rounded-2xl bg-white border border-border shadow-sm p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: '#0EA5E918' }}>
          <span className="text-[10px]" style={{ color: '#0EA5E9' }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6 8 4 13 4 16a8 8 0 0 0 16 0c0-3-2-8-8-14z" />
            </svg>
          </span>
        </div>
        <p className="text-xs font-bold text-foreground">水分与体重</p>
      </div>

      {hasAny ? (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left pb-1.5 font-medium">日期</th>
              <th className="text-right pb-1.5 font-medium pr-2">纯水</th>
              <th className="text-right pb-1.5 font-medium pr-2">食物水</th>
              <th className="text-right pb-1.5 font-medium">体重</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(d => {
              const weight = loadWeight(d.date);
              const isHealthy = weight !== null && baseWeight > 0
                && weight >= baseWeight * 0.98 && weight <= baseWeight * 1.02;
              return (
                <tr key={d.date} className="border-b border-border/30 last:border-0">
                  <td className="py-1 text-muted-foreground">{d.label}</td>
                  <td className="py-1 text-right tabular-nums pr-2" style={{ color: '#0EA5E9' }}>
                    {d.pureWater > 0
                      ? d.pureWater >= 1000 ? `${(d.pureWater / 1000).toFixed(1)}L` : `${d.pureWater}ml`
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="py-1 text-right tabular-nums pr-2" style={{ color: '#7DD3FC' }}>
                    {d.foodWater > 0
                      ? `+${d.foodWater}ml`
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="py-1 text-right tabular-nums font-semibold">
                    {weight !== null
                      ? <span style={{ color: isHealthy ? '#22C55E' : '#F97316' }}>{weight}kg</span>
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-[11px] text-muted-foreground/50 py-3 text-center">开始记录饮水后将展示数据</p>
      )}

      {baseWeight > 0 && (
        <p className="text-[10px] text-muted-foreground/60 mt-2">
          健康体重区间 {(baseWeight * 0.98).toFixed(1)}–{(baseWeight * 1.02).toFixed(1)} kg
        </p>
      )}
    </div>
  );
}
