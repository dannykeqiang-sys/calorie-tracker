import { useState } from 'react';

const CX = 90;
const CY = 90;
const R_PROTEIN = 65;
const R_CARBS = 50;
const R_FAT = 35;
const RING_SW = 12;

const C_PROTEIN = 2 * Math.PI * R_PROTEIN;
const C_CARBS = 2 * Math.PI * R_CARBS;
const C_FAT = 2 * Math.PI * R_FAT;

type HoverState = null | 'protein' | 'carbs' | 'fat';

interface MacroRingChartProps {
  intake: number;
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  hasData: boolean;
  compact?: boolean;
}

function calColor(pct: number): string {
  if (pct < 0.75) return '#22C55E';
  if (pct < 0.95) return '#F97316';
  return '#EF4444';
}

function macroColor(pct: number, base: string): string {
  return pct > 1.05 ? '#EF4444' : base;
}

interface MacroLabelProps {
  name: string;
  actual: number;
  target: number;
  color: string;
  hasData: boolean;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function MacroLabel({ name, actual, target, color, hasData, hovered, onHover, onLeave }: MacroLabelProps) {
  const pct = target > 0 ? actual / target : 0;
  const diff = Math.round(actual - target);
  return (
    <div
      className="flex flex-col gap-0.5 cursor-pointer select-none"
      style={{ opacity: hasData ? 1 : 0.5, transition: 'opacity 0.2s' }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onTouchStart={onHover}
    >
      <div className="flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: hovered ? `0 0 0 2px ${color}33` : 'none', transition: 'box-shadow 0.15s' }}
        />
        <span className="text-[11px] font-bold" style={{ color: hovered ? color : '#374151' }}>{name}</span>
      </div>
      <div className="pl-3.5 flex items-baseline gap-1">
        <span className="text-xs tabular-nums font-semibold" style={{ color: hovered ? color : '#6B7280' }}>
          {hasData ? actual : '—'}
        </span>
        <span className="text-[10px] text-muted-foreground/60 font-normal">/ {target}g</span>
      </div>
      {hasData && (
        <div className="pl-3.5">
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden" style={{ width: 56 }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: color }}
            />
          </div>
          {hovered && (
            <p className="text-[9px] font-semibold mt-0.5 tabular-nums" style={{ color: diff > 0 ? '#EF4444' : '#22C55E' }}>
              {diff > 0 ? `超 ${diff}g` : diff < 0 ? `还差 ${-diff}g` : '达标'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MacroRingChart({
  intake,
  targetCalories,
  protein,
  carbs,
  fat,
  proteinTarget,
  carbsTarget,
  fatTarget,
  hasData,
  compact = false,
}: MacroRingChartProps) {
  const [hovered, setHovered] = useState<HoverState>(null);

  const calPct = targetCalories > 0 ? Math.min(intake / targetCalories, 1) : 0;
  const cc = calColor(calPct);
  const calRemain = targetCalories - intake;

  const proteinPct = proteinTarget > 0 ? protein / proteinTarget : 0;
  const carbsPct = carbsTarget > 0 ? carbs / carbsTarget : 0;
  const fatPct = fatTarget > 0 ? fat / fatTarget : 0;

  const proteinFill = Math.min(proteinPct, 1) * C_PROTEIN;
  const carbsFill = Math.min(carbsPct, 1) * C_CARBS;
  const fatFill = Math.min(fatPct, 1) * C_FAT;

  const pc = macroColor(proteinPct, '#F97316');
  const cc2 = macroColor(carbsPct, '#6366F1');
  const fc = macroColor(fatPct, '#0EA5E9');

  const ringsSvg = (
    <svg
      viewBox="0 0 180 180"
      style={{ width: '100%', height: 'auto', display: 'block', maxWidth: 180 }}
    >
      <circle cx={CX} cy={CY} r={R_PROTEIN} fill="none" stroke="#F3F4F6" strokeWidth={RING_SW}
        onMouseEnter={() => setHovered('protein')} onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'pointer' }} />
      {hasData && proteinFill > 0 && (
        <circle cx={CX} cy={CY} r={R_PROTEIN} fill="none"
          stroke={pc} strokeWidth={hovered === 'protein' ? RING_SW + 2 : RING_SW} strokeLinecap="round"
          strokeDasharray={`${proteinFill} ${C_PROTEIN}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          onMouseEnter={() => setHovered('protein')} onMouseLeave={() => setHovered(null)}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke-width 0.15s, stroke 0.3s', cursor: 'pointer' }}
        />
      )}

      <circle cx={CX} cy={CY} r={R_CARBS} fill="none" stroke="#F3F4F6" strokeWidth={RING_SW}
        onMouseEnter={() => setHovered('carbs')} onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'pointer' }} />
      {hasData && carbsFill > 0 && (
        <circle cx={CX} cy={CY} r={R_CARBS} fill="none"
          stroke={cc2} strokeWidth={hovered === 'carbs' ? RING_SW + 2 : RING_SW} strokeLinecap="round"
          strokeDasharray={`${carbsFill} ${C_CARBS}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          onMouseEnter={() => setHovered('carbs')} onMouseLeave={() => setHovered(null)}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke-width 0.15s, stroke 0.3s', cursor: 'pointer' }}
        />
      )}

      <circle cx={CX} cy={CY} r={R_FAT} fill="none" stroke="#F3F4F6" strokeWidth={RING_SW}
        onMouseEnter={() => setHovered('fat')} onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'pointer' }} />
      {hasData && fatFill > 0 && (
        <circle cx={CX} cy={CY} r={R_FAT} fill="none"
          stroke={fc} strokeWidth={hovered === 'fat' ? RING_SW + 2 : RING_SW} strokeLinecap="round"
          strokeDasharray={`${fatFill} ${C_FAT}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          onMouseEnter={() => setHovered('fat')} onMouseLeave={() => setHovered(null)}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke-width 0.15s, stroke 0.3s', cursor: 'pointer' }}
        />
      )}

      {!hasData ? (
        <text x={CX} y={CY + 6} textAnchor="middle" fill="#D1D5DB" fontSize={18} fontWeight="700">—</text>
      ) : hovered === 'protein' ? (
        <>
          <text x={CX} y={CY + 4} textAnchor="middle" fill={pc} fontSize={22} fontWeight="900">{protein}</text>
          <text x={CX} y={CY + 17} textAnchor="middle" fill={pc} fontSize={9} fontWeight="600">g</text>
        </>
      ) : hovered === 'carbs' ? (
        <>
          <text x={CX} y={CY + 4} textAnchor="middle" fill={cc2} fontSize={22} fontWeight="900">{carbs}</text>
          <text x={CX} y={CY + 17} textAnchor="middle" fill={cc2} fontSize={9} fontWeight="600">g</text>
        </>
      ) : hovered === 'fat' ? (
        <>
          <text x={CX} y={CY + 4} textAnchor="middle" fill={fc} fontSize={22} fontWeight="900">{fat}</text>
          <text x={CX} y={CY + 17} textAnchor="middle" fill={fc} fontSize={9} fontWeight="600">g</text>
        </>
      ) : (
        <>
          <text x={CX} y={CY + 4} textAnchor="middle" fill="#1F2937" fontSize={22} fontWeight="900">{intake}</text>
          <text x={CX} y={CY + 17} textAnchor="middle" fill={cc} fontSize={9} fontWeight="600">kcal</text>
        </>
      )}
    </svg>
  );

  if (compact) {
    return (
      <div className="flex flex-col items-center w-full">
        <div style={{ width: 180, maxWidth: '100%' }}>
          {ringsSvg}
        </div>
        <div className="flex items-center gap-3 -mt-2">
          {[
            { label: '蛋白质', color: '#F97316' },
            { label: '碳水', color: '#6366F1' },
            { label: '脂肪', color: '#0EA5E9' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-2">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0" style={{ width: 160 }}>
          {ringsSvg}
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <MacroLabel
            name="蛋白质" actual={protein} target={proteinTarget}
            color={pc} hasData={hasData}
            hovered={hovered === 'protein'}
            onHover={() => setHovered('protein')}
            onLeave={() => setHovered(null)}
          />
          <MacroLabel
            name="碳水化合物" actual={carbs} target={carbsTarget}
            color={cc2} hasData={hasData}
            hovered={hovered === 'carbs'}
            onHover={() => setHovered('carbs')}
            onLeave={() => setHovered(null)}
          />
          <MacroLabel
            name="脂肪" actual={fat} target={fatTarget}
            color={fc} hasData={hasData}
            hovered={hovered === 'fat'}
            onHover={() => setHovered('fat')}
            onLeave={() => setHovered(null)}
          />
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">总热量</span>
          <span className="text-[10px] tabular-nums text-foreground/80 font-semibold">
            {intake}
            <span className="font-normal text-muted-foreground"> / {targetCalories} kcal</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-gray-100">
          {hasData ? (
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(calPct * 100, 100)}%`, backgroundColor: cc }}
            />
          ) : null}
        </div>
        {hasData && (
          <p className="text-right text-[9px] font-semibold tabular-nums" style={{ color: calRemain < 0 ? '#EF4444' : '#22C55E' }}>
            {calRemain < 0 ? `超出 ${-calRemain}` : `还可摄入 ${calRemain}`} kcal
          </p>
        )}
      </div>
    </div>
  );
}
