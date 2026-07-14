import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, ArrowRight, TrendingUp } from 'lucide-react';
import type { DayStats } from './AIHealingCard';
import type { UserProfile } from '../../types';

interface WeeklyChartsProps {
  stats: DayStats[];
  targetCalories: number;
  selectedDate?: string;
  profile?: UserProfile | null;
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

/* ════════════════════ 2. 桑基图 — 横版铺满 ════════════════════ */
interface SankeyNode { id: string; label: string; value: number; color: string; col: number; }
interface SankeyLink { source: string; target: string; value: number; color: string; }

export function MacroSankey({ stats, selectedDate, profile, onDateChange }: { stats: DayStats[]; selectedDate?: string; profile?: UserProfile | null; onDateChange?: (date: string) => void }) {
  const dayIdx = useMemo(() => {
    if (selectedDate) {
      const idx = stats.findIndex(s => s.date === selectedDate);
      return idx >= 0 ? idx : stats.length - 1;
    }
    return stats.length - 1;
  }, [stats, selectedDate]);

  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !onDateChange) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      const newIdx = diff > 0
        ? Math.min(dayIdx + 1, stats.length - 1)
        : Math.max(dayIdx - 1, 0);
      onDateChange(stats[newIdx].date);
    }
    setTouchStart(null);
  };

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

  // Calculate BMR using Mifflin-St Jeor formula
  let bmrEstimate: number;
  if (profile) {
    const bmr = profile.gender === 'male'
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    bmrEstimate = Math.round(bmr);
  } else {
    bmrEstimate = 1500;
  }
  const exerciseBurn = today.burn || 0;
  const totalBurn = bmrEstimate + exerciseBurn;
  const balance = today.intake - totalBurn;

  const isSurplus = balance > 0;
  const balanceNode = {
    id: 'balance',
    label: isSurplus ? `热量盈余` : `热量缺口`,
    value: Math.abs(balance),
    color: isSurplus ? '#ef4444' : '#22c55e',
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

  for (const meal of meals) {
    if (meal.value === 0) continue;
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

  if (bmrEstimate > 0) links.push({ source: 'energy', target: 'bmr', value: bmrEstimate, color: '#10b981' });
  links.push({ source: 'energy', target: 'exercise', value: exerciseBurn, color: '#f59e0b' });
  if (Math.abs(balance) > 0) links.push({ source: 'energy', target: 'balance', value: Math.abs(balance), color: balanceNode.color });

  // Mobile-aware layout
  const SVG_W = isMobile ? 340 : 320;
  const HH = isMobile ? 280 : 240;
  const PAD_TOP = isMobile ? 48 : 32;
  const PAD_BOT = isMobile ? 60 : 20;
  const cols = isMobile ? [25, 110, 195, 280] : [20, 95, 170, 245];
  const usableH = HH - PAD_TOP - PAD_BOT;
  const nodeGap = isMobile ? 10 : 8;
  const totalV = nodes.reduce((s, n) => s + (n.col === 2 || n.col === 3 ? n.value * 0.5 : n.value), 0) || 1;

  const colNodes: SankeyNode[][] = [[], [], [], []];
  for (const n of nodes) colNodes[n.col].push(n);

  const nodeLayout: Record<string, { y: number; h: number; x: number }> = {};
  for (let col = 0; col < 4; col++) {
    const goods = colNodes[col].filter(n => n.value > 0 || col === 0 || n.id === 'exercise');
    if (goods.length === 0) continue;
    const colTotal = goods.reduce((s, n) => s + Math.max(n.value, col === 0 ? 10 : 0), 0);
    const minH = col === 0 ? (isMobile ? 14 : 12) : (isMobile ? 22 : 18);
    let curY = PAD_TOP;
    for (const n of goods) {
      const displayValue = Math.max(n.value, col === 0 ? 10 : 0);
      const h = Math.max(minH, Math.min(usableH * 0.6, (displayValue / colTotal) * usableH * 0.85));
      nodeLayout[n.id] = { y: curY, h, x: 0 };
      curY += h + nodeGap;
    }
    for (const n of goods) {
      nodeLayout[n.id].x = cols[col];
    }
  }

  const adjacents = new Set<string>();
  const activeNode = hoverNode || expandedNode;
  if (activeNode) {
    adjacents.add(activeNode);
    for (const link of links) {
      if (link.source === activeNode) { adjacents.add(link.target); for (const l2 of links) { if (l2.target === link.target && l2.source !== activeNode) adjacents.add(l2.source); if (l2.source === link.target) adjacents.add(l2.target); } }
      if (link.target === activeNode) { adjacents.add(link.source); for (const l2 of links) { if (l2.source === link.source && l2.target !== activeNode) adjacents.add(l2.target); } }
    }
  }

  // Get inflow/outflow for expanded node
  const getNodeFlows = (nodeId: string) => {
    const inflows = links.filter(l => l.target === nodeId);
    const outflows = links.filter(l => l.source === nodeId);
    return { inflows, outflows };
  };

  return (
    <ChartCard icon={ArrowRight} title="能量流向" iconColor="#a78bfa" kind="indigo">
      <div
        ref={containerRef}
        className="flex justify-center w-full relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {isMobile && (
          <div className="absolute top-0 left-0 right-0 text-center text-[10px] text-muted-foreground pointer-events-none">
            ← 左右滑动切换日期 →
          </div>
        )}
        <svg viewBox={`0 0 ${SVG_W} ${HH}`} className="w-full h-auto" style={{ maxWidth: 650, overflow: 'visible' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {nodes.map((n, i) => (
              <linearGradient key={`node${i}`} id={`skNode${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={n.col === 2 || n.col === 3 ? (n.col === 3 ? n.color : '#64748b') : n.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={n.col === 2 || n.col === 3 ? (n.col === 3 ? n.color : '#475569') : n.color} stopOpacity="0.75" />
              </linearGradient>
            ))}
            {links.map((l, i) => {
              const sg = nodeLayout[l.source], tg = nodeLayout[l.target];
              const gx1 = sg ? sg.x + 10 : 0;
              const gx2 = tg ? tg.x : SVG_W;
              return (
                <linearGradient key={`link${i}`} id={`skLink${i}`} gradientUnits="userSpaceOnUse" x1={gx1} y1="0" x2={gx2} y2="0">
                  <stop offset="0%" stopColor={l.color} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={l.color} stopOpacity="0.3" />
                </linearGradient>
              );
            })}
            <filter id="sankeyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {isMobile && (
              <filter id="balanceGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            )}
          </defs>

          {/* 流线 */}
          {links.map((l, i) => {
            const s = nodeLayout[l.source], t = nodeLayout[l.target];
            if (!s || !t) return null;
            const sx = s.x + 10, sy = s.y + s.h / 2, tx = t.x, ty = t.y + t.h / 2;
            const isNodeH = activeNode && (adjacents.has(l.source) || adjacents.has(l.target));
            const isLinkH = hoverLink === i;
            const isH = isNodeH || isLinkH;
            const baseW = Math.max(isMobile ? 4 : 3, Math.min(20, (l.value / Math.max(totalV, 1)) * (isMobile ? 28 : 24)));
            const w = isMobile ? baseW * 1.2 : baseW;
            return (
              <path key={i} d={`M${sx},${sy} C${sx + (tx - sx) * 0.4},${sy} ${sx + (tx - sx) * 0.6},${ty} ${tx},${ty}`}
                fill="none" stroke={`url(#skLink${i})`} strokeWidth={isH ? w + 6 : w}
                opacity={activeNode && !isH ? 0.1 : 0.85} strokeLinecap="round"
                filter={isH ? 'url(#sankeyGlow)' : undefined}
                style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  setHoverLink(i);
                  const rect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: clamp(e.clientX - rect.left, 50, SVG_W - 50), y: clamp(e.clientY - rect.top, 30, HH - 30) });
                }}
                onMouseLeave={() => { setHoverLink(null); setTooltipPos(null); }}
                onTouchStart={() => setHoverLink(prev => prev === i ? null : i)}
              />
            );
          })}

          {/* 节点 */}
          {nodes.map((n, i) => {
            const lo = nodeLayout[n.id];
            if (!lo) return null;
            const isH = activeNode === n.id;
            const isAdj = activeNode && adjacents.has(n.id) && activeNode !== n.id;
            const alpha = activeNode && !isH && !isAdj ? 0.3 : 1;
            const isBalance = n.id === 'balance';
            const isExpanded = expandedNode === n.id;
            const showLabel = !isMobile || isH || isExpanded || isBalance;
            const fontSize = isMobile ? (isBalance ? 11 : 9) : (isBalance ? 12 : 10);
            const nodeWidth = isMobile ? (isBalance ? 14 : 10) : 10;

            return (
              <g key={n.id} style={{ cursor: 'pointer', transition: 'opacity 0.3s', opacity: alpha }}
                onMouseEnter={(e) => {
                  setHoverNode(n.id);
                  const rect = e.currentTarget.closest('svg')?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: clamp(e.clientX - rect.left, 50, SVG_W - 50), y: clamp(e.clientY - rect.top, 30, HH - 30) });
                }}
                onMouseLeave={() => { setHoverNode(null); setTooltipPos(null); }}
                onClick={() => {
                  if (isMobile) {
                    setExpandedNode(prev => prev === n.id ? null : n.id);
                  }
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (isMobile) {
                    setExpandedNode(prev => prev === n.id ? null : n.id);
                  } else {
                    setHoverNode(prev => prev === n.id ? null : n.id);
                  }
                }}>
                <rect x={lo.x} y={lo.y} width={nodeWidth} height={lo.h} rx={nodeWidth / 2}
                  fill={`url(#skNode${i})`} opacity={isH ? 1 : 0.88}
                  filter={isH ? (isBalance && isMobile ? 'url(#balanceGlow)' : 'url(#sankeyGlow)') : undefined}
                  style={{ transition: 'all 0.2s' }} />
                {showLabel && (
                  <text x={n.col === 3 ? lo.x + nodeWidth + 4 : lo.x - 3} y={lo.y + lo.h / 2 + 4}
                    textAnchor={n.col === 3 ? 'start' : 'end'} fontSize={fontSize}
                    fill="var(--ck-chart-card-text)" fontWeight={isH ? '900' : '700'} style={{ transition: 'font-weight 0.2s' }}>
                    {n.id === 'balance'
                      ? `${n.label} ${isSurplus ? '+' : '-'}${n.value}kcal`
                      : n.label
                    }
                  </text>
                )}
                {isBalance && isMobile && (
                  <circle cx={lo.x + nodeWidth / 2} cy={lo.y + lo.h / 2} r={3} fill={n.color} opacity={0.8}>
                    <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Tooltip - fixed at bottom on mobile */}
          {((hoverNode || hoverLink !== null || expandedNode) && (isMobile ? true : tooltipPos)) && (() => {
            const nodeId = hoverNode || expandedNode;
            if (nodeId) {
              const node = nodes.find(n => n.id === nodeId);
              if (!node) return null;
              const unit = node.col === 0 ? 'kcal' : node.col === 1 ? 'g' : 'kcal';
              const flows = getNodeFlows(nodeId);
              const isExpandedView = expandedNode === nodeId && isMobile;

              if (isMobile) {
                // Fixed bottom tooltip on mobile
                return (
                  <g>
                    <rect x={SVG_W / 2 - 100} y={HH - PAD_BOT + 8} width={200} height={isExpandedView ? 50 : 26} rx={8}
                      fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={SVG_W / 2} y={HH - PAD_BOT + 22} textAnchor="middle" fontSize={11} fill="white" fontWeight="800">
                      {node.label}: {node.value}{unit}
                    </text>
                    {isExpandedView && (
                      <>
                        {flows.inflows.length > 0 && (
                          <text x={SVG_W / 2 - 90} y={HH - PAD_BOT + 36} fontSize={9} fill="#9ca3af" fontWeight="600">
                            ← {flows.inflows.map(l => nodes.find(n => n.id === l.source)?.label).join(', ')}
                          </text>
                        )}
                        {flows.outflows.length > 0 && (
                          <text x={SVG_W / 2 + 90} y={HH - PAD_BOT + 36} textAnchor="end" fontSize={9} fill="#9ca3af" fontWeight="600">
                            {flows.outflows.map(l => nodes.find(n => n.id === l.target)?.label).join(', ')} →
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              } else if (tooltipPos) {
                // Desktop tooltip at cursor
                return (
                  <g>
                    <rect x={tooltipPos.x - 50} y={tooltipPos.y - 28} width={100} height={26} rx={8}
                      fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={tooltipPos.x} y={tooltipPos.y - 14} textAnchor="middle" fontSize={10} fill="white" fontWeight="800">
                      {node.label}: {node.value}{unit}
                    </text>
                  </g>
                );
              }
            } else if (hoverLink !== null) {
              const link = links[hoverLink];
              if (!link) return null;
              const sourceNode = nodes.find(n => n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target);
              if (!sourceNode || !targetNode) return null;

              if (isMobile) {
                return (
                  <g>
                    <rect x={SVG_W / 2 - 80} y={HH - PAD_BOT + 8} width={160} height={38} rx={8}
                      fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={SVG_W / 2} y={HH - PAD_BOT + 22} textAnchor="middle" fontSize={9} fill="white" fontWeight="700">
                      {sourceNode.label} → {targetNode.label}
                    </text>
                    <text x={SVG_W / 2} y={HH - PAD_BOT + 36} textAnchor="middle" fontSize={10} fill={link.color} fontWeight="800">
                      {link.value} kcal
                    </text>
                  </g>
                );
              } else if (tooltipPos) {
                return (
                  <g>
                    <rect x={tooltipPos.x - 60} y={tooltipPos.y - 34} width={120} height={38} rx={8}
                      fill="rgba(0,0,0,0.92)" opacity={0.95} />
                    <text x={tooltipPos.x} y={tooltipPos.y - 20} textAnchor="middle" fontSize={9} fill="white" fontWeight="700">
                      {sourceNode.label} → {targetNode.label}
                    </text>
                    <text x={tooltipPos.x} y={tooltipPos.y - 6} textAnchor="middle" fontSize={10} fill={link.color} fontWeight="800">
                      {link.value} kcal
                    </text>
                  </g>
                );
              }
            }
            return null;
          })()}

          {/* 列标题 */}
          {['三餐', '宏量营养素', '总能量', '能量去向'].map((l, i) => (
            <text key={l} x={cols[i] + 5} y={PAD_TOP - (isMobile ? 18 : 14)} textAnchor="middle" fontSize={isMobile ? 9 : 10} fill="var(--ck-chart-text)" fontWeight="800">{l}</text>
          ))}
        </svg>
      </div>
    </ChartCard>
  );
}

export function MacroLineChart({ stats, target, onDateClick, activeDate }: { stats: DayStats[]; target: number; onDateClick?: (date: string) => void; activeDate?: string }) {
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
            const isActive = activeDate === _d.date;
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
                  opacity={isActive ? 1 : isH ? 0.95 : 0.55}
                  filter={isH || isActive ? 'url(#macroGlow)' : undefined}
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
            const isActive = activeDate === _d.date;
            return (
              <g key={_d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(prev => prev === i ? null : i)}
                onClick={() => _d.intake > 0 && onDateClick?.(_d.date)}
                style={{ cursor: _d.intake > 0 ? 'pointer' : 'default' }}>
                <rect x={px(i) - 18} y={0} width={36} height={barH} fill="transparent" />
                {/* Active date underline */}
                {isActive && _d.intake > 0 && (
                  <rect x={px(i) - 14} y={barH + 1} width={28} height={2} rx={1}
                    fill="#6366F1" opacity={0.7} />
                )}
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

export function MealHeatmap({ stats, onDateClick, activeDate }: { stats: DayStats[]; onDateClick?: (date: string) => void; activeDate?: string }) {
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
          {visible.map((d, i) => {
            const isActiveCol = activeDate === d.date;
            return (
              <text key={i} x={PAD + i * (CELL + MG) + CELL / 2} y={14} textAnchor="middle" fontSize={8}
                fill={isActiveCol ? '#8B5CF6' : 'var(--ck-chart-dim)'} fontWeight={isActiveCol ? '800' : '500'}>{d.label}</text>
            );
          })}
          {MEAL_LABELS.map((l, i) => (
            <text key={i} x={10} y={PAD + i * (CELL + MG) + CELL / 2 + 4} textAnchor="end" fontSize={8} fill={MEAL_COLORS[i]} fontWeight="600">{l}</text>
          ))}
          {mealCals.map((row, ri) => row.map((cal, ci) => {
            const intensity = maxCal > 0 ? cal / maxCal : 0;
            const isH = hoverCell?.row === ri && hoverCell?.col === ci;
            const isActiveCol = activeDate === visible[ri]?.date;
            const scale = isH ? 1.2 : 1;
            return (
              <g key={`${ri}-${ci}`}
                onMouseEnter={() => cal > 0 && setHoverCell({ row: ri, col: ci })}
                onMouseLeave={() => setHoverCell(null)}
                onTouchStart={() => cal > 0 && setHoverCell(prev => prev?.row === ri && prev?.col === ci ? null : { row: ri, col: ci })}
                onClick={() => cal > 0 && onDateClick?.(visible[ri].date)}
                style={{ cursor: cal > 0 ? 'pointer' : 'default' }}>
                {cal > 0 ? (
                  <rect x={(PAD + ri * (CELL + MG)) - (CELL * (scale - 1)) / 2}
                    y={(PAD + ci * (CELL + MG)) - (CELL * (scale - 1)) / 2}
                    width={CELL * scale} height={CELL * scale} rx={6} fill={MEAL_COLORS[ci]}
                    opacity={isActiveCol ? Math.min(0.25 + intensity * 0.75 + 0.2, 1) : 0.25 + intensity * 0.75}
                    filter={isH || isActiveCol ? 'url(#heatmapGlow)' : undefined}
                    style={{ transition: 'all 0.25s ease' }} />
                ) : (
                  <rect x={PAD + ri * (CELL + MG)} y={PAD + ci * (CELL + MG)}
                    width={CELL} height={CELL} rx={6} fill="var(--ck-chart-empty)" opacity={0.15} />
                )}
                {(isH || isActiveCol) && cal > 0 && (
                  <rect x={PAD + ri * (CELL + MG) - 2} y={PAD + ci * (CELL + MG) - 2}
                    width={CELL + 4} height={CELL + 4} rx={8} fill="none" stroke={MEAL_COLORS[ci]} strokeWidth={isActiveCol ? 2.5 : 2} opacity={0.8} />
                )}
                {(isH || isActiveCol) && cal > 0 && (
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
export function CalorieTrendChart({ stats, target, onDateClick, activeDate }: { stats: DayStats[]; target: number; onDateClick?: (date: string) => void; activeDate?: string }) {
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
          const isActive = idx >= 0 && activeDate === stats[idx].date;
          const isOver = p.v > target;
          return (
            <g key={`dp${pi}`} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r={isActive ? 7 : isH ? 6 : 3}
                fill="white" stroke={isOver ? '#ef4444' : '#22c55e'} strokeWidth={isH || isActive ? 3 : 2}
                filter={isH || isActive ? 'url(#trendGlow)' : undefined} style={{ transition: 'all 0.25s' }} />
            </g>
          );
        })}

        {stats.map((d, i) => {
          if (d.intake > 0) return null;
          return <circle key={`emp${i}`} cx={px(i)} cy={CHART_H - 2} r={2} fill="var(--ck-chart-empty)" opacity={0.4} />;
        })}

        {stats.map((d, i) => {
          const isH = hover === i;
          const isActive = activeDate === d.date;
          const tdeeV = (d.intake || 0) - (d.net || 0) + (d.burn || 0);
          const dotY = d.intake > 0 ? CHART_H - (d.intake / maxV) * CHART_H : CHART_H;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(prev => prev === i ? null : i)}
              onClick={() => d.intake > 0 && onDateClick?.(d.date)}
              style={{ cursor: d.intake > 0 ? 'pointer' : 'default' }}>
              <rect x={px(i) - 16} y={0} width={32} height={CHART_H} fill="transparent" />
              {/* Active date highlight ring */}
              {isActive && d.intake > 0 && (
                <circle cx={px(i)} cy={dotY} r={10}
                  fill="none" stroke={d.intake > target ? '#ef4444' : '#22c55e'} strokeWidth={1.5} opacity={0.4}
                  style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              )}
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

/* ════════════════════ 6. 堆叠面积图 StackedArea — 近7天用餐构成 ════════════════════ */
export function NutritionStackedArea({ stats }: { stats: DayStats[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const days = stats.slice(-7);
  const hasData = days.some(d => d.intake > 0);
  if (!hasData) return null;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // 累积数据：每层从底部向上堆叠
  const layers = days.map(d => {
    const meals = d.mealCals ?? [0, 0, 0, 0];
    const cum = [0, 0, 0, 0, 0];
    for (let i = 0; i < 4; i++) cum[i + 1] = cum[i] + meals[i];
    return { date: d.date, label: d.label, meals, cum, total: cum[4] };
  });

  const maxY = Math.max(...layers.map(l => l.total), 50) * 1.1;
  const w = svgW(days.length);
  const CHART_AREA_H = 90;
  const PAD_TOP = 10, PAD_BOT = 22;
  const svgH = PAD_TOP + CHART_AREA_H + PAD_BOT;

  function valY(v: number) { return PAD_TOP + CHART_AREA_H - (v / maxY) * CHART_AREA_H; }

  // 为每层生成闭合面积路径（上边界曲线 + 下边界曲线反向）
  const layerPaths = MEAL_LABELS.map((_, mi) => {
    const topPts = layers.map((l, i) => ({ x: px(i), y: valY(l.cum[mi + 1]) }));
    const botPts = layers.map((l, i) => ({ x: px(i), y: valY(l.cum[mi]) }));
    if (topPts.length < 2) return { fill: '', visible: false };
    const topLine = smoothLine(topPts, 0.4);
    const botLine = smoothLine([...botPts].reverse(), 0.4);
    const fill = `${topLine} L${botPts[botPts.length - 1].x},${botPts[botPts.length - 1].y} ` +
      `${botLine} L${topPts[0].x},${topPts[0].y} Z`;
    return { fill, visible: true };
  });

  const totalCal = days.reduce((s, d) => s + d.intake, 0);
  const avgCal = Math.round(totalCal / days.length);

  return (
    <ChartCard icon={Calendar} title="营养堆叠" iconColor="#8B5CF6" kind="purple" subtitle="近7天用餐构成">
      <div className="relative overflow-x-auto no-scrollbar w-full">
        <svg width={w} viewBox={`0 0 ${w} ${svgH}`} style={{ height: svgH, minWidth: w, overflow: 'visible', width: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {MEAL_COLORS.map((color, i) => (
              <linearGradient key={i} id={`stackGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={color} stopOpacity="0.5" />
              </linearGradient>
            ))}
            <filter id="stackGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* 网格线 */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <line key={pct} x1={0} y1={valY(maxY * pct)} x2={w} y2={valY(maxY * pct)}
              stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.35} />
          ))}
          {/* Y轴标签 */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <text key={pct} x={4} y={valY(maxY * pct) - 2} fontSize={7}
              fill="var(--ck-chart-dim)">{Math.round(maxY * pct)}</text>
          ))}

          {/* 堆叠面积（加餐在底，早餐在顶） */}
          {MEAL_LABELS.map((_, mi) => {
            const renderIdx = 3 - mi;
            const { fill, visible } = layerPaths[renderIdx];
            if (!visible) return null;
            const isDimmed = hover !== null;
            return (
              <path key={renderIdx} d={fill}
                fill={`url(#stackGrad${renderIdx})`}
                opacity={animated ? (isDimmed ? 0.5 : 0.75) : 0}
                style={{ transition: 'opacity 0.6s ease-out' }} />
            );
          })}

          {/* 顶层描边线 */}
          {(() => {
            const topPts = layers.map((l, i) => ({ x: px(i), y: valY(l.cum[4]) }));
            if (topPts.length < 2) return null;
            return <path d={smoothLine(topPts, 0.4)} fill="none" stroke="var(--ck-chart-grid)"
              strokeWidth={1} opacity={0.4} />;
          })()}

          {/* 交互层 */}
          {days.map((d, i) => {
            const isH = hover === i;
            const x = px(i);
            return (
              <g key={d.date}
                onMouseEnter={() => d.intake > 0 && setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => d.intake > 0 && setHover(prev => prev === i ? null : i)}
                style={{ cursor: d.intake > 0 ? 'pointer' : 'default' }}>
                <rect x={x - 18} y={PAD_TOP} width={36} height={CHART_AREA_H} fill="transparent" />

                {isH && (
                  <line x1={x} y1={PAD_TOP} x2={x} y2={PAD_TOP + CHART_AREA_H}
                    stroke="var(--ck-chart-grid)" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
                )}

                <text x={x} y={svgH - 6} textAnchor="middle" fontSize={8.5}
                  fill={isH ? 'var(--ck-chart-label-hover)' : 'var(--ck-chart-label)'}
                  fontWeight={isH ? '700' : '500'}>{d.label}</text>

                {isH && (() => {
                  const meals = d.mealCals ?? [0, 0, 0, 0];
                  const ttW = 110, ttH = 76;
                  let ttX = x - ttW / 2;
                  if (ttX < 2) ttX = 2;
                  if (ttX + ttW > w - 2) ttX = w - ttW - 2;
                  const ttY = Math.max(2, valY(d.intake) - ttH - 10);
                  return (
                    <g>
                      <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={9}
                        fill="rgba(0,0,0,0.92)" opacity={0.95} />
                      <text x={ttX + ttW / 2} y={ttY + 13} textAnchor="middle" fontSize={9}
                        fill="white" fontWeight="800">{d.label}</text>
                      {MEAL_LABELS.map((l, mi) => (
                        <text key={mi} x={ttX + 10} y={ttY + 26 + mi * 12} fontSize={8}
                          fill={MEAL_COLORS[mi]} fontWeight="600">
                          {l} {meals[mi]}
                          <tspan fill="rgba(255,255,255,0.5)" fontSize={7}> kcal</tspan>
                        </text>
                      ))}
                      <line x1={ttX + 8} y1={ttY + 63} x2={ttX + ttW - 8} y2={ttY + 63}
                        stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
                      <text x={ttX + ttW / 2} y={ttY + 74} textAnchor="middle" fontSize={8.5}
                        fill="white" fontWeight="700">总计 {d.intake} kcal</text>
                    </g>
                  );
                })()}

                {d.intake > 0 && (
                  <circle cx={x} cy={valY(d.intake)} r={isH ? 4.5 : 2.5}
                    fill="white" stroke="#8B5CF6" strokeWidth={isH ? 2.5 : 1.5}
                    filter={isH ? 'url(#stackGlow)' : undefined}
                    style={{ transition: 'all 0.2s' }} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap opacity-70">
          {MEAL_LABELS.map((l, i) => (
            <span key={l} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--ck-chart-label)' }}>
              <span className="w-2.5 h-2 rounded-sm" style={{ background: MEAL_COLORS[i] }} />{l}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--ck-chart-dim)' }}>
          7日均 {avgCal} kcal
        </span>
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
            // i=0 (脂肪) → top/narrowest, i=3 (总热量) → bottom/widest
            const renderIndex = i;
            const y = startY + renderIndex * (layerH + gap);

            // 宽度由达成百分比驱动，位置因子保证金尼字形
            const pctRatio = Math.min(l.pct / 100, 1.3);
            const positionFactor = 1 + renderIndex * 0.08;
            const minScale = 0.28 + renderIndex * 0.16;
            const scale = Math.max(pctRatio * positionFactor, minScale);

            const halfW = (maxWidth / 2) * scale;

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
export function DailyKLineChart({ stats, targetCalories, onDateClick, activeDate }: { stats: DayStats[]; targetCalories: number; onDateClick?: (date: string) => void; activeDate?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);
  const active = stats.filter(d => d.intake > 0);
  if (active.length < 3) return null;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const target = targetCalories > 0 ? targetCalories : 2000;

  // 7-day rolling moving average (per-point)
  const movingAvg = active.map((_, i) => {
    const windowSize = Math.min(7, i + 1);
    const window = active.slice(Math.max(0, i - windowSize + 1), i + 1);
    return Math.round(window.reduce((s, d) => s + d.intake, 0) / window.length);
  });

  // Data points
  const points = active.map((d, i) => ({
    date: d.date,
    label: d.label,
    intake: d.intake,
    meals: d.mealCals ?? [0, 0, 0, 0],
    avg: movingAvg[i],
    overTarget: d.intake > target,
  }));

  // Trend detection: last 3 points
  const last3 = points.slice(-3);
  const trendUp = last3.length >= 3 && last3[1].intake > last3[0].intake && last3[2].intake > last3[1].intake;
  const trendDown = last3.length >= 3 && last3[1].intake < last3[0].intake && last3[2].intake < last3[1].intake;

  // Layout
  const maxVal = Math.max(...points.map(p => Math.max(p.intake, p.avg)), target, 50) * 1.15;
  const PAD_L = 36, PAD_R = 20, CHART_H = 140, BOTTOM = 36, TOP = 8;
  const gap = Math.max(32, Math.min(48, 340 / points.length));
  const W = PAD_L + points.length * gap + PAD_R;
  const H = TOP + CHART_H + BOTTOM;

  function px(i: number) { return PAD_L + i * gap + gap / 2; }
  function valY(v: number) { return TOP + CHART_H - (v / maxVal) * CHART_H; }

  // Build line and area paths
  const linePts = points.map((p, i) => ({ x: px(i), y: valY(p.intake) }));
  const avgPts = points.map((p, i) => ({ x: px(i), y: valY(p.avg) }));
  const linePath = smoothLine(linePts, 0.4);
  const avgPath = smoothLine(avgPts, 0.4);
  // Area: line path + close to bottom
  const areaPath = linePts.length > 1
    ? `${smoothLine(linePts, 0.4)} L${linePts[linePts.length - 1].x},${TOP + CHART_H} L${linePts[0].x},${TOP + CHART_H} Z`
    : '';

  // Adaptive X labels: skip if too dense
  const labelSkip = gap < 36 ? (gap < 28 ? 3 : 2) : 1;

  // Unique IDs for gradients/filters to avoid collisions
  const uid = 'kline';

  return (
    <ChartCard icon={TrendingUp} title="热量趋势" iconColor="#6366F1" kind="indigo" subtitle="每日摄入 · 7日均值 · 目标线">
      <div className="relative overflow-x-auto no-scrollbar w-full">
        <svg width={W} viewBox={`0 0 ${W} ${H}`} style={{ height: H, minWidth: W, overflow: 'visible', width: '100%' }} preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Green gradient (below target) */}
            <linearGradient id={`${uid}GreenArea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
            </linearGradient>
            {/* Red gradient (above target) */}
            <linearGradient id={`${uid}RedArea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
            </linearGradient>
            {/* Line gradient */}
            <linearGradient id={`${uid}Line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            {/* Clip paths for green/red zones */}
            <clipPath id={`${uid}GreenClip`}>
              <rect x={0} y={valY(target)} width={W} height={TOP + CHART_H - valY(target)} />
            </clipPath>
            <clipPath id={`${uid}RedClip`}>
              <rect x={0} y={TOP} width={W} height={Math.max(0, valY(target) - TOP)} />
            </clipPath>
            <filter id={`${uid}Glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id={`${uid}SoftGlow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <line key={pct} x1={PAD_L - 4} y1={valY(maxVal * pct)} x2={W - PAD_R} y2={valY(maxVal * pct)}
              stroke="var(--ck-chart-grid)" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.3} />
          ))}
          {[0.25, 0.5, 0.75].map(pct => (
            <text key={pct} x={PAD_L - 8} y={valY(maxVal * pct) + 3} textAnchor="end" fontSize={7}
              fill="var(--ck-chart-dim)">{Math.round(maxVal * pct)}</text>
          ))}

          {/* Green area (below target) */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${uid}GreenArea)`} clipPath={`url(#${uid}GreenClip)`}
              opacity={animated ? 1 : 0} style={{ transition: 'opacity 0.8s ease-out' }} />
          )}
          {/* Red area (above target) */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${uid}RedArea)`} clipPath={`url(#${uid}RedClip)`}
              opacity={animated ? 1 : 0} style={{ transition: 'opacity 0.8s ease-out' }} />
          )}

          {/* Target line */}
          <line x1={PAD_L - 4} y1={valY(target)} x2={W - PAD_R} y2={valY(target)}
            stroke="#F97316" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.55} />
          <rect x={W - PAD_R - 44} y={valY(target) - 9} width={42} height={18} rx={9}
            fill="rgba(249,115,22,0.12)" stroke="rgba(249,115,22,0.3)" strokeWidth={0.5} />
          <text x={W - PAD_R - 23} y={valY(target) + 4} textAnchor="middle" fontSize={8}
            fill="#F97316" fontWeight="700">目标</text>

          {/* 7-day moving average line */}
          {avgPts.length > 1 && (
            <path d={avgPath} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 3"
              opacity={animated ? 0.7 : 0} strokeLinecap="round"
              style={{ transition: 'opacity 0.8s ease-out 0.3s' }} />
          )}

          {/* Main intake line */}
          {linePts.length > 1 && (
            <path d={linePath} fill="none" stroke={`url(#${uid}Line)`} strokeWidth={2.8}
              strokeLinecap="round" strokeLinejoin="round"
              filter={`url(#${uid}SoftGlow)`}
              opacity={animated ? 0.95 : 0}
              style={{ transition: 'opacity 0.6s ease-out' }} />
          )}

          {/* Hover vertical line */}
          {hover !== null && (
            <line x1={px(hover)} y1={TOP} x2={px(hover)} y2={TOP + CHART_H}
              stroke="var(--ck-chart-grid)" strokeWidth={0.8} strokeDasharray="3 2" opacity={0.4} />
          )}

          {/* Data points + interaction */}
          {points.map((p, i) => {
            const x = px(i);
            const y = valY(p.intake);
            const isH = hover === i;
            const isActive = activeDate === p.date;
            const dimmed = hover !== null && !isH && !isActive;
            const color = p.overTarget ? '#ef4444' : '#22c55e';
            return (
              <g key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(prev => prev === i ? null : i)}
                onClick={() => onDateClick?.(p.date)}
                style={{ cursor: 'pointer', transition: 'opacity 0.25s', opacity: dimmed ? 0.35 : 1 }}>
                {/* Active date ring */}
                {isActive && (
                  <circle cx={x} cy={y} r={9}
                    fill="none" stroke={color} strokeWidth={1.5} opacity={0.4}
                    style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                )}
                {/* Dot */}
                <circle cx={x} cy={y} r={isActive ? 5 : isH ? 5.5 : 3}
                  fill="white" stroke={color} strokeWidth={isH || isActive ? 3 : 2}
                  filter={isH || isActive ? `url(#${uid}Glow)` : undefined}
                  style={{ transition: 'all 0.2s' }} />
                {/* X label (adaptive skip) */}
                {(i % labelSkip === 0 || isH || isActive) && (
                  <text x={x} y={TOP + CHART_H + 14} textAnchor="middle" fontSize={7.5}
                    fill={isH || isActive ? 'var(--ck-chart-label-hover)' : 'var(--ck-chart-label)'}
                    fontWeight={isH || isActive ? '700' : '500'}>{p.label}</text>
                )}

                {/* Tooltip */}
                {isH && (() => {
                  const ttW = 130, ttH = 100;
                  let ttX = x - ttW / 2;
                  if (ttX < 2) ttX = 2;
                  if (ttX + ttW > W - 2) ttX = W - ttW - 2;
                  const ttY = Math.max(2, y - ttH - 12);
                  const diff = p.intake - target;
                  const diffSign = diff > 0 ? '+' : '';
                  const mealNames = ['早餐', '午餐', '晚餐', '加餐'];
                  const mealColors = ['#fbbf24', '#fb923c', '#ef4444', '#a78bfa'];
                  return (
                    <g>
                      <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={10}
                        fill="rgba(0,0,0,0.93)" opacity={0.96} />
                      {/* Date + total */}
                      <text x={ttX + ttW / 2} y={ttY + 14} textAnchor="middle" fontSize={9.5}
                        fill="white" fontWeight="800">{p.date.slice(5)} · {p.intake} kcal</text>
                      {/* Meals breakdown */}
                      {p.meals.map((cal, mi) => cal > 0 ? (
                        <text key={mi} x={ttX + 10} y={ttY + 28 + mi * 12} fontSize={7.5}
                          fill={mealColors[mi]} fontWeight="600">
                          {mealNames[mi]} {cal}
                          <tspan fill="rgba(255,255,255,0.45)" fontSize={6.5}> kcal</tspan>
                        </text>
                      ) : null)}
                      {/* Separator */}
                      <line x1={ttX + 8} y1={ttY + 73} x2={ttX + ttW - 8} y2={ttY + 73}
                        stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
                      {/* Diff from target */}
                      <text x={ttX + ttW / 2} y={ttY + 85} textAnchor="middle" fontSize={8.5}
                        fill={p.overTarget ? '#fca5a5' : '#86efac'} fontWeight="700">
                        {diff === 0 ? '恰好达标' : p.overTarget ? `超标 ${diffSign}${diff}` : `余额 ${-diff}`} kcal
                      </text>
                      {/* 7-day avg */}
                      <text x={ttX + ttW / 2} y={ttY + 96} textAnchor="middle" fontSize={7}
                        fill="#fbbf24" fontWeight="600">7日均 {p.avg} kcal</text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Trend arrow indicator */}
          {(trendUp || trendDown) && (() => {
            const arrowX = W - PAD_R - 12;
            const arrowY = TOP + 8;
            const color = trendUp ? '#ef4444' : '#22c55e';
            return (
              <g opacity={0.8}>
                <rect x={arrowX - 10} y={arrowY - 6} width={20} height={20} rx={10}
                  fill={color} opacity={0.15} />
                <text x={arrowX} y={arrowY + 8} textAnchor="middle" fontSize={13}
                  fill={color} fontWeight="900">
                  {trendUp ? '↑' : '↓'}
                </text>
              </g>
            );
          })()}

          {/* Legend */}
          <g transform={`translate(${PAD_L}, ${H - 8})`}>
            <rect x={0} y={0} width={10} height={7} rx={2} fill="#22c55e" opacity={0.6} />
            <text x={14} y={6} fontSize={7} fill="var(--ck-chart-dim)">达标</text>
            <rect x={46} y={0} width={10} height={7} rx={2} fill="#ef4444" opacity={0.7} />
            <text x={60} y={6} fontSize={7} fill="var(--ck-chart-dim)">超标</text>
            <line x1={92} y1={3.5} x2={106} y2={3.5} stroke="#818cf8" strokeWidth={2} opacity={0.7} />
            <text x={110} y={6} fontSize={7} fill="var(--ck-chart-dim)">摄入</text>
            <line x1={140} y1={3.5} x2={154} y2={3.5} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.7} />
            <text x={158} y={6} fontSize={7} fill="var(--ck-chart-dim)">7日均</text>
            <line x1={192} y1={3.5} x2={206} y2={3.5} stroke="#F97316" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.55} />
            <text x={210} y={6} fontSize={7} fill="var(--ck-chart-dim)">目标</text>
          </g>
        </svg>
      </div>
    </ChartCard>
  );
}

export default function WeeklyCharts({ stats, targetCalories, selectedDate, profile }: WeeklyChartsProps) {
  if (!stats.length) return null;

  return (
    <div className="space-y-3 animate-in fade-in duration-500 w-full">

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

      <MacroSankey stats={stats} selectedDate={selectedDate} profile={profile} />

      <MealHeatmap stats={stats} />
    </div>
  );
}
