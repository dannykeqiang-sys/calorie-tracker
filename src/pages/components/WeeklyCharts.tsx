import { useState, useMemo, useEffect } from 'react';
import { Calendar, Radar, ArrowRight, TrendingUp } from 'lucide-react';
import type { DayStats } from './AIHealingCard';

interface WeeklyChartsProps {
  stats: DayStats[];
  targetCalories: number;
  selectedDate?: string;
}

/* ─── 工具 ─── */
const H = 130, LABEL_Y = 116, CHART_H = 82;
function svgW(n: number) { return Math.max(300, n * 48); }
function px(i: number) { return i * 48 + 24; }

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

function clamp(val: number, min: number, max: number) { return Math.min(Math.max(val, min), max); }

/* ─── 卡片壳 ─── */
export function ChartCard({ icon: Icon, title, iconColor, kind = 'indigo', children, subtitle }: {
  icon: React.ElementType; title: string; iconColor: string; kind?: 'orange' | 'purple' | 'indigo'; children: React.ReactNode; subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border shadow-sm p-4 relative overflow-hidden group tactile-hover w-full"
      style={{
        borderColor: 'var(--ck-chart-card-border)',
        background: `var(--ck-card-${kind})`,
        boxShadow: '0 2px 12px rgba(139,130,120,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-300" style={{ transitionTimingFunction: 'var(--ease-spring)', background: `linear-gradient(135deg, ${iconColor}1A, ${iconColor}08)`, boxShadow: `0 2px 10px ${iconColor}12` }}>
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

/* ════════════════════ 1. 营养雷达 — 4轴 与日期联动 ════════════════════ */
export function NutritionRadar({ stats, target, selectedDate }: { stats: DayStats[]; target: number; selectedDate?: string }) {
  const dayIdx = useMemo(() => {
    if (selectedDate) {
      const idx = stats.findIndex(s => s.date === selectedDate);
      return idx >= 0 ? idx : stats.length - 1;
    }
    return stats.length - 1;
  }, [stats, selectedDate]);

  const [hoverAxis, setHoverAxis] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const today = stats[dayIdx];
  if (!today || !today.intake) return null;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const axes = [
    { key: 'protein' as const, label: '蛋白质', max: 150, color: '#fb923c', unit: 'g' },
    { key: 'carbs' as const, label: '碳水', max: 300, color: '#818cf8', unit: 'g' },
    { key: 'fat' as const, label: '脂肪', max: 80, color: '#38bdf8', unit: 'g' },
    { key: 'water' as const, label: '饮水', max: 2500, color: '#0ea5e9', unit: 'ml' },
  ];

  const R = 85, CX = 120, CY = 110, N = axes.length, step = (2 * Math.PI) / N;
  function pt(idx: number, value: number, max: number) {
    const r = R * Math.min(value / Math.max(max, 1), 1);
    const a = -Math.PI / 2 + idx * step;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  }

  const actualPts = axes.map((a, i) => pt(i, animated ? (today[a.key] as number) : 0, a.max));
  const path = actualPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <ChartCard icon={Radar} title="营养雷达" iconColor="#8B5CF6" kind="purple" subtitle={`${today.label} 数据`}>
      <div className="flex justify-center w-full">
        <svg viewBox="0 0 240 220" className="w-full h-auto" style={{ maxWidth: 500 }}>
          <defs>
            <radialGradient id="radarArea" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
            </radialGradient>
            <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <filter id="radarGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* 网格线 */}
          {[0.25, 0.5, 0.75, 1].map(pct => {
            const pts = axes.map((_, i) => `${pt(i, axes[i].max * pct, axes[i].max).x},${pt(i, axes[i].max * pct, axes[i].max).y}`).join(' ');
            return <polygon key={pct} points={pts} fill="none" stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />;
          })}
          {/* 轴线 */}
          {axes.map((a, i) => {
            const p = pt(i, a.max, a.max);
            return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.3} />;
          })}
          {/* 双层填充面积 + 轮廓线 */}
          <polygon points={path} fill="url(#radarArea)" stroke="none" />
          <polygon points={path} fill="none" stroke="url(#radarStroke)" strokeWidth={2.5} strokeLinejoin="round" filter="url(#radarGlow)" opacity={0.95} style={{ transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
          {/* 数据点 */}
          {axes.map((a, i) => {
            const p = pt(i, today[a.key] as number, a.max);
            const isH = hoverAxis === i;
            const pct = Math.round((today[a.key] as number) / a.max * 100);
            return (
              <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoverAxis(i)} onMouseLeave={() => setHoverAxis(null)}
                onTouchStart={() => setHoverAxis(prev => prev === i ? null : i)}>
                <circle cx={p.x} cy={p.y} r={isH ? 8 : 4} fill="white" stroke={a.color} strokeWidth={isH ? 3 : 2}
                  filter={isH ? 'url(#radarGlow)' : undefined} style={{ transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                {isH && (
                  <g>
                    <rect x={p.x - 36} y={p.y - 42} width={72} height={30} rx={10} fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={p.x} y={p.y - 26} textAnchor="middle" fontSize={11} fill="white" fontWeight="800">{today[a.key]}{a.unit}</text>
                    <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize={9} fill={pct >= 95 ? '#86efac' : pct >= 70 ? '#fbbf24' : '#fca5a5'}>
                      {pct}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {/* 轴标签 */}
          {axes.map((a, i) => {
            const p = pt(i, a.max * 1.22, a.max);
            const isH = hoverAxis === i;
            return (
              <g key={i}>
                <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={10} fill="var(--ck-chart-text)" fontWeight={isH ? "900" : "700"} style={{ transition: 'font-weight 0.2s' }}>{a.label}</text>
                <text x={p.x} y={p.y + 11} textAnchor="middle" fontSize={8} fill={a.color} fontWeight="700">{today[a.key]}{a.unit}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 2. 桑基图 — 横版铺满 ════════════════════ */
interface SankeyNode { id: string; label: string; value: number; color: string; col: number; }
interface SankeyLink { source: string; target: string; value: number; color: string; }

export function MacroSankey({ stats, selectedDate }: { stats: DayStats[]; selectedDate?: string }) {
  const dayIdx = useMemo(() => {
    if (selectedDate) {
      const idx = stats.findIndex(s => s.date === selectedDate);
      return idx >= 0 ? idx : stats.length - 1;
    }
    return stats.length - 1;
  }, [stats, selectedDate]);

  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const today = stats[dayIdx];
  if (!today || today.intake === 0) return null;

  const meals = [
    { id: 'breakfast', label: '早餐', value: today.mealCals?.[0] ?? 0, color: '#fbbf24' },
    { id: 'lunch', label: '午餐', value: today.mealCals?.[1] ?? 0, color: '#f97316' },
    { id: 'dinner', label: '晚餐', value: today.mealCals?.[2] ?? 0, color: '#ef4444' },
    { id: 'snack', label: '加餐', value: today.mealCals?.[3] ?? 0, color: '#a78bfa' },
  ];

  const macros = [
    { id: 'protein', label: '蛋白质', value: today.protein, color: '#fb923c', calPerUnit: 4 },
    { id: 'carbs', label: '碳水', value: today.carbs, color: '#818cf8', calPerUnit: 4 },
    { id: 'fat', label: '脂肪', value: today.fat, color: '#38bdf8', calPerUnit: 9 },
  ].filter(m => m.value > 0);

  // Calculate energy destinations
  const bmrEstimate = Math.round(today.intake * 0.6); // 60% for basal metabolism
  const exerciseBurn = today.burn || 0;
  const totalBurn = bmrEstimate + exerciseBurn;
  const balance = today.intake - totalBurn;

  // Determine surplus or deficit
  const isSurplus = balance > 0;
  const balanceNode = {
    id: 'balance',
    label: isSurplus ? `热量盈余` : `热量缺口`,
    value: Math.abs(balance),
    color: isSurplus ? '#ef4444' : '#22c55e', // Red for surplus, green for deficit
    col: 3
  };

  const nodes: SankeyNode[] = [
    ...meals.map(m => ({ ...m, col: 0 })),
    ...macros.map(m => ({ ...m, col: 1 })),
    { id: 'energy', label: '总能量', value: today.intake, color: '#e2e8f0', col: 2 },
    { id: 'bmr', label: '基础代谢', value: bmrEstimate, color: '#10b981', col: 3 },
    { id: 'exercise', label: '运动消耗', value: exerciseBurn, color: '#f59e0b', col: 3 },
    balanceNode,
  ];

  const macroTotal = macros.reduce((s, m) => s + m.value * m.calPerUnit, 0) || 1;
  const links: SankeyLink[] = [];

  // Meals → Macros (only for non-zero meals)
  for (const meal of meals) {
    if (meal.value === 0) continue;
    for (const macro of macros) {
      const share = (macro.value * macro.calPerUnit) / macroTotal;
      const flow = Math.round(meal.value * share);
      if (flow > 0) links.push({ source: meal.id, target: macro.id, value: flow, color: macro.color });
    }
  }

  // Macros → Energy
  for (const macro of macros) {
    const cal = macro.value * macro.calPerUnit;
    if (cal > 0) links.push({ source: macro.id, target: 'energy', value: cal, color: macro.color });
  }

  // Energy → Destinations
  if (bmrEstimate > 0) links.push({ source: 'energy', target: 'bmr', value: bmrEstimate, color: '#10b981' });
  // Always show exercise burn node (even if 0)
  links.push({ source: 'energy', target: 'exercise', value: exerciseBurn, color: '#f59e0b' });
  // Balance (surplus or deficit)
  if (Math.abs(balance) > 0) links.push({ source: 'energy', target: 'balance', value: Math.abs(balance), color: balanceNode.color });

  const HH = 240, PAD_TOP = 32, PAD_BOT = 20;
  const cols = [20, 95, 170, 245];
  const usableH = HH - PAD_TOP - PAD_BOT;
  const totalV = nodes.reduce((s, n) => s + (n.col === 2 || n.col === 3 ? n.value * 0.5 : n.value), 0) || 1;

  const colNodes: SankeyNode[][] = [[], [], [], []];
  for (const n of nodes) colNodes[n.col].push(n);

  const nodeLayout: Record<string, { y: number; h: number; x: number }> = {};
  for (let col = 0; col < 4; col++) {
    const goods = colNodes[col].filter(n => n.value > 0 || col === 0 || n.id === 'exercise'); // Always show meals and exercise
    if (goods.length === 0) continue;
    const colTotal = goods.reduce((s, n) => s + Math.max(n.value, col === 0 ? 10 : 0), 0);
    const minH = col === 0 ? 12 : 18;
    let curY = PAD_TOP;
    for (const n of goods) {
      const displayValue = Math.max(n.value, col === 0 ? 10 : 0);
      const h = Math.max(minH, Math.min(usableH * 0.6, (displayValue / colTotal) * usableH * 0.85));
      nodeLayout[n.id] = { y: curY, h, x: 0 };
      curY += h + 8;
    }
    for (const n of goods) {
      nodeLayout[n.id].x = cols[col];
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
      <div className="flex justify-center w-full">
        <svg viewBox={`0 0 320 ${HH}`} className="w-full h-auto" style={{ maxWidth: 650, overflow: 'visible' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {nodes.map((n, i) => (
              <linearGradient key={`node${i}`} id={`skNode${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={n.col === 2 || n.col === 3 ? (n.col === 3 ? n.color : '#64748b') : n.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={n.col === 2 || n.col === 3 ? (n.col === 3 ? n.color : '#475569') : n.color} stopOpacity="0.75" />
              </linearGradient>
            ))}
            {links.map((l, i) => (
              <linearGradient key={`link${i}`} id={`skLink${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={l.color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={l.color} stopOpacity="0.3" />
              </linearGradient>
            ))}
            <filter id="sankeyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* 流线 */}
          {links.map((l, i) => {
            const s = nodeLayout[l.source], t = nodeLayout[l.target];
            if (!s || !t) return null;
            const sx = s.x + 8, sy = s.y + s.h / 2, tx = t.x, ty = t.y + t.h / 2;
            const isH = hoverNode && (adjacents.has(l.source) || adjacents.has(l.target));
            const w = Math.max(3, Math.min(20, (l.value / Math.max(totalV, 1)) * 24));
            return (
              <path key={i} d={`M${sx},${sy} C${sx + (tx - sx) * 0.4},${sy} ${sx + (tx - sx) * 0.6},${ty} ${tx},${ty}`}
                fill="none" stroke={`url(#skLink${i})`} strokeWidth={isH ? w + 6 : w}
                opacity={hoverNode && !isH ? 0.1 : 0.85} strokeLinecap="round"
                filter={isH ? 'url(#sankeyGlow)' : undefined} style={{ transition: 'all 0.3s ease' }} />
            );
          })}

          {/* 节点 */}
          {nodes.map((n, i) => {
            const lo = nodeLayout[n.id];
            if (!lo) return null;
            const isH = hoverNode === n.id;
            const isAdj = hoverNode && adjacents.has(n.id) && hoverNode !== n.id;
            const alpha = hoverNode && !isH && !isAdj ? 0.3 : 1;
            return (
              <g key={n.id} style={{ cursor: 'pointer', transition: 'opacity 0.3s', opacity: alpha }}
                onMouseEnter={(e) => {
                  setHoverNode(n.id);
                  const rect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: clamp(e.clientX - rect.left, 50, 270), y: clamp(e.clientY - rect.top, 30, HH - 30) });
                }}
                onMouseLeave={() => { setHoverNode(null); setTooltipPos(null); }}
                onTouchStart={() => setHoverNode(prev => prev === n.id ? null : n.id)}>
                <rect x={lo.x} y={lo.y} width={10} height={lo.h} rx={5}
                  fill={`url(#skNode${i})`} opacity={isH ? 1 : 0.88}
                  filter={isH ? 'url(#sankeyGlow)' : undefined} style={{ transition: 'all 0.2s' }} />
                <text x={n.col === 3 ? lo.x + 14 : lo.x - 3} y={lo.y + lo.h / 2 + 4}
                  textAnchor={n.col === 3 ? 'start' : 'end'} fontSize={10}
                  fill="var(--ck-chart-card-text)" fontWeight={isH ? '900' : '700'} style={{ transition: 'font-weight 0.2s' }}>
                  {n.id === 'balance'
                    ? `${n.label} ${isSurplus ? '+' : '-'}${n.value}kcal`
                    : n.label
                  }
                </text>
              </g>
            );
          })}

          {/* Tooltip */}
          {hoverNode && tooltipPos && (() => {
            const node = nodes.find(n => n.id === hoverNode);
            if (!node) return null;
            const unit = node.col === 0 ? 'kcal' : node.col === 1 ? 'g' : 'kcal';
            return (
              <g>
                <rect x={tooltipPos.x - 50} y={tooltipPos.y - 28} width={100} height={26} rx={8}
                  fill="rgba(0,0,0,0.92)" opacity={0.95} />
                <text x={tooltipPos.x} y={tooltipPos.y - 14} textAnchor="middle" fontSize={10} fill="white" fontWeight="800">
                  {node.label}: {node.value}{unit}
                </text>
              </g>
            );
          })()}

          {/* 列标题 */}
          {['三餐', '宏量营养素', '总能量', '能量去向'].map((l, i) => (
            <text key={l} x={cols[i] + 5} y={PAD_TOP - 14} textAnchor="middle" fontSize={10} fill="var(--ck-chart-text)" fontWeight="800">{l}</text>
          ))}
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 3. 宏量趋势 — 柱状图 + 平滑折线 + 日期标签 ════════════════════ */
export function MacroLineChart({ stats, target }: { stats: DayStats[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const w = svgW(stats.length);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

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
    return { ...m, pts, path: pts.length > 1 ? smoothLine(pts, 0.4) : '', areaPath: pts.length > 1 ? smoothLine(pts, 0.4) + ` L${px(pts.length - 1)},${barH} L${px(0)},${barH} Z` : '' };
  });

  return (
    <ChartCard icon={TrendingUp} title="宏量元素趋势" iconColor="#6366F1" kind="indigo" subtitle="% 目标达成率">
      <div className="relative overflow-x-auto no-scrollbar pb-1 w-full">
        <svg width={w} viewBox={`0 0 ${w} ${H}`} style={{ height: H, minWidth: w, overflow: 'visible', width: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {macros.map((m, i) => (
              <linearGradient key={i} id={`macroLine${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={m.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <filter id="macroGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* 100% 线 */}
          <line x1={0} y1={barH - (1 / maxPct) * barH} x2={w} y2={barH - (1 / maxPct) * barH}
            stroke="var(--ck-chart-grid)" strokeWidth={1.5} strokeDasharray="4 3" />
          <rect x={w - 36} y={barH - (1 / maxPct) * barH - 7} width={38} height={14} rx={7} fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.3)" strokeWidth={0.5} />
          <text x={w - 17} y={barH - (1 / maxPct) * barH + 2.5} textAnchor="middle" fontSize={8} fill="#22c55e" fontWeight="700">100%</text>

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
                  x={groupX + mi * (barW + barGap)} y={barH - (animated ? h : 0)}
                  width={barW} height={animated ? h : 0} rx={3}
                  fill={m.color}
                  opacity={isH ? 0.95 : 0.55}
                  filter={isH ? 'url(#macroGlow)' : undefined}
                  style={{ transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s' }} />
              );
            });
          })}

          {/* 面积填充 */}
          {lines.map(({ key, areaPath }, i) => (
            areaPath ? <path key={`area${i}`} d={areaPath} fill={`url(#macroLine${i})`} opacity={0.6} style={{ transition: 'opacity 0.8s ease-out' }} /> : null
          ))}

          {/* 平滑折线 */}
          {lines.map(({ key, color, path }, i) => (
            path ? <path key={key} d={path} fill="none" stroke={color} strokeWidth={2.2}
              strokeLinecap="round" filter="url(#macroGlow)" opacity={0.9} /> : null
          ))}

          {/* Hover 交互 */}
          {hover !== null && (
            <line x1={px(hover)} y1={0} x2={px(hover)} y2={barH} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.3} />
          )}

          {stats.map((_d, i) => {
            const isH = hover === i;
            return (
              <g key={_d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(prev => prev === i ? null : i)} style={{ cursor: 'crosshair' }}>
                <rect x={px(i) - 18} y={0} width={36} height={barH} fill="transparent" />
                {isH && macros.map((m, mi) => {
                  const v = (_d[m.key] as number) || 0;
                  const pct = v / Math.max(m.target, 1);
                  const py = barH - (pct / maxPct) * barH;
                  return <circle key={mi} cx={px(i)} cy={py} r={5} fill="white" stroke={m.color} strokeWidth={2.5} filter="url(#macroGlow)" style={{ transition: 'all 0.2s' }} />;
                })}
                {isH && (
                  <>
                    <rect x={px(i) - 50} y={barH + 2} width={100} height={42} rx={8}
                      fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={px(i)} y={barH + 14} textAnchor="middle" fontSize={9}
                      fill="white" fontWeight="800">{_d.label}</text>
                    {macros.map((m, mi) => {
                      const v = (_d[m.key] as number) || 0;
                      const pct = Math.round(v / Math.max(m.target, 1) * 100);
                      return (
                        <text key={mi} x={px(i)} y={barH + 26 + mi * 10} textAnchor="middle" fontSize={8}
                          fill={m.color} fontWeight="700">
                          {m.label}: {v}{m.unit} ({pct}%)
                        </text>
                      );
                    })}
                  </>
                )}
                {_d.intake === 0 && (
                  <circle cx={px(i)} cy={barH - 2} r={2} fill="var(--ck-chart-empty)" opacity={0.5} />
                )}
                {/* 底部日期标签 */}
                <text x={px(i)} y={LABEL_Y} textAnchor="middle" fontSize={9}
                  fill={isH ? 'var(--ck-chart-label-hover)' : _d.intake > 0 ? 'var(--ck-chart-label)' : 'var(--ck-chart-empty)'}
                  fontWeight={isH ? '700' : '500'}>{_d.label}</text>
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

/* ════════════════════ 4. 用餐热力图 — 全数据铺满 ════════════════════ */
const MEAL_LABELS = ['早餐', '午餐', '晚餐', '加餐'];
const MEAL_COLORS = ['#fbbf24', '#f97316', '#ef4444', '#a78bfa'];

export function MealHeatmap({ stats }: { stats: DayStats[] }) {
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const visible = stats;
  const CELL = 28, MG = 3, PAD = 28;
  const w = PAD * 2 + visible.length * (CELL + MG);
  const h = PAD * 2 + 4 * (CELL + MG);

  const mealCals: number[][] = visible.map(d => d.mealCals ?? [0, 0, 0, 0]);
  const maxCal = Math.max(...mealCals.flat(), 50);
  const hasData = mealCals.some(row => row.some(c => c > 0));
  if (!hasData) return null;

  return (
    <ChartCard icon={Calendar} title="用餐节律" iconColor="#8B5CF6" kind="purple">
      <div className="relative overflow-x-auto no-scrollbar w-full">
        <svg width={w} viewBox={`0 0 ${w} ${h}`} className="block" style={{ height: h, minWidth: w, overflow: 'visible', width: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="heatmapGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
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
            const scale = isH ? 1.2 : 1;
            return (
              <g key={`${ri}-${ci}`}
                onMouseEnter={() => cal > 0 && setHoverCell({ row: ri, col: ci })}
                onMouseLeave={() => setHoverCell(null)}
                onTouchStart={() => cal > 0 && setHoverCell(prev => prev?.row === ri && prev?.col === ci ? null : { row: ri, col: ci })}
                style={{ cursor: cal > 0 ? 'pointer' : 'default' }}>
                {cal > 0 ? (
                  <rect x={(PAD + ri * (CELL + MG)) - (CELL * (scale - 1)) / 2}
                    y={(PAD + ci * (CELL + MG)) - (CELL * (scale - 1)) / 2}
                    width={CELL * scale} height={CELL * scale} rx={6} fill={MEAL_COLORS[ci]}
                    opacity={0.25 + intensity * 0.75} filter={isH ? 'url(#heatmapGlow)' : undefined}
                    style={{ transition: 'all 0.25s ease' }} />
                ) : (
                  <rect x={PAD + ri * (CELL + MG)} y={PAD + ci * (CELL + MG)}
                    width={CELL} height={CELL} rx={6} fill="var(--ck-chart-empty)" opacity={0.15} />
                )}
                {isH && cal > 0 && (
                  <rect x={PAD + ri * (CELL + MG) - 2} y={PAD + ci * (CELL + MG) - 2}
                    width={CELL + 4} height={CELL + 4} rx={8} fill="none" stroke={MEAL_COLORS[ci]} strokeWidth={2} opacity={0.8} />
                )}
                {isH && cal > 0 && (
                  <text x={PAD + ri * (CELL + MG) + CELL / 2} y={PAD + ci * (CELL + MG) + CELL / 2 + 4}
                    textAnchor="middle" fontSize={10} fill="white" fontWeight="800"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{cal}</text>
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

/* ════════════════════ 5. 热量趋势 — 纯折线 ════════════════════ */
export function CalorieTrendChart({ stats, target }: { stats: DayStats[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const w = svgW(stats.length);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

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
  const intakeArea = intakePts.length > 1 ? smoothLine(intakePts, 0.4) + ` L${intakePts[intakePts.length - 1].x},${CHART_H} L${intakePts[0].x},${CHART_H} Z` : '';
  const burnArea = burnPts.length > 1 ? smoothLine(burnPts, 0.4) + ` L${burnPts[burnPts.length - 1].x},${CHART_H} L${burnPts[0].x},${CHART_H} Z` : '';

  return (
    <div className="relative overflow-x-auto no-scrollbar pb-1 w-full">
      <svg width={w} viewBox={`0 0 ${w} ${H}`} style={{ height: H, minWidth: w, overflow: 'visible', width: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="trendBurnArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.25" /><stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trendIntakeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.2" /><stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trendIntakeLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="trendBurnLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <filter id="trendGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {[0.2, 0.4, 0.6, 0.8].map(p => (
          <line key={p} x1={0} y1={CHART_H * (1 - p)} x2={w} y2={CHART_H * (1 - p)} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 3" />
        ))}

        <line x1={0} y1={tY} x2={w} y2={tY} stroke="#F97316" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6} />
        <rect x={w - 42} y={tY - 8} width={44} height={16} rx={8} fill="rgba(249,115,22,0.12)" stroke="rgba(249,115,22,0.3)" strokeWidth={0.5} />
        <text x={w - 20} y={tY + 3} textAnchor="middle" fontSize={9} fill="#F97316" fontWeight="700">🎯目标</text>

        {burnArea && <path d={burnArea} fill="url(#trendBurnArea)" opacity={animated ? 1 : 0} style={{ transition: 'opacity 0.8s ease-out' }} />}
        {intakeArea && <path d={intakeArea} fill="url(#trendIntakeArea)" opacity={animated ? 1 : 0} style={{ transition: 'opacity 0.8s ease-out' }} />}

        {burnLine && <path d={burnLine} fill="none" stroke="url(#trendBurnLine)" strokeWidth={2.8} strokeLinecap="round" filter="url(#trendGlow)" opacity={0.85} />}
        {intakeLine && <path d={intakeLine} fill="none" stroke="url(#trendIntakeLine)" strokeWidth={2.5} strokeLinecap="round" opacity={0.65} strokeDasharray="5 3" />}

        {hover !== null && (
          <line x1={px(hover)} y1={0} x2={px(hover)} y2={CHART_H} stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.3} />
        )}

        {intakePts.map((p, pi) => {
          const idx = stats.findIndex((_d, i) => px(i) === p.x || Math.abs(px(i) - p.x) < 2);
          const isH = hover === idx;
          const isOver = p.v > target;
          return (
            <g key={`dp${pi}`} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r={isH ? 6 : 3}
                fill="white" stroke={isOver ? '#ef4444' : '#22c55e'} strokeWidth={isH ? 3 : 2}
                filter={isH ? 'url(#trendGlow)' : undefined} style={{ transition: 'all 0.25s' }} />
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
              onTouchStart={() => setHover(prev => prev === i ? null : i)} style={{ cursor: 'crosshair' }}>
              <rect x={px(i) - 16} y={0} width={32} height={CHART_H} fill="transparent" />
              {isH && d.intake > 0 && (
                <>
                  <rect x={px(i) - 55} y={dotY - 42} width={110} height={36} rx={8} fill="rgba(0,0,0,0.92)" opacity={0.95} />
                  <text x={px(i)} y={dotY - 28} textAnchor="middle" fontSize={9} fill="white" fontWeight="800">
                    {d.label}
                  </text>
                  <text x={px(i)} y={dotY - 16} textAnchor="middle" fontSize={8} fill="white" fontWeight="700">
                    摄入 {d.intake} · 消耗 {tdeeV} kcal
                  </text>
                  <text x={px(i)} y={dotY - 4} textAnchor="middle" fontSize={8}
                    fill={d.intake > target ? '#fca5a5' : '#86efac'}>
                    {d.intake > target ? `超标 +${d.intake - target}` : `余额 ${target - d.intake}`}
                  </text>
                </>
              )}
              {isH && d.intake === 0 && (
                <>
                  <rect x={px(i) - 18} y={CHART_H - 20} width={36} height={14} rx={5} fill="rgba(0,0,0,0.8)" opacity={0.8} />
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

/* ════════════════════ 6. 旭日图 Sunburst — 近7天营养明细 ════════════════════ */
export function NutritionSunburst({ stats }: { stats: DayStats[] }) {
  const days = stats.slice(-7);
  const totalCal = days.reduce((s, d) => s + d.intake, 0);
  const avgCal = days.length > 0 ? Math.round(totalCal / days.length) : 0;
  if (totalCal === 0) return null;

  const [animated, setAnimated] = useState(false);
  const cx = 150, cy = 150, innerR = 45, midR = 85, outerR = 130;

  // 内环（天）使用柔和渐变色系
  const DAY_COLORS = [
    '#a5b4fc', // 柔和靛蓝
    '#c4b5fd', // 柔和紫
    '#ddd6fe', // 淡紫
    '#f0abfc', // 柔和粉紫
    '#f9a8d4', // 柔和粉
    '#fda4af', // 柔和玫瑰
    '#fdba74', // 柔和橙
  ];

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  let angle = -Math.PI / 2;
  const arcs: { startAngle: number; endAngle: number; innerR: number; outerR: number; color: string; label: string; value: number; dayLabel?: string; isMeal: boolean }[] = [];

  days.forEach((day, di) => {
    if (day.intake === 0) return;
    const dayAngle = (day.intake / totalCal) * 2 * Math.PI;
    const dayColor = DAY_COLORS[di % DAY_COLORS.length];
    arcs.push({ startAngle: angle, endAngle: angle + dayAngle, innerR, outerR: midR, color: dayColor, label: day.label, value: day.intake, dayLabel: day.label, isMeal: false });

    const meals = day.mealCals ?? [0, 0, 0, 0];
    let mealAngle = angle;
    for (let mi = 0; mi < 4; mi++) {
      if (meals[mi] === 0) continue;
      const mAngle = (meals[mi] / day.intake) * dayAngle;
      const mealColor = mi === 0 ? '#fbbf24' : mi === 1 ? '#fb923c' : mi === 2 ? '#ef4444' : '#a78bfa';
      arcs.push({ startAngle: mealAngle, endAngle: mealAngle + mAngle, innerR: midR + 2, outerR: outerR, color: mealColor, label: MEAL_LABELS[mi], value: meals[mi], dayLabel: day.label, isMeal: true });
      mealAngle += mAngle;
    }
    angle += dayAngle;
  });

  function arcPath(startAngle: number, endAngle: number, innerR: number, outerR: number): string {
    const x1 = cx + innerR * Math.cos(startAngle), y1 = cy + innerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(startAngle), y2 = cy + outerR * Math.sin(startAngle);
    const x3 = cx + outerR * Math.cos(endAngle), y3 = cy + outerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(endAngle), y4 = cy + innerR * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M${x1},${y1} L${x2},${y2} A${outerR},${outerR} 0 ${large} 1 ${x3},${y3} L${x4},${y4} A${innerR},${innerR} 0 ${large} 0 ${x1},${y1} Z`;
  }

  const [hoverArc, setHoverArc] = useState<number | null>(null);

  return (
    <ChartCard icon={Calendar} title="营养旭日图" iconColor="#8B5CF6" kind="purple" subtitle="近7天用餐明细">
      <div className="flex justify-center w-full">
        <svg viewBox="0 0 300 320" className="w-full h-auto" style={{ maxWidth: 500, transform: animated ? 'rotate(0deg)' : 'rotate(-180deg)', transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <defs>
            <filter id="sunburstGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {DAY_COLORS.map((color, i) => (
              <linearGradient key={i} id={`dayGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={color} stopOpacity="0.6" />
              </linearGradient>
            ))}
          </defs>

          {/* 中心圆 */}
          <circle cx={cx} cy={cy} r={innerR - 3} fill="var(--ck-chart-tooltip-bg)" stroke="var(--ck-chart-grid)" strokeWidth={0.8} />
          <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill="var(--ck-chart-dim)" fontWeight="600">7天总计</text>
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={14} fill="var(--ck-chart-card-text)" fontWeight="900">{totalCal}</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fontSize={8} fill="var(--ck-chart-dim)">kcal</text>
          <text x={cx} y={cy + 28} textAnchor="middle" fontSize={9} fill="var(--ck-chart-label)" fontWeight="700">均日 {avgCal}</text>

          {arcs.map((a, i) => {
            const isH = hoverArc === i;
            const expand = isH ? 8 : 0;
            const midAngle = (a.startAngle + a.endAngle) / 2;
            const dx = expand * Math.cos(midAngle);
            const dy = expand * Math.sin(midAngle);
            const pct = Math.round((a.value / totalCal) * 100);
            return (
              <g key={i} onMouseEnter={() => setHoverArc(i)} onMouseLeave={() => setHoverArc(null)}
                onTouchStart={() => setHoverArc(prev => prev === i ? null : i)} style={{ cursor: 'pointer' }}
                transform={`translate(${dx},${dy})`}>
                <path d={arcPath(a.startAngle, a.endAngle, a.innerR, a.outerR)}
                  fill={a.isMeal ? a.color : `url(#dayGrad${days.findIndex(d => d.label === a.dayLabel) % DAY_COLORS.length})`}
                  opacity={isH ? 1 : a.isMeal ? 0.9 : 0.75}
                  stroke="var(--ck-chart-tooltip-bg)" strokeWidth={isH ? 3 : 1}
                  filter={isH ? 'url(#sunburstGlow)' : undefined}
                  style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                {a.label && (a.endAngle - a.startAngle) > 0.18 && !isH && (
                  <text
                    x={cx + (a.innerR + a.outerR) / 2 * Math.cos((a.startAngle + a.endAngle) / 2)}
                    y={cy + (a.innerR + a.outerR) / 2 * Math.sin((a.startAngle + a.endAngle) / 2) + 3}
                    textAnchor="middle" fontSize={a.isMeal ? 8 : 9} fill="white" fontWeight={a.isMeal ? "700" : "800"}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{a.label}</text>
                )}
                {isH && (
                  <g>
                    <rect x={cx - 60} y={cy + outerR + 15} width={120} height={44} rx={10}
                      fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={cx} y={cy + outerR + 30} textAnchor="middle" fontSize={10} fill="white" fontWeight="800">
                      {a.dayLabel} · {a.label}
                    </text>
                    <text x={cx} y={cy + outerR + 44} textAnchor="middle" fontSize={9} fill="white" opacity={0.9}>
                      {a.value} kcal
                    </text>
                    <text x={cx} y={cy + outerR + 55} textAnchor="middle" fontSize={8} fill={pct > 20 ? '#86efac' : '#fbbf24'}>
                      占比 {pct}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 图例 - 横向排列 */}
          <g transform={`translate(30, ${cy + outerR + 75})`}>
            {MEAL_LABELS.map((l, i) => {
              const colors = ['#fbbf24', '#fb923c', '#ef4444', '#a78bfa'];
              const x = i * 60;
              return (
                <g key={l} transform={`translate(${x}, 0)`}>
                  <circle cx={4} cy={4} r={4} fill={colors[i]} opacity={0.9} />
                  <text x={12} y={7} fontSize={9} fill="var(--ck-chart-label)" fontWeight="600">{l}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 7. 金字塔图 Pyramid — 营养节律 ════════════════════ */
export function NutritionFunnel({ stats, targetCalories }: { stats: DayStats[]; targetCalories: number }) {
  const [hoverLevel, setHoverLevel] = useState<number | null>(null);
  const hasData = stats.some(d => d.intake > 0);
  if (!hasData) return null;

  const days = stats.filter(d => d.intake > 0).length || 1;
  const avgProtein = Math.round(stats.reduce((s, d) => s + d.protein, 0) / days);
  const avgCarbs = Math.round(stats.reduce((s, d) => s + d.carbs, 0) / days);
  const avgFat = Math.round(stats.reduce((s, d) => s + d.fat, 0) / days);
  const avgIntake = Math.round(stats.reduce((s, d) => s + d.intake, 0) / days);

  const target = targetCalories > 0 ? targetCalories : 2000;
  const tProtein = Math.round(target * 0.25 / 4);
  const tCarbs = Math.round(target * 0.5 / 4);
  const tFat = Math.round(target * 0.25 / 9);

  const levels = [
    { label: '脂肪', value: avgFat, max: tFat, color: '#ef4444', unit: 'g', pct: Math.round(avgFat / Math.max(tFat, 1) * 100) },
    { label: '蛋白质', value: avgProtein, max: tProtein, color: '#3b82f6', unit: 'g', pct: Math.round(avgProtein / Math.max(tProtein, 1) * 100) },
    { label: '碳水', value: avgCarbs, max: tCarbs, color: '#f59e0b', unit: 'g', pct: Math.round(avgCarbs / Math.max(tCarbs, 1) * 100) },
    { label: '总热量', value: avgIntake, max: target, color: '#f97316', unit: 'kcal', pct: Math.round(avgIntake / target * 100) },
  ];

  const W = 300, H = 300;
  const cx = W / 2;
  const maxWidth = 240;
  const layerH = 55;
  const gap = 12;
  const startY = 30;

  return (
    <ChartCard icon={TrendingUp} title="营养节律" iconColor="#6366F1" kind="indigo" subtitle="宏量达成率金字塔">
      <div className="flex justify-center w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxWidth: 500 }}>
          <defs>
            {levels.map((l, i) => (
              <linearGradient key={i} id={`pyramidGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity="0.45" />
                <stop offset="100%" stopColor={l.color} stopOpacity="0.95" />
              </linearGradient>
            ))}
            <filter id="pyramidGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {levels.map((l, i) => {
            // Reverse rendering: array[0] (脂肪) at bottom, array[3] (总热量) at top
            const renderIndex = levels.length - 1 - i;
            const y = startY + renderIndex * (layerH + gap);

            // Pyramid: bottom layers wider, top layers narrower
            const baseScale = 0.34 + renderIndex * 0.22; // top: 34%, bottom: 100%
            const pctScale = Math.min(l.pct / 100, 1.3); // 允许最高130%

            const halfW = (maxWidth / 2) * baseScale * pctScale;

            // 梯形：顶部略窄于底部
            const topHalfW = halfW * 0.92;
            const botHalfW = halfW;

            const x1 = cx - topHalfW, x2 = cx + topHalfW;
            const x3 = cx + botHalfW, x4 = cx - botHalfW;

            const isH = hoverLevel === i;
            const isOver = l.pct > 105;
            const isOnTarget = l.pct >= 95 && l.pct <= 105;

            return (
              <g key={i}
                onMouseEnter={() => setHoverLevel(i)}
                onMouseLeave={() => setHoverLevel(null)}
                onTouchStart={() => setHoverLevel(prev => prev === i ? null : i)}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}>

                {/* 金字塔层 - 梯形 */}
                <path
                  d={`M${x1 + 8},${y} L${x2 - 8},${y} Q${x2},${y} ${x2},${y + 8} L${x3},${y + layerH - 8} Q${x3},${y + layerH} ${x3 - 8},${y + layerH} L${x4 + 8},${y + layerH} Q${x4},${y + layerH} ${x4},${y + layerH - 8} L${x1},${y + 8} Q${x1},${y} ${x1 + 8},${y} Z`}
                  fill={`url(#pyramidGrad${i})`}
                  stroke={l.color}
                  strokeWidth={isH ? 3 : 2}
                  strokeLinejoin="round"
                  filter={isH ? 'url(#pyramidGlow)' : undefined}
                  opacity={isH ? 1 : 0.85}
                  style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />

                {/* 层级标签 */}
                <text
                  x={cx}
                  y={y + layerH / 2 - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fill="white"
                  fontWeight="800"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                  {l.label}
                </text>
                <text
                  x={cx}
                  y={y + layerH / 2 + 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="white"
                  fontWeight="600"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {l.value}{l.unit}
                </text>

                {/* 右侧：进度条 */}
                <g>
                  <rect
                    x={cx + halfW + 15}
                    y={y + layerH / 2 - 5}
                    width={60}
                    height={10}
                    rx={5}
                    fill="rgba(0,0,0,0.1)"
                  />
                  <rect
                    x={cx + halfW + 15}
                    y={y + layerH / 2 - 5}
                    width={Math.min(60, (l.pct / 150) * 60)}
                    height={10}
                    rx={5}
                    fill={l.color}
                    opacity={isH ? 1 : 0.85}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  <text
                    x={cx + halfW + 80}
                    y={y + layerH / 2 + 4}
                    fontSize={10}
                    fill={l.color}
                    fontWeight="700">
                    {l.pct}%
                  </text>
                </g>

                {/* Hover 状态徽章 */}
                {isH && (
                  <g>
                    <rect
                      x={cx + halfW + 15}
                      y={y + layerH / 2 + 12}
                      width={70}
                      height={20}
                      rx={10}
                      fill={isOver ? '#ef4444' : isOnTarget ? '#22c55e' : '#3b82f6'}
                      opacity={0.95}
                    />
                    <text
                      x={cx + halfW + 50}
                      y={y + layerH / 2 + 26}
                      textAnchor="middle"
                      fontSize={10}
                      fill="white"
                      fontWeight="800">
                      {isOver ? `超标 ${l.pct - 100}%` : isOnTarget ? '达标 ✓' : `${l.pct}%`}
                    </text>
                  </g>
                )}

                {/* 目标标签 */}
                <text
                  x={cx + halfW + 15}
                  y={y + layerH - 2}
                  fontSize={8}
                  fill="rgba(255,255,255,0.6)"
                  fontWeight="500">
                  目标 {l.max}{l.unit}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 8. 日K线图 — 每日热量增减趋势 ════════════════════ */
export function DailyKLineChart({ stats, targetCalories }: { stats: DayStats[]; targetCalories: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = stats.filter(d => d.intake > 0);
  if (active.length < 3) return null;

  // 7-day rolling average
  const avgIntake = Math.round(active.reduce((sum, d) => sum + d.intake, 0) / active.length);

  const candles = active.map((d, i) => {
    const meals = d.mealCals ?? [0, 0, 0, 0];
    const nonZero = meals.filter(c => c > 0);

    // Opening: previous day's intake (or current day for first day → doji)
    let open = d.intake;
    if (i > 0) {
      open = active[i - 1].intake;
    } else {
      // First active day: check full stats for previous day
      const currentIndex = stats.findIndex(s => s.date === d.date);
      if (currentIndex > 0 && stats[currentIndex - 1].intake > 0) {
        open = stats[currentIndex - 1].intake;
      }
    }

    const close = d.intake;
    const maxMeal = nonZero.length > 0 ? Math.max(...nonZero) : Math.max(open, close);
    const minMeal = nonZero.length > 0 ? Math.min(...nonZero) : Math.min(open, close);

    // K-line high/low: ensure wicks always encompass body
    const high = Math.max(maxMeal, open, close);
    const low = Math.min(minMeal, open, close);

    return { date: d.date, label: d.label, open, close, high, low, maxMeal, minMeal };
  });

  const maxVal = Math.max(...candles.map(c => c.high), targetCalories, avgIntake, 50);
  const candleW = 14, candleGap = 32;
  const PAD_L = 36, PAD_R = 16, CHART_H = 150, BOTTOM = 44;
  const W = PAD_L + candles.length * candleGap + PAD_R;
  const H = CHART_H + BOTTOM;

  function px(i: number) { return PAD_L + i * candleGap + candleW / 2; }
  function valY(v: number) { return CHART_H - (v / maxVal) * CHART_H; }

  return (
    <ChartCard icon={TrendingUp} title="日K线图" iconColor="#6366F1" kind="indigo" subtitle="每日热量增减趋势">
      <div className="relative overflow-x-auto no-scrollbar w-full">
        <svg width={W} viewBox={`0 0 ${W} ${H}`} style={{ height: H, minWidth: W, overflow: 'visible', width: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="klineGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* 网格 */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <line key={pct} x1={PAD_L - 4} y1={CHART_H * (1 - pct)} x2={W - PAD_R} y2={CHART_H * (1 - pct)}
              stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.35} />
          ))}
          {/* Y轴标签 */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <text key={pct} x={PAD_L - 8} y={CHART_H * (1 - pct) + 3} textAnchor="end" fontSize={7}
              fill="var(--ck-chart-dim)">{Math.round(maxVal * pct)}</text>
          ))}

          {/* 目标线 */}
          <line x1={PAD_L - 4} y1={valY(targetCalories)} x2={W - PAD_R} y2={valY(targetCalories)}
            stroke="#F97316" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6} />
          <rect x={W - PAD_R - 42} y={valY(targetCalories) - 8} width={40} height={16} rx={8}
            fill="rgba(249,115,22,0.12)" stroke="rgba(249,115,22,0.3)" strokeWidth={0.5} />
          <text x={W - PAD_R - 22} y={valY(targetCalories) + 3} textAnchor="middle" fontSize={8}
            fill="#F97316" fontWeight="700">目标</text>

          {/* 7日均值线 */}
          <line x1={PAD_L - 4} y1={valY(avgIntake)} x2={W - PAD_R} y2={valY(avgIntake)}
            stroke="#818cf8" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.5} />
          <rect x={W - PAD_R - 50} y={valY(avgIntake) - 8} width={48} height={16} rx={8}
            fill="rgba(129,140,248,0.12)" stroke="rgba(129,140,248,0.3)" strokeWidth={0.5} />
          <text x={W - PAD_R - 26} y={valY(avgIntake) + 3} textAnchor="middle" fontSize={7.5}
            fill="#818cf8" fontWeight="700">7日均</text>

          {/* K线 */}
          {candles.map((c, i) => {
            const x = px(i);
            const openY = valY(c.open);
            const closeY = valY(c.close);
            const highY = valY(c.high);
            const lowY = valY(c.low);
            // 绿色 = close < open (今天比昨天吃得少，热量减少), 红色 = close > open (今天比昨天吃得多)
            const isGreen = c.close <= c.open;
            const isDoji = c.close === c.open;
            const color = isDoji ? '#9ca3af' : isGreen ? '#22c55e' : '#ef4444';
            const bodyTop = Math.min(openY, closeY);
            const bodyH = Math.max(Math.abs(closeY - openY), 2);
            const isH = hover === i;
            const dimmed = hover !== null && !isH;
            const change = c.close - c.open;
            const changeSign = change > 0 ? '+' : '';

            return (
              <g key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(prev => prev === i ? null : i)}
                style={{ cursor: 'pointer', transition: 'opacity 0.25s', opacity: dimmed ? 0.3 : 1 }}>
                {/* 影线 */}
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth={2.5} opacity={0.75} />
                {/* 实体 */}
                <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} rx={3}
                  fill={color} opacity={isH ? 1 : isGreen ? 0.8 : 0.9}
                  stroke={color} strokeWidth={isH ? 2 : 0.5}
                  filter={isH ? 'url(#klineGlow)' : undefined}
                  style={{ transition: 'all 0.2s' }} />
                {/* 日期标签 — 旋转 -45° */}
                <text x={x} y={CHART_H + 14} textAnchor="end" fontSize={7.5}
                  fill={isH ? 'var(--ck-chart-label-hover)' : 'var(--ck-chart-label)'}
                  fontWeight={isH ? '700' : '500'}
                  transform={`rotate(-45, ${x}, ${CHART_H + 14})`}>{c.label}</text>

                {/* Tooltip */}
                {isH && (
                  <g>
                    {(() => {
                      const ttW = 105, ttH = 78;
                      let ttX = x - ttW / 2;
                      if (ttX < 2) ttX = 2;
                      if (ttX + ttW > W - 2) ttX = W - ttW - 2;
                      const ttY = Math.max(2, highY - ttH - 8);
                      return (
                        <>
                          <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={9}
                            fill="rgba(0,0,0,0.92)" opacity={0.95} />
                          <text x={ttX + ttW / 2} y={ttY + 13} textAnchor="middle" fontSize={9}
                            fill="white" fontWeight="800">{c.date.slice(5)}</text>
                          <text x={ttX + 8} y={ttY + 28} fontSize={8} fill="#9ca3af" fontWeight="600">
                            昨日 {c.open}
                          </text>
                          <text x={ttX + ttW - 8} y={ttY + 28} textAnchor="end" fontSize={8}
                            fill={isGreen ? '#86efac' : '#fca5a5'} fontWeight="600">
                            今日 {c.close}
                          </text>
                          <text x={ttX + 8} y={ttY + 42} fontSize={8} fill="#fbbf24" fontWeight="600">
                            最高餐 {c.maxMeal}
                          </text>
                          <text x={ttX + ttW - 8} y={ttY + 42} textAnchor="end" fontSize={8} fill="#38bdf8" fontWeight="600">
                            最低餐 {c.minMeal}
                          </text>
                          <line x1={ttX + 8} y1={ttY + 50} x2={ttX + ttW - 8} y2={ttY + 50}
                            stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
                          <text x={ttX + ttW / 2} y={ttY + 62} textAnchor="middle" fontSize={8.5}
                            fill={isDoji ? '#9ca3af' : isGreen ? '#86efac' : '#fca5a5'} fontWeight="700">
                            {isDoji ? '持平' : `${changeSign}${change} kcal`}
                          </text>
                          <text x={ttX + ttW / 2} y={ttY + 73} textAnchor="middle" fontSize={7}
                            fill="#818cf8" fontWeight="600">7日均 {avgIntake}</text>
                        </>
                      );
                    })()}
                  </g>
                )}
              </g>
            );
          })}

          {/* 图例 */}
          <g transform={`translate(${PAD_L}, ${H - 6})`}>
            <rect x={0} y={0} width={10} height={7} rx={2} fill="#22c55e" opacity={0.8} />
            <text x={14} y={6} fontSize={7} fill="var(--ck-chart-dim)">今日&lt;昨日</text>
            <rect x={70} y={0} width={10} height={7} rx={2} fill="#ef4444" opacity={0.9} />
            <text x={84} y={6} fontSize={7} fill="var(--ck-chart-dim)">今日&gt;昨日</text>
            <rect x={140} y={2} width={10} height={2} rx={1} fill="#818cf8" opacity={0.7} />
            <text x={154} y={6} fontSize={7} fill="var(--ck-chart-dim)">7日均值</text>
          </g>
        </svg>
      </div>
    </ChartCard>
  );
}

/* ════════════════════ 主入口 ════════════════════ */
export default function WeeklyCharts({ stats, targetCalories, selectedDate }: WeeklyChartsProps) {
  if (!stats.length) return null;

  return (
    <div className="space-y-3 animate-in fade-in duration-500 w-full">
      <NutritionRadar stats={stats} target={targetCalories} selectedDate={selectedDate} />

      <ChartCard icon={TrendingUp} title="热量趋势" iconColor="#F97316" kind="orange">
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

      <MacroSankey stats={stats} selectedDate={selectedDate} />

      <MealHeatmap stats={stats} />
    </div>
  );
}
