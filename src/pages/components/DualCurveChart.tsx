import { useState, useRef, useEffect } from 'react';
import type { DayStats } from './AIHealingCard';

function formatDateShort(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function smoothBezier(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
    d += ` C ${cpx},${pts[i - 1][1]} ${cpx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
  }
  return d;
}

function gapFillPath(aPts: [number, number][], bPts: [number, number][]): string {
  if (aPts.length === 0 || bPts.length === 0) return '';
  let d = smoothBezier(aPts);
  const rev = [...bPts].reverse();
  d += ` L ${rev[0][0]},${rev[0][1]}`;
  for (let i = 1; i < rev.length; i++) {
    const cpx = (rev[i - 1][0] + rev[i][0]) / 2;
    d += ` C ${cpx},${rev[i - 1][1]} ${cpx},${rev[i][1]} ${rev[i][0]},${rev[i][1]}`;
  }
  d += ' Z';
  return d;
}

interface TooltipState {
  visible: boolean;
  cx: number;
  cy: number;
  data: DayStats;
}

function TooltipRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-[11px]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function ChartTooltip({ tip }: { tip: TooltipState }) {
  if (!tip.visible) return null;
  const d = tip.data;
  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{
        left: tip.cx,
        top: tip.cy,
        transform: 'translate(-50%, -115%)',
      }}
    >
      <div
        className="rounded-2xl border border-white/70 shadow-xl text-xs min-w-[148px] overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)' }}
      >
        <div className="px-3 py-2 border-b border-black/5">
          <p className="font-bold text-foreground text-[11px] text-center">
            {d.label} · {formatDateShort(d.date)}
          </p>
        </div>
        <div className="px-3 py-2 space-y-1">
          {d.intake > 0 ? (
            <>
              <TooltipRow label="摄入" value={`${d.intake} kcal`} color="#F97316" />
              {d.burn > 0 && <TooltipRow label="运动消耗" value={`-${d.burn} kcal`} color="#22C55E" />}
              {d.protein > 0 && (
                <TooltipRow label="蛋白 P" value={`${d.protein}g`} color="#3B82F6" />
              )}
              {d.carbs > 0 && (
                <TooltipRow label="碳水 C" value={`${d.carbs}g`} color="#F59E0B" />
              )}
              {d.fat > 0 && (
                <TooltipRow label="脂肪 F" value={`${d.fat}g`} color="#F43F5E" />
              )}
              {d.water > 0 && (
                <TooltipRow
                  label="饮水"
                  value={
                    d.foodWater > 0
                      ? `${d.pureWater}+${d.foodWater}ml`
                      : `${d.water}ml`
                  }
                  color="#0EA5E9"
                />
              )}
              {d.exercises.length > 0 && (
                <div className="flex items-start gap-1.5 pt-0.5">
                  <span className="text-muted-foreground flex-shrink-0">运动</span>
                  <div className="flex flex-wrap gap-1">
                    {d.exercises.map((e, i) => (
                      <span
                        key={i}
                        className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                      >
                        {e.name}
                        {e.duration > 0 ? ` ${e.duration}分` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-1 text-[11px]">暂无记录</p>
          )}
        </div>
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b border-white/60"
        style={{ bottom: -6, background: 'rgba(255,255,255,0.94)' }}
      />
    </div>
  );
}

const FOOD_REFS = [
  { name: '炸鸡腿', kcal: 600 },
  { name: '杯珍珠奶茶', kcal: 430 },
  { name: '碗白米饭', kcal: 200 },
  { name: '颗鸡蛋', kcal: 80 },
];

function CaloriePool({ stats, tdee }: { stats: DayStats[]; tdee: number }) {
  const weeklyIntake = stats.reduce((s, d) => s + d.intake, 0);
  const weeklyExp = stats.reduce((s, d) => s + d.burn, 0) + (tdee || 2000) * 7;
  const balance = weeklyIntake - weeklyExp;
  const isDeficit = balance <= 0;
  const absBalance = Math.abs(balance);
  const ref = FOOD_REFS.find(f => absBalance / f.kcal >= 0.5) || FOOD_REFS[FOOD_REFS.length - 1];
  const count = absBalance > 0 ? (absBalance / ref.kcal).toFixed(1) : '0';
  const pct = Math.min(100, Math.max(4, 50 + (balance / ((tdee || 2000) * 0.5))));

  return (
    <div
      className="rounded-2xl p-3.5 mt-3 border border-white/40"
      style={{ background: 'rgba(255,255,255,0.30)' }}
    >
      <p className="text-[10px] font-semibold text-muted-foreground mb-2 tracking-widest uppercase">
        热量余额池
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: isDeficit
                ? 'linear-gradient(to right, #22C55E, #86EFAC)'
                : 'linear-gradient(to right, #F59E0B, #FCA5A5)',
            }}
          />
        </div>
        <div className="flex-shrink-0 text-right min-w-[56px]">
          <p className="text-xs font-black tabular-nums" style={{ color: isDeficit ? '#22C55E' : '#F97316' }}>
            {isDeficit ? '-' : '+'}{weeklyIntake > 0 ? Math.round(absBalance) : '--'}
          </p>
          <p className="text-[9px] text-muted-foreground">kcal 本周</p>
        </div>
      </div>
      {absBalance >= ref.kcal * 0.5 && tdee > 0 && weeklyIntake > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          {isDeficit
            ? `本周累计赤字 ≈ 少摄入了 ${count} 个${ref.name}`
            : `本周累计盈余 ≈ 多摄入了 ${count} 个${ref.name}`}
        </p>
      )}
    </div>
  );
}

interface DualCurveChartProps {
  stats: DayStats[];
  tdee: number;
  targetCalories: number;
}

export default function DualCurveChart({ stats, tdee, targetCalories }: DualCurveChartProps) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const hasData = stats.some(d => d.intake > 0);

  const W = 320;
  const H = 180;
  const PAD = { t: 24, r: 20, b: 32, l: 42 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const n = stats.length;
  const xStep = n > 1 ? cw / (n - 1) : cw;
  const toX = (i: number) => PAD.l + i * xStep;

  const dailyTDEE = tdee > 0 ? tdee : targetCalories;
  const expValues = stats.map(d => dailyTDEE + d.burn);
  const maxV = Math.max(...stats.map(d => d.intake), ...expValues, 500);
  const toY = (v: number) => PAD.t + ch * (1 - Math.min(v, maxV) / maxV);

  const intakePts: [number, number][] = stats.map((d, i) => [toX(i), toY(d.intake)]);
  const expPts: [number, number][] = expValues.map((v, i) => [toX(i), toY(v)]);

  const intakePath = smoothBezier(intakePts);
  const expPath = smoothBezier(expPts);
  const gapPath = gapFillPath(intakePts, expPts);

  const yTicks = [0, Math.round(maxV * 0.5), maxV].map(v => ({
    v,
    y: toY(v),
    label: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v),
  }));

  const showTip = (i: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = rect.width / W;
    const scaleY = rect.height / H;
    const cx = toX(i) * scaleX;
    const cy = toY(stats[i].intake) * scaleY;
    setTip({ visible: true, cx, cy, data: stats[i] });
  };

  const hideTip = () => {
    hideTimer.current = setTimeout(() => setTip(null), 180);
  };

  return (
    <div
      className="rounded-3xl p-4 border border-white/50"
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-foreground">能量缺口</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">摄入 vs 总消耗（TDEE＋运动）</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-4 h-0.5 rounded-full bg-orange-400 inline-block" />
            摄入
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-4 h-0.5 rounded-full bg-green-400 inline-block" />
            消耗
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'rgba(167,139,250,0.4)' }} />
            缺口
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="relative">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            style={{ overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="gapGradV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="intakeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {yTicks.map(({ v, y, label }) => (
              <g key={v}>
                <line
                  x1={PAD.l} y1={y} x2={PAD.l + cw} y2={y}
                  stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="3,3"
                />
                <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">
                  {label}
                </text>
              </g>
            ))}

            <path d={gapPath} fill="url(#gapGradV)" />

            <path
              d={expPath}
              fill="none"
              stroke="#22C55E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6,3"
              opacity="0.85"
            />

            <path
              d={intakePath}
              fill="none"
              stroke="#F97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {stats.map((d, i) => (
              <g key={d.date}>
                <circle
                  cx={toX(i)} cy={toY(d.intake)} r="3.5"
                  fill={d.intake > 0 ? '#F97316' : '#e5e7eb'}
                  stroke="white" strokeWidth="1.5"
                />
                <circle
                  cx={toX(i)} cy={toY(d.intake)} r="12"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => showTip(i)}
                  onMouseLeave={hideTip}
                  onTouchStart={e => { e.preventDefault(); showTip(i); }}
                  onTouchEnd={hideTip}
                />
                {d.intake > 0 && (
                  <text
                    x={toX(i)} y={toY(d.intake) - 8}
                    textAnchor="middle" fontSize="7.5" fill="#F97316" fontWeight="600"
                  >
                    {d.intake}
                  </text>
                )}
                <text
                  x={toX(i)} y={PAD.t + ch + 18}
                  textAnchor="middle" fontSize="9" fill="#9ca3af"
                  fontWeight={d.label === '今' ? '700' : '400'}
                >
                  {d.label}
                </text>
              </g>
            ))}
          </svg>

          {tip && <ChartTooltip tip={tip} />}
        </div>
      ) : (
        <div className="flex items-center justify-center h-28 text-xs text-muted-foreground/40 tracking-wide">
          开始记录后，将展示能量双曲线对比
        </div>
      )}

      <CaloriePool stats={stats} tdee={tdee} />
    </div>
  );
}
