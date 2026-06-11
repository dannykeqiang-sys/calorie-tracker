import { useState } from 'react';
import { Flame, Droplets, Scale, TrendingUp } from 'lucide-react';
import type { DayStats } from './AIHealingCard';

interface WeeklyChartsProps {
  stats: DayStats[];
  targetCalories: number;
}

const SVG_H = 80;
const BAR_AREA_H = 62;
const LABEL_Y = 76;
const BAR_W = 28;
const BAR_GAP = 12;

function calcSvgW(count: number) {
  return Math.max(280, count * (BAR_W + BAR_GAP));
}

function barX(i: number) {
  return i * (BAR_W + BAR_GAP);
}

function barCenterX(i: number) {
  return barX(i) + BAR_W / 2;
}

interface TooltipProps {
  x: number;
  lines: { text: string; color?: string }[];
}

function Tooltip({ x, lines }: TooltipProps) {
  return (
    <div
      className="absolute z-10 pointer-events-none"
      style={{
        bottom: '100%',
        left: x,
        transform: 'translateX(-50%)',
        marginBottom: 4,
      }}
    >
      <div className="bg-gray-900/90 text-white rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-lg">
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.color ?? 'white' }}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

function CalorieChart({ stats, targetCalories }: { stats: DayStats[]; targetCalories: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgW = calcSvgW(stats.length);
  const maxVal = Math.max(targetCalories * 1.3, ...stats.map(d => d.intake), 100);
  const targetY = BAR_AREA_H - (targetCalories / maxVal) * BAR_AREA_H;

  return (
    <div className="relative overflow-x-auto">
      <svg width={svgW} viewBox={`0 0 ${svgW} ${SVG_H}`} style={{ height: SVG_H, minWidth: svgW }}>
        <line x1={0} y1={targetY} x2={svgW} y2={targetY} stroke="#F97316" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.5} />
        <text x={svgW - 2} y={targetY - 2} textAnchor="end" fontSize={6} fill="#F97316" opacity={0.7}>目标</text>

        {stats.map((d, i) => {
          const h = d.intake > 0 ? Math.max(2, (d.intake / maxVal) * BAR_AREA_H) : 0;
          const x = barX(i);
          const y = BAR_AREA_H - h;
          const color = d.intake === 0 ? '#E5E7EB' : d.intake <= targetCalories ? '#22C55E' : '#EF4444';
          const isH = hoverIdx === i;
          return (
            <g key={d.date}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={() => setHoverIdx(prev => prev === i ? null : i)}
              className="cursor-pointer"
            >
              <rect x={x} y={0} width={BAR_W} height={BAR_AREA_H} fill="transparent" />
              <rect
                x={x} y={y} width={BAR_W} height={Math.max(h, 0)} rx={4}
                fill={color}
                opacity={isH ? 1 : 0.72}
                style={{ transition: 'opacity 0.15s' }}
              />
              <text x={barCenterX(i)} y={LABEL_Y} textAnchor="middle" fontSize={7.5} fill={isH ? '#374151' : '#9CA3AF'} fontWeight={isH ? '700' : '400'}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && stats[hoverIdx] && (
        <Tooltip
          x={barCenterX(hoverIdx)}
          lines={[
            { text: stats[hoverIdx].date.slice(5) },
            { text: `摄入 ${stats[hoverIdx].intake} kcal`, color: stats[hoverIdx].intake <= targetCalories ? '#86efac' : '#fca5a5' },
            ...(stats[hoverIdx].burn > 0 ? [{ text: `消耗 ${stats[hoverIdx].burn} kcal`, color: '#93c5fd' }] : []),
          ]}
        />
      )}
    </div>
  );
}

function WaterChart({ stats }: { stats: DayStats[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgW = calcSvgW(stats.length);
  const BASELINE = 1500;
  const maxVal = Math.max(BASELINE * 1.4, ...stats.map(d => d.water), 100);
  const baselineY = BAR_AREA_H - (BASELINE / maxVal) * BAR_AREA_H;

  return (
    <div className="relative overflow-x-auto">
      <svg width={svgW} viewBox={`0 0 ${svgW} ${SVG_H}`} style={{ height: SVG_H, minWidth: svgW }}>
        <line x1={0} y1={baselineY} x2={svgW} y2={baselineY} stroke="#0EA5E9" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.45} />
        <text x={svgW - 2} y={baselineY - 2} textAnchor="end" fontSize={6} fill="#0EA5E9" opacity={0.7}>1500ml</text>

        {stats.map((d, i) => {
          const h = d.water > 0 ? Math.max(2, (d.water / maxVal) * BAR_AREA_H) : 0;
          const x = barX(i);
          const y = BAR_AREA_H - h;
          const color = d.water === 0 ? '#E5E7EB' : d.water >= BASELINE ? '#0EA5E9' : '#7DD3FC';
          const isH = hoverIdx === i;
          return (
            <g key={d.date}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={() => setHoverIdx(prev => prev === i ? null : i)}
              className="cursor-pointer"
            >
              <rect x={x} y={0} width={BAR_W} height={BAR_AREA_H} fill="transparent" />
              <rect
                x={x} y={y} width={BAR_W} height={Math.max(h, 0)} rx={4}
                fill={color} opacity={isH ? 1 : 0.75}
                style={{ transition: 'opacity 0.15s' }}
              />
              <text x={barCenterX(i)} y={LABEL_Y} textAnchor="middle" fontSize={7.5} fill={isH ? '#374151' : '#9CA3AF'} fontWeight={isH ? '700' : '400'}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && stats[hoverIdx] && (
        <Tooltip
          x={barCenterX(hoverIdx)}
          lines={[
            { text: stats[hoverIdx].date.slice(5) },
            { text: `饮水 ${stats[hoverIdx].water} ml`, color: '#7dd3fc' },
            ...(stats[hoverIdx].water >= BASELINE ? [{ text: '达标', color: '#86efac' }] : [{ text: `差 ${BASELINE - stats[hoverIdx].water} ml`, color: '#fca5a5' }]),
          ]}
        />
      )}
    </div>
  );
}

function WeightChart({ stats }: { stats: DayStats[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgW = calcSvgW(stats.length);
  const weightData = stats.map((d, i) => ({ i, w: d.weight })).filter(x => x.w !== undefined) as { i: number; w: number }[];

  if (weightData.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/50">
        暂无体重记录
      </div>
    );
  }

  const weights = weightData.map(x => x.w);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = Math.max(maxW - minW, 1);
  const MARGIN = BAR_AREA_H * 0.15;

  const pointY = (w: number) => MARGIN + (BAR_AREA_H - 2 * MARGIN) * (1 - (w - minW) / range);
  const pointX = (i: number) => barCenterX(i);

  const polyline = weightData.map(x => `${pointX(x.i)},${pointY(x.w)}`).join(' ');

  return (
    <div className="relative overflow-x-auto">
      <svg width={svgW} viewBox={`0 0 ${svgW} ${SVG_H}`} style={{ height: SVG_H, minWidth: svgW }}>
        {weightData.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#A3B899"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {stats.map((_, i) => {
          const wItem = weightData.find(x => x.i === i);
          return (
            <g key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={() => setHoverIdx(prev => prev === i ? null : i)}
              className="cursor-pointer"
            >
              <rect x={barX(i)} y={0} width={BAR_W} height={BAR_AREA_H} fill="transparent" />
              {wItem !== undefined && (
                <circle
                  cx={pointX(i)} cy={pointY(wItem.w)} r={hoverIdx === i ? 5 : 3.5}
                  fill={hoverIdx === i ? '#A3B899' : 'white'}
                  stroke="#A3B899" strokeWidth={2}
                  style={{ transition: 'r 0.15s' }}
                />
              )}
              <text x={barCenterX(i)} y={LABEL_Y} textAnchor="middle" fontSize={7.5} fill={hoverIdx === i ? '#374151' : '#9CA3AF'} fontWeight={hoverIdx === i ? '700' : '400'}>
                {stats[i].label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && (() => {
        const wItem = weightData.find(x => x.i === hoverIdx);
        if (!wItem) return null;
        return (
          <Tooltip
            x={barCenterX(hoverIdx)}
            lines={[
              { text: stats[hoverIdx].date.slice(5) },
              { text: `${wItem.w} kg`, color: '#bbf7d0' },
            ]}
          />
        );
      })()}
    </div>
  );
}

function MacroStackChart({ stats }: { stats: DayStats[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgW = calcSvgW(stats.length);
  const totals = stats.map(d => d.protein * 4 + d.carbs * 4 + d.fat * 9);
  const maxTotal = Math.max(...totals, 100);

  return (
    <div className="relative overflow-x-auto">
      <svg width={svgW} viewBox={`0 0 ${svgW} ${SVG_H}`} style={{ height: SVG_H, minWidth: svgW }}>
        {stats.map((d, i) => {
          const total = totals[i];
          if (total === 0) {
            return (
              <g key={d.date}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onTouchStart={() => setHoverIdx(prev => prev === i ? null : i)}
              >
                <rect x={barX(i)} y={BAR_AREA_H - 2} width={BAR_W} height={2} rx={1} fill="#E5E7EB" />
                <text x={barCenterX(i)} y={LABEL_Y} textAnchor="middle" fontSize={7.5} fill="#9CA3AF">{d.label}</text>
              </g>
            );
          }

          const hProtein = (d.protein * 4 / maxTotal) * BAR_AREA_H;
          const hCarbs = (d.carbs * 4 / maxTotal) * BAR_AREA_H;
          const hFat = (d.fat * 9 / maxTotal) * BAR_AREA_H;
          const x = barX(i);
          const isH = hoverIdx === i;

          return (
            <g key={d.date}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={() => setHoverIdx(prev => prev === i ? null : i)}
              className="cursor-pointer"
              opacity={isH ? 1 : 0.78}
              style={{ transition: 'opacity 0.15s' }}
            >
              <rect x={x} y={0} width={BAR_W} height={BAR_AREA_H} fill="transparent" />
              {hFat > 0 && <rect x={x} y={BAR_AREA_H - hProtein - hCarbs - hFat} width={BAR_W} height={hFat} rx={0} fill="#0EA5E9" />}
              {hCarbs > 0 && <rect x={x} y={BAR_AREA_H - hProtein - hCarbs} width={BAR_W} height={hCarbs} rx={0} fill="#6366F1" />}
              {hProtein > 0 && <rect x={x} y={BAR_AREA_H - hProtein} width={BAR_W} height={hProtein} rx={0} fill="#F97316" />}
              <rect x={x} y={BAR_AREA_H - hProtein - hCarbs - hFat} width={BAR_W} height={2} rx={2} fill="white" opacity={0.3} />
              <text x={barCenterX(i)} y={LABEL_Y} textAnchor="middle" fontSize={7.5} fill={isH ? '#374151' : '#9CA3AF'} fontWeight={isH ? '700' : '400'}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && stats[hoverIdx] && totals[hoverIdx] > 0 && (
        <Tooltip
          x={barCenterX(hoverIdx)}
          lines={[
            { text: stats[hoverIdx].date.slice(5) },
            { text: `蛋白 ${stats[hoverIdx].protein}g`, color: '#fdba74' },
            { text: `碳水 ${stats[hoverIdx].carbs}g`, color: '#a5b4fc' },
            { text: `脂肪 ${stats[hoverIdx].fat}g`, color: '#7dd3fc' },
          ]}
        />
      )}
    </div>
  );
}

interface ChartCardProps {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}

function ChartCard({ icon: Icon, title, iconColor, children }: ChartCardProps) {
  return (
    <div className="rounded-2xl bg-white border border-border shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
        <p className="text-xs font-bold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

export default function WeeklyCharts({ stats, targetCalories }: WeeklyChartsProps) {
  if (stats.length === 0) return null;

  return (
    <div className="space-y-3">
      <ChartCard icon={Flame} title="热量趋势" iconColor="#F97316">
        <CalorieChart stats={stats} targetCalories={targetCalories} />
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: '#22C55E' }} /><span className="text-[10px] text-muted-foreground">达标</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: '#EF4444' }} /><span className="text-[10px] text-muted-foreground">超标</span></div>
          <div className="flex items-center gap-1"><div className="w-5 border-t border-dashed" style={{ borderColor: '#F97316' }} /><span className="text-[10px] text-muted-foreground">目标线</span></div>
        </div>
      </ChartCard>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard icon={Scale} title="体重变化" iconColor="#A3B899">
          <WeightChart stats={stats} />
        </ChartCard>
        <ChartCard icon={Droplets} title="每日饮水" iconColor="#0EA5E9">
          <WaterChart stats={stats} />
        </ChartCard>
      </div>

      <ChartCard icon={TrendingUp} title="营养素分布" iconColor="#6366F1">
        <MacroStackChart stats={stats} />
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: '#F97316' }} /><span className="text-[10px] text-muted-foreground">蛋白质</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: '#6366F1' }} /><span className="text-[10px] text-muted-foreground">碳水</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: '#0EA5E9' }} /><span className="text-[10px] text-muted-foreground">脂肪</span></div>
        </div>
      </ChartCard>
    </div>
  );
}
