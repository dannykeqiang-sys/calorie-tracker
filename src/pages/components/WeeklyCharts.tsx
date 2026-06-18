import { useState, useMemo } from 'react';
import { Flame, Calendar, Gauge, Radar, ArrowRight, TrendingUp } from 'lucide-react';
import type { DayStats } from './AIHealingCard';

interface WeeklyChartsProps {
  stats: DayStats[];
  targetCalories: number;
}

/* ─── 工具 ─── */
const H = 120, LABEL_Y = 108, CHART_H = 76;
function svgW(n: number) { return Math.max(300, n * 44); }
function px(i: number) { return i * 44 + 22; }

function smoothLine(points: { x: number; y: number }[], tension = 0.35): string {
  if (points.length < 2) return points.map(p => `${p.x},${p.y}`).join(' ');
  const cp = (x1: number, y1: number, x2: number, y2: number, t: number) => ({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const c1 = cp(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, tension);
    const c2 = cp(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, 1 - tension);
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

/* ─── 卡片壳 ─── */
export function ChartCard({ icon: Icon, title, iconColor, kind = 'indigo', children, subtitle }: {
  icon: React.ElementType; title: string; iconColor: string; kind?: 'orange' | 'purple' | 'indigo'; children: React.ReactNode; subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border shadow-sm p-4 relative overflow-hidden group"
      style={{
        borderColor: 'var(--ck-chart-card-border)',
        background: `var(--ck-card-${kind})`,
      }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${iconColor}20, ${iconColor}0D)`, boxShadow: `0 2px 10px ${iconColor}18` }}>
            <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
          </div>
          <span className="text-xs font-bold tracking-tight" style={{ color: 'var(--ck-chart-card-text)' }}>{title}</span>
        </div>
        {subtitle && <span className="text-[9px]" style={{ color: 'var(--ck-chart-dim)' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

/* ════════════════════ 1. 仪表盘 Gauge ════════════════════ */
export function CalorieGauge({ stats, target }: { stats: DayStats[]; target: number }) {
  const [dayIdx, setDayIdx] = useState(stats.length - 1);
  const d = stats[dayIdx];
  if (!d || !d.intake) return null;

  const pct = Math.min(d.intake / Math.max(target, 1), 1.5);
  const angle = Math.min(pct, 1.5) * 180;
  const R = 70, CX = 100, CY = 90, arcR = R - 6;

  const zones = [
    { start: 0, end: 90, color: '#22c55e' },
    { start: 90, end: 150, color: '#eab308' },
    { start: 150, end: 210, color: '#f97316' },
    { start: 210, end: 270, color: '#ef4444' },
  ];

  function polar(deg: number, r: number) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }
  function arcPath(s: number, e: number, r: number) {
    const a = polar(s, r), b = polar(e, r);
    return `M${a.x},${a.y} A${r},${r} 0 ${e - s > 180 ? 1 : 0} 1 ${b.x},${b.y}`;
  }

  const nTip = polar(90 + angle, arcR - 10);
  const nB1 = polar(90 + angle - 95, 8);
  const nB2 = polar(90 + angle + 95, 8);

  return (
    <ChartCard icon={Gauge} title="热量仪表盘" iconColor="#F97316" kind="orange" subtitle={`${d.label} 数据`}>
      <div className="flex justify-center">
        <svg viewBox="0 0 200 130" className="w-full max-w-[260px] h-auto" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="gShdw"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" /></filter>
            <linearGradient id="needleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" /><stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          {zones.map(z => (
            <g key={z.color} className="group cursor-pointer"
              onMouseEnter={e => { (e.currentTarget.querySelector('path') as SVGPathElement)?.setAttribute('stroke-width', '14'); }}
              onMouseLeave={e => { (e.currentTarget.querySelector('path') as SVGPathElement)?.setAttribute('stroke-width', '10'); }}>
              <path d={arcPath(z.start, z.end, arcR)} fill="none" stroke={z.color} strokeWidth={10}
                strokeLinecap="round" opacity={0.7} style={{ transition: 'stroke-width 0.2s' }} />
            </g>
          ))}
          {[0, 45, 90, 135, 180, 225, 270].map(deg => {
            const i = polar(deg, arcR - 5), o = polar(deg, arcR + 5);
            return <line key={deg} x1={i.x} y1={i.y} x2={o.x} y2={o.y}
              stroke="var(--ck-chart-grid)" strokeWidth={deg % 90 === 0 ? 1.5 : 0.5} />;
          })}
          {[0, 90, 180, 270].map(deg => {
            const p = polar(deg, arcR - 18);
            return <text key={deg} x={p.x} y={p.y + 3} textAnchor="middle" fontSize={7}
              fill="var(--ck-chart-dim)" fontWeight="600">
              {['0', `${Math.round(target * 0.5)}`, `${target}`, `${Math.round(target * 1.5)}+`][[0, 90, 180, 270].indexOf(deg)]}
            </text>;
          })}
          <polygon points={`${nTip.x},${nTip.y} ${nB1.x},${nB1.y} ${nB2.x},${nB2.y}`}
            fill="url(#needleGrad)" filter="url(#gShdw)" />
          <circle cx={CX} cy={CY} r={7} fill="#1e293b" />
          <circle cx={CX} cy={CY} r={4} fill="#F97316" />
          <text x={CX} y={CY + 26} textAnchor="middle" fontSize={17} fontWeight="900"
            fill="var(--ck-chart-card-text)">{d.intake}</text>
          <text x={CX} y={CY + 38} textAnchor="middle" fontSize={8} fill="var(--ck-chart-dim)">/ {target} kcal</text>
          <text x={CX} y={CY + 49} textAnchor="middle" fontSize={8} fontWeight="700"
            fill={pct > 1 ? '#ef4444' : pct > 0.9 ? '#f97316' : '#22c55e'}>
            {pct > 1 ? `超出 ${Math.round((pct - 1) * 100)}%` : `${Math.round(pct * 100)}%`}
          </text>
        </svg>
      </div>
      <div className="flex items-center gap-0.5 mt-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {stats.map((s, i) => (
          <button key={s.date} onClick={() => setDayIdx(i)}
            className="flex-shrink-0 px-2 py-1 rounded-full text-[9px] font-semibold transition-all cursor-pointer"
            style={{
              background: i === dayIdx ? '#F97316' : 'transparent',
              color: i === dayIdx ? 'white' : 'var(--ck-chart-label)',
              opacity: s.intake > 0 ? 1 : 0.4,
            }}>
            {s.label}
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 2. 营养雷达 — 4轴（蛋白/碳水/脂肪/饮水）═══════════════════ */
export function NutritionRadar({ stats, target }: { stats: DayStats[]; target: number }) {
  const [dayIdx, setDayIdx] = useState(stats.length - 1);
  const [hoverAxis, setHoverAxis] = useState<number | null>(null);
  const today = stats[dayIdx];
  if (!today || !today.intake) return null;

  const axes = [
    { key: 'protein' as const, label: '蛋白质', max: 150, color: '#fb923c', unit: 'g' },
    { key: 'carbs' as const, label: '碳水', max: 300, color: '#818cf8', unit: 'g' },
    { key: 'fat' as const, label: '脂肪', max: 80, color: '#38bdf8', unit: 'g' },
    { key: 'water' as const, label: '饮水', max: 2500, color: '#0ea5e9', unit: 'ml' },
  ];

  const R = 85, CX = 110, CY = 105, N = axes.length, step = (2 * Math.PI) / N;
  function pt(idx: number, value: number, max: number) {
    const r = R * Math.min(value / Math.max(max, 1), 1);
    const a = -Math.PI / 2 + idx * step;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  }

  const actualPts = axes.map((a, i) => pt(i, today[a.key] as number, a.max));
  const path = actualPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <ChartCard icon={Radar} title="营养雷达" iconColor="#8B5CF6" kind="purple" subtitle={`${today.label} 数据`}>
      <div className="flex justify-center">
        <svg viewBox="0 0 220 205" className="w-full max-w-[280px] h-auto">
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.30" /><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.04" />
            </linearGradient>
            <filter id="rGlow"><feGaussianBlur stdDeviation="1.5" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {/* 网格线 */}
          {[0.25, 0.5, 0.75, 1].map(pct => {
            const pts = axes.map((_, i) => `${pt(i, axes[i].max * pct, axes[i].max).x},${pt(i, axes[i].max * pct, axes[i].max).y}`).join(' ');
            return <polygon key={pct} points={pts} fill="none" stroke="var(--ck-chart-grid)" strokeWidth={pct === 1 ? 1 : 0.5} />;
          })}
          {/* 轴线 */}
          {axes.map((_, i) => {
            const p = pt(i, axes[i].max, axes[i].max);
            return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--ck-chart-grid)" strokeWidth={0.5} />;
          })}
          {/* 填充面积 + 轮廓线 */}
          <polygon points={path} fill="url(#radarFill)" stroke="#8B5CF6" strokeWidth={1.6} strokeLinejoin="round" filter="url(#rGlow)" />
          {/* 数据点 */}
          {axes.map((a, i) => {
            const p = pt(i, today[a.key] as number, a.max);
            const isH = hoverAxis === i;
            return (
              <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoverAxis(i)} onMouseLeave={() => setHoverAxis(null)}>
                <circle cx={p.x} cy={p.y} r={isH ? 5.5 : 3.5} fill="white" stroke={a.color} strokeWidth={isH ? 3 : 2}
                  filter={isH ? 'url(#rGlow)' : undefined} style={{ transition: 'all 0.2s' }} />
                {isH && <rect x={p.x - 24} y={p.y - 30} width={48} height={18} rx={6} fill="var(--ck-chart-tooltip-bg)" opacity={0.92} />}
                {isH && <text x={p.x} y={p.y - 16} textAnchor="middle" fontSize={8} fill="var(--ck-chart-tooltip-fg)" fontWeight="800">{today[a.key]}{a.unit}</text>}
              </g>
            );
          })}
          {/* 轴标签 */}
          {axes.map((a, i) => {
            const p = pt(i, a.max * 1.2, a.max);
            return (
              <g key={i}>
                <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={8} fill="var(--ck-chart-text)" fontWeight="600">{a.label}</text>
                <text x={p.x} y={p.y + 10} textAnchor="middle" fontSize={7} fill="var(--ck-chart-dim)">{today[a.key]}{a.unit}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-0.5 mt-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {stats.map((s, i) => (
          <button key={s.date} onClick={() => setDayIdx(i)}
            className="flex-shrink-0 px-2 py-1 rounded-full text-[9px] font-semibold transition-all cursor-pointer"
            style={{ background: i === dayIdx ? '#8B5CF6' : 'transparent', color: i === dayIdx ? 'white' : 'var(--ck-chart-label)', opacity: s.intake > 0 ? 1 : 0.4 }}>
            {s.label}
          </button>
        ))}
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 3. 桑基图 ════════════════════ */
interface SankeyNode { id: string; label: string; value: number; color: string; col: number; }
interface SankeyLink { source: string; target: string; value: number; color: string; }

export function MacroSankey({ stats }: { stats: DayStats[] }) {
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const today = stats[stats.length - 1];
  if (!today || today.intake === 0) return null;

  const meals = [
    { id: 'breakfast', label: '早餐', value: today.mealCals?.[0] ?? 0, color: '#fbbf24' },
    { id: 'lunch', label: '午餐', value: today.mealCals?.[1] ?? 0, color: '#f97316' },
    { id: 'dinner', label: '晚餐', value: today.mealCals?.[2] ?? 0, color: '#ef4444' },
    { id: 'snack', label: '加餐', value: today.mealCals?.[3] ?? 0, color: '#a78bfa' },
  ].filter(m => m.value > 0);

  const macros = [
    { id: 'protein', label: '蛋白质', value: today.protein, color: '#fb923c', calPerUnit: 4 },
    { id: 'carbs', label: '碳水', value: today.carbs, color: '#818cf8', calPerUnit: 4 },
    { id: 'fat', label: '脂肪', value: today.fat, color: '#38bdf8', calPerUnit: 9 },
  ].filter(m => m.value > 0);

  const nodes: SankeyNode[] = [
    ...meals.map(m => ({ ...m, col: 0 })),
    ...macros.map(m => ({ ...m, col: 1 })),
    { id: 'energy', label: '能量', value: today.intake, color: '#e2e8f0', col: 2 },
  ];

  const macroTotal = macros.reduce((s, m) => s + m.value * m.calPerUnit, 0) || 1;
  const links: SankeyLink[] = [];
  for (const meal of meals) {
    for (const macro of macros) {
      const share = (macro.value * macro.calPerUnit) / macroTotal;
      const flow = Math.round(meal.value * share);
      if (flow > 0) links.push({ source: meal.id, target: macro.id, value: flow, color: macro.color });
    }
  }
  for (const macro of macros) {
    const cal = macro.value * macro.calPerUnit;
    if (cal > 0) links.push({ source: macro.id, target: 'energy', value: cal, color: macro.color });
  }

  const W = 400, HH = 240, PAD_TOP = 28, PAD_BOT = 16;
  const cols = [0.10, 0.44, 0.78];
  const usableH = HH - PAD_TOP - PAD_BOT;
  const totalV = nodes.reduce((s, n) => s + (n.col === 2 ? n.value * 0.5 : n.value), 0) || 1;

  const colNodes: SankeyNode[][] = [[], [], []];
  for (const n of nodes) colNodes[n.col].push(n);

  const nodeLayout: Record<string, { y: number; h: number; x: number }> = {};
  for (let col = 0; col < 3; col++) {
    const goods = colNodes[col].filter(n => n.value > 0);
    if (goods.length === 0) continue;
    const colTotal = goods.reduce((s, n) => s + n.value, 0);
    const minH = 14;
    let curY = PAD_TOP;
    for (const n of goods) {
      const h = Math.max(minH, Math.min(usableH * 0.6, (n.value / colTotal) * usableH * 0.85));
      nodeLayout[n.id] = { y: curY, h, x: W * cols[col] };
      curY += h + 6;
    }
  }

  const adjacents = new Set<string>();
  if (hoverNode) {
    adjacents.add(hoverNode);
    for (const link of links) {
      if (link.source === hoverNode) { adjacents.add(link.target); for (const l2 of links) { if (l2.target === link.target && l2.source !== hoverNode) adjacents.add(l2.source); if (l2.source === link.target) adjacents.add(l2.target); } }
      if (link.target === hoverNode) { adjacents.add(link.source); for (const l2 of links) { if (l2.source === link.source && l2.target !== hoverNode) adjacents.add(l2.target); } }
    }
  }

  return (
    <ChartCard icon={ArrowRight} title="能量流向" iconColor="#a78bfa" kind="indigo">
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${W} ${HH}`} className="w-full h-auto" style={{ maxHeight: 260, overflow: 'visible' }}>
          <defs>
            {links.map((l, i) => (
              <linearGradient key={i} id={`skL${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={l.color} stopOpacity="0.7" />
                <stop offset="100%" stopColor={l.color} stopOpacity="0.2" />
              </linearGradient>
            ))}
            <filter id="skGlow"><feGaussianBlur stdDeviation="2" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {links.map((l, i) => {
            const s = nodeLayout[l.source], t = nodeLayout[l.target];
            if (!s || !t) return null;
            const sx = s.x + 12, sy = s.y + s.h / 2, tx = t.x, ty = t.y + t.h / 2;
            const isH = hoverNode && (adjacents.has(l.source) || adjacents.has(l.target));
            const w = Math.max(1, Math.min(14, (l.value / Math.max(totalV, 1)) * 20));
            return (
              <path key={i} d={`M${sx},${sy} C${sx + (tx - sx) * 0.4},${sy} ${sx + (tx - sx) * 0.6},${ty} ${tx},${ty}`}
                fill="none" stroke={`url(#skL${i})`} strokeWidth={isH ? w + 4 : w}
                opacity={hoverNode && !isH ? 0.12 : 0.65} strokeLinecap="round"
                filter={isH ? 'url(#skGlow)' : undefined} style={{ transition: 'all 0.3s ease' }} />
            );
          })}

          {nodes.map(n => {
            const lo = nodeLayout[n.id];
            if (!lo) return null;
            const isH = hoverNode === n.id;
            const isAdj = hoverNode && adjacents.has(n.id) && hoverNode !== n.id;
            const alpha = hoverNode && !isH && !isAdj ? 0.3 : 1;
            return (
              <g key={n.id} style={{ cursor: 'pointer', transition: 'opacity 0.3s', opacity: alpha }}
                onMouseEnter={() => setHoverNode(n.id)} onMouseLeave={() => setHoverNode(null)}>
                <rect x={lo.x} y={lo.y} width={12} height={lo.h} rx={6}
                  fill={n.col === 2 ? '#475569' : n.color} opacity={isH ? 1 : 0.85}
                  filter={isH ? 'url(#skGlow)' : undefined} style={{ transition: 'all 0.2s' }} />
                <text x={n.col === 2 ? lo.x + 18 : lo.x - 4} y={lo.y + lo.h / 2 + 3}
                  textAnchor={n.col === 2 ? 'start' : 'end'} fontSize={8}
                  fill="var(--ck-chart-card-text)" fontWeight={isH ? '800' : '500'}
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                  {n.label}
                </text>
                {isH && (
                  <text x={n.col === 2 ? lo.x + 18 : lo.x - 4} y={lo.y + lo.h / 2 + 14}
                    textAnchor={n.col === 2 ? 'start' : 'end'} fontSize={7} fill="var(--ck-chart-dim)">
                    {n.value}{n.col === 0 ? 'kcal' : n.col === 1 ? 'g' : 'kcal'}
                  </text>
                )}
              </g>
            );
          })}

          {['三餐', '宏量', '能量'].map((l, i) => (
            <text key={l} x={W * cols[i] + 6} y={PAD_TOP - 10} textAnchor="middle" fontSize={7} fill="var(--ck-chart-dim)" fontWeight="600">{l}</text>
          ))}
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 4. 宏量趋势 — 柱状图 + 平滑折线 ════════════════════ */
export function MacroLineChart({ stats, target }: { stats: DayStats[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = svgW(stats.length);
  const macroTargets = useMemo(() => ({
    protein: Math.round(target * 0.25 / 4),
    carbs: Math.round(target * 0.5 / 4),
    fat: Math.round(target * 0.25 / 9),
  }), [target]);

  const macros = [
    { key: 'protein' as const, label: '蛋白质', color: '#fb923c', unit: 'g', target: macroTargets.protein },
    { key: 'carbs' as const, label: '碳水', color: '#818cf8', unit: 'g', target: macroTargets.carbs },
    { key: 'fat' as const, label: '脂肪', color: '#38bdf8', unit: 'g', target: macroTargets.fat },
  ];

  const highest = Math.max(1, ...stats.flatMap(d => macros.map(m => ((d[m.key] as number) || 0) / Math.max(m.target, 1))));
  const maxPct = Math.max(1.3, highest * 1.15);
  const barH = CHART_H;
  const barW = 8, barGap = 2;

  const lines = macros.map(m => {
    const pts = stats.map((d, i) => {
      const v = (d[m.key] as number) || 0;
      const pct = v / Math.max(m.target, 1);
      return { x: px(i), y: barH - (pct / maxPct) * barH, raw: v, idx: i };
    });
    return { ...m, pts, path: pts.length > 1 ? smoothLine(pts, 0.4) : '' };
  });

  return (
    <ChartCard icon={TrendingUp} title="宏量元素趋势" iconColor="#6366F1" kind="indigo" subtitle="% 目标达成率">
      <div className="relative overflow-x-auto no-scrollbar pb-1">
        <svg width={w} viewBox={`0 0 ${w} ${H}`} style={{ height: 120, minWidth: w, overflow: 'visible' }}>
          <defs>
            <filter id="mGlow"><feGaussianBlur stdDeviation="1.5" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* 100% 线 */}
          <line x1={0} y1={barH - (1 / maxPct) * barH} x2={w} y2={barH - (1 / maxPct) * barH}
            stroke="var(--ck-chart-grid)" strokeWidth={1} strokeDasharray="4 3" />
          <text x={4} y={barH - (1 / maxPct) * barH + 10} fontSize={7} fill="var(--ck-chart-dim)" fontWeight="600">100%</text>

          {/* 柱状图 — 三柱分组 */}
          {stats.map((_d, i) => {
            const groupX = px(i) - (barW * 3 + barGap * 2) / 2;
            return macros.map((m, mi) => {
              const v = (_d[m.key] as number) || 0;
              const pct = v / Math.max(m.target, 1);
              const h = Math.max(0, (pct / maxPct) * barH);
              const isH = hover === i;
              return (
                <rect key={`${i}-${mi}`}
                  x={groupX + mi * (barW + barGap)} y={barH - h}
                  width={barW} height={h} rx={1.5}
                  fill={m.color}
                  opacity={isH ? 0.9 : 0.55}
                  style={{ transition: 'opacity 0.2s' }} />
              );
            });
          })}

          {/* 平滑折线 */}
          {lines.map(({ key, color, path }) => (
            path ? <path key={key} d={path} fill="none" stroke={color} strokeWidth={1.8}
              strokeLinecap="round" filter="url(#mGlow)" opacity={0.85} /> : null
          ))}

          {/* Hover 交互 */}
          {hover !== null && (
            <line x1={px(hover)} y1={0} x2={px(hover)} y2={barH} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.3} />
          )}

          {stats.map((_d, i) => {
            const isH = hover === i;
            return (
              <g key={_d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(p => p === i ? null : i)} style={{ cursor: 'crosshair' }}>
                <rect x={px(i) - 16} y={0} width={32} height={barH} fill="transparent" />
                {isH && macros.map((m, mi) => {
                  const v = (_d[m.key] as number) || 0;
                  const pct = v / Math.max(m.target, 1);
                  const py = barH - (pct / maxPct) * barH;
                  return <circle key={mi} cx={px(i)} cy={py} r={3.5} fill="white" stroke={m.color} strokeWidth={2.5} filter="url(#mGlow)" />;
                })}
                {isH && (
                  <>
                    <rect x={px(i) - 32} y={barH + 2} width={64} height={34} rx={6}
                      fill="var(--ck-chart-tooltip-bg)" opacity={0.9} />
                    {macros.map((m, mi) => {
                      const v = (_d[m.key] as number) || 0;
                      return (
                        <text key={mi} x={px(i)} y={barH + 12 + mi * 11} textAnchor="middle" fontSize={7}
                          fill={m.color} fontWeight="700">
                          {m.label}: {v}{m.unit} ({Math.round(v / Math.max(m.target, 1) * 100)}%)
                        </text>
                      );
                    })}
                  </>
                )}
                {_d.intake === 0 && (
                  <circle cx={px(i)} cy={barH - 2} r={2} fill="var(--ck-chart-empty)" opacity={0.5} />
                )}
              </g>
            );
          })}

          {/* 图例 */}
          {macros.map((m, i) => (
            <text key={m.key} x={w - 90 + i * 42} y={H - 4} fontSize={7} fill={m.color} fontWeight="600">{m.label}</text>
          ))}
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 5. 用餐热力图 ════════════════════ */
const MEAL_LABELS = ['早餐', '午餐', '晚餐', '加餐'];
const MEAL_COLORS = ['#fbbf24', '#f97316', '#ef4444', '#a78bfa'];

export function MealHeatmap({ stats, maxDays = 7 }: { stats: DayStats[]; maxDays?: number }) {
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const visible = maxDays > 0 ? stats.slice(-maxDays) : stats;
  const CELL = 28, MG = 3, PAD = 28;
  const w = PAD * 2 + visible.length * (CELL + MG);
  const h = PAD * 2 + 4 * (CELL + MG);

  const mealCals: number[][] = visible.map(d => d.mealCals ?? [0, 0, 0, 0]);
  const maxCal = Math.max(...mealCals.flat(), 50);
  const hasData = mealCals.some(row => row.some(c => c > 0));
  if (!hasData) return null;

  return (
    <ChartCard icon={Calendar} title="用餐节律" iconColor="#8B5CF6" kind="purple">
      <div className="relative overflow-x-auto no-scrollbar">
        <svg width={w} viewBox={`0 0 ${w} ${h}`} className="block" style={{ height: h, minWidth: w, overflow: 'visible' }}>
          <defs>
            <filter id="hmGlow"><feGaussianBlur stdDeviation="1.5" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {visible.map((d, i) => (
            <text key={i} x={PAD + i * (CELL + MG) + CELL / 2} y={14} textAnchor="middle" fontSize={8} fill="var(--ck-chart-dim)">{d.label}</text>
          ))}
          {MEAL_LABELS.map((l, i) => (
            <text key={i} x={10} y={PAD + i * (CELL + MG) + CELL / 2 + 4} textAnchor="end" fontSize={8} fill={MEAL_COLORS[i]} fontWeight="600">{l}</text>
          ))}
          {mealCals.map((row, ri) => row.map((cal, ci) => {
            const intensity = maxCal > 0 ? cal / maxCal : 0;
            const isH = hoverCell?.row === ri && hoverCell?.col === ci;
            const scale = isH ? 1.15 : 1;
            return (
              <g key={`${ri}-${ci}`}
                onMouseEnter={() => cal > 0 && setHoverCell({ row: ri, col: ci })}
                onMouseLeave={() => setHoverCell(null)}
                style={{ cursor: cal > 0 ? 'pointer' : 'default' }}>
                {cal > 0 ? (
                  <rect x={(PAD + ci * (CELL + MG)) - (CELL * (scale - 1)) / 2}
                    y={(PAD + ri * (CELL + MG)) - (CELL * (scale - 1)) / 2}
                    width={CELL * scale} height={CELL * scale} rx={5} fill={MEAL_COLORS[ri]}
                    opacity={0.2 + intensity * 0.8} filter={isH ? 'url(#hmGlow)' : undefined}
                    style={{ transition: 'all 0.25s ease' }} />
                ) : (
                  <rect x={PAD + ci * (CELL + MG)} y={PAD + ri * (CELL + MG)}
                    width={CELL} height={CELL} rx={5} fill="var(--ck-chart-empty)" opacity={0.25} />
                )}
                {isH && cal > 0 && (
                  <rect x={PAD + ci * (CELL + MG) - 2} y={PAD + ri * (CELL + MG) - 2}
                    width={CELL + 4} height={CELL + 4} rx={7} fill="none" stroke={MEAL_COLORS[ri]} strokeWidth={2} />
                )}
                {isH && cal > 0 && (
                  <text x={PAD + ci * (CELL + MG) + CELL / 2} y={PAD + ri * (CELL + MG) + CELL / 2 + 4}
                    textAnchor="middle" fontSize={10} fill="white" fontWeight="800"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{cal}</text>
                )}
              </g>
            );
          }))}
        </svg>
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap opacity-60">
        {MEAL_LABELS.map((l, i) => (
          <span key={l} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--ck-chart-label)' }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: MEAL_COLORS[i] }} />{l}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 6. 热量趋势 — 纯折线 ════════════════════ */
export function CalorieTrendChart({ stats, target }: { stats: DayStats[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = svgW(stats.length);
  const { maxV, tY } = useMemo(() => {
    const vals = [...stats.map(d => d.intake), ...stats.map(d => (d.intake || 0) - (d.net || 0) + (d.burn || 0)), target * 1.2];
    return { maxV: Math.max(...vals, 50), tY: CHART_H - (target / Math.max(...vals, 50)) * CHART_H };
  }, [stats, target]);

  const intakePts = stats.map((d, i) => d.intake > 0 ? { x: px(i), y: CHART_H - (d.intake / maxV) * CHART_H, v: d.intake } : null).filter(Boolean) as { x: number; y: number; v: number }[];
  const burnPts = stats.map((d, i) => {
    const v = (d.intake || 0) - (d.net || 0) + (d.burn || 0);
    return v > 0 ? { x: px(i), y: CHART_H - (v / maxV) * CHART_H, v } : null;
  }).filter(Boolean) as { x: number; y: number; v: number }[];

  const intakeLine = intakePts.length > 1 ? smoothLine(intakePts, 0.4) : '';
  const burnLine = burnPts.length > 1 ? smoothLine(burnPts, 0.4) : '';

  return (
    <div className="relative overflow-x-auto no-scrollbar pb-1">
      <svg width={w} viewBox={`0 0 ${w} ${H}`} style={{ height: 120, minWidth: w, overflow: 'visible' }}>
        <defs>
          <linearGradient id="aTDEE" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.18" /><stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="aIntake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.12" /><stop offset="100%" stopColor="#fb923c" stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="2" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {[0.2, 0.4, 0.6, 0.8].map(p => (
          <line key={p} x1={0} y1={CHART_H * (1 - p)} x2={w} y2={CHART_H * (1 - p)} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 3" />
        ))}

        <line x1={0} y1={tY} x2={w} y2={tY} stroke="#F97316" strokeWidth={1.2} strokeDasharray="6 4" opacity={0.5} />
        <rect x={w - 36} y={tY - 7} width={38} height={14} rx={7} fill="rgba(249,115,22,0.1)" stroke="rgba(249,115,22,0.2)" strokeWidth={0.5} />
        <text x={w - 17} y={tY + 2.5} textAnchor="middle" fontSize={8} fill="#F97316" fontWeight="700">🎯目标</text>

        {burnPts.length > 1 && (
          <polygon points={`${burnPts[0].x},${CHART_H} ${burnPts.map(p => `${p.x},${p.y}`).join(' ')} ${burnPts[burnPts.length - 1].x},${CHART_H}`} fill="url(#aTDEE)" />
        )}
        {intakePts.length > 1 && (
          <polygon points={`${intakePts[0].x},${CHART_H} ${intakePts.map(p => `${p.x},${p.y}`).join(' ')} ${intakePts[intakePts.length - 1].x},${CHART_H}`} fill="url(#aIntake)" />
        )}

        {burnLine && <path d={burnLine} fill="none" stroke="#818cf8" strokeWidth={2.5} strokeLinecap="round" filter="url(#glow)" opacity={0.75} />}
        {intakeLine && <path d={intakeLine} fill="none" stroke="#fb923c" strokeWidth={2} strokeLinecap="round" opacity={0.55} strokeDasharray="5 3" />}

        {hover !== null && (
          <line x1={px(hover)} y1={0} x2={px(hover)} y2={CHART_H} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.3} />
        )}

        {intakePts.map((p, pi) => {
          const idx = stats.findIndex((_d, i) => px(i) === p.x || Math.abs(px(i) - p.x) < 2);
          const isH = hover === idx;
          const isOver = p.v > target;
          return (
            <g key={`dp${pi}`} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r={isH ? 5 : 2.5}
                fill="white" stroke={isOver ? '#ef4444' : '#22c55e'} strokeWidth={isH ? 2.5 : 1.5}
                filter={isH ? 'url(#glow)' : undefined} style={{ transition: 'all 0.25s' }} />
            </g>
          );
        })}

        {stats.map((d, i) => {
          if (d.intake > 0) return null;
          return <circle key={`emp${i}`} cx={px(i)} cy={CHART_H - 2} r={2} fill="var(--ck-chart-empty)" opacity={0.4} />;
        })}

        {stats.map((d, i) => {
          const isH = hover === i;
          const tdeeV = (d.intake || 0) - (d.net || 0) + (d.burn || 0);
          const dotY = d.intake > 0 ? CHART_H - (d.intake / maxV) * CHART_H : CHART_H;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(p => p === i ? null : i)} style={{ cursor: 'crosshair' }}>
              <rect x={px(i) - 16} y={0} width={32} height={CHART_H} fill="transparent" />
              {isH && d.intake > 0 && (
                <>
                  <rect x={px(i) - 50} y={dotY - 38} width={100} height={32} rx={7} fill="var(--ck-chart-tooltip-bg)" opacity={0.9} />
                  <text x={px(i)} y={dotY - 24} textAnchor="middle" fontSize={8} fill="var(--ck-chart-tooltip-fg)" fontWeight="800">
                    摄入 {d.intake} · 消耗 {tdeeV} kcal
                  </text>
                  <text x={px(i)} y={dotY - 13} textAnchor="middle" fontSize={7}
                    fill={d.intake > target ? '#fca5a5' : '#86efac'}>
                    {d.intake > target ? `超标 +${d.intake - target}` : `余额 ${target - d.intake}`}
                  </text>
                </>
              )}
              {isH && d.intake === 0 && (
                <>
                  <rect x={px(i) - 18} y={CHART_H - 20} width={36} height={14} rx={5} fill="var(--ck-chart-tooltip-bg)" opacity={0.8} />
                  <text x={px(i)} y={CHART_H - 9} textAnchor="middle" fontSize={7} fill="var(--ck-chart-dim)">无记录</text>
                </>
              )}
              <text x={px(i)} y={LABEL_Y} textAnchor="middle" fontSize={8.5}
                fill={isH ? 'var(--ck-chart-label-hover)' : d.intake > 0 ? 'var(--ck-chart-label)' : 'var(--ck-chart-empty)'}
                fontWeight={isH ? '700' : '500'}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ════════════════════ 主入口 ════════════════════ */
export default function WeeklyCharts({ stats, targetCalories }: WeeklyChartsProps) {
  if (!stats.length) return null;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 gap-3">
        <CalorieGauge stats={stats} target={targetCalories} />
        <NutritionRadar stats={stats} target={targetCalories} />
      </div>

      <ChartCard icon={Flame} title="热量趋势" iconColor="#F97316" kind="orange">
        <CalorieTrendChart stats={stats} target={targetCalories} />
        <div className="flex items-center gap-3 mt-1 flex-wrap opacity-70">
          {[
            { c: '#22c55e', t: '达标点' }, { c: '#ef4444', t: '超标点' },
            { c: '#F97316', t: '目标', dashed: true }, { c: '#818cf8', t: '消耗趋势' },
            { c: '#fb923c', t: '摄入趋势', dash: true },
          ].map(l => (
            <span key={l.t} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--ck-chart-label)' }}>
              {l.dashed
                ? <span className="w-3 border-t border-dashed" style={{ borderColor: l.c }} />
                : l.dash
                  ? <span className="w-3 border-t border-dashed" style={{ borderColor: l.c, borderWidth: 1.5 }} />
                  : l.t === '达标点' || l.t === '超标点'
                    ? <span className="w-2 h-2 rounded-full border" style={{ background: 'white', borderColor: l.c }} />
                    : <span className="w-3 border-t" style={{ borderColor: l.c, borderWidth: 1.5 }} />}
              {l.t}
            </span>
          ))}
        </div>
      </ChartCard>

      <MacroLineChart stats={stats} target={targetCalories} />

      <div className="grid grid-cols-2 gap-3">
        <MacroSankey stats={stats} />
        <MealHeatmap stats={stats} />
      </div>
    </div>
  );
}
