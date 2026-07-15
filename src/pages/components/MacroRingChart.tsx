import { useId, useState } from 'react';

type MacroKey = 'protein' | 'carbs' | 'fat';

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

interface RingSpec {
  key: MacroKey;
  label: string;
  value: number;
  target: number;
  radius: number;
  width: number;
  start: string;
  end: string;
  track: string;
}

const SIZE = 240;
const CENTER = SIZE / 2;

function clampProgress(value: number, target: number): number {
  if (!target || value <= 0) return 0;
  return Math.min(value / target, 1);
}

export default function MacroRingChart(props: MacroRingChartProps) {
  const {
    intake, targetCalories, protein, carbs, fat,
    proteinTarget, carbsTarget, fatTarget, hasData, compact = false,
  } = props;
  const [active, setActive] = useState<MacroKey | null>(null);
  const uid = useId().replace(/:/g, '');
  const caloriePct = targetCalories > 0 ? intake / targetCalories : 0;
  const displayPct = Math.max(0, Math.round(caloriePct * 100));
  const calorieOverflow = Math.max(0, intake - targetCalories);

  const rings: RingSpec[] = [
    { key: 'protein', label: '蛋白质', value: protein, target: proteinTarget, radius: 92, width: 17, start: '#FF7A1A', end: '#FFAA55', track: '#F9E7DA' },
    { key: 'carbs', label: '碳水', value: carbs, target: carbsTarget, radius: 70, width: 16, start: '#377CF6', end: '#73A7FF', track: '#E5ECF7' },
    { key: 'fat', label: '脂肪', value: fat, target: fatTarget, radius: 49, width: 15, start: '#14C96B', end: '#60E69B', track: '#E2F2E8' },
  ];
  const selected = active ? rings.find(r => r.key === active) : null;

  return (
    <div className={compact ? 'w-full min-w-0' : 'w-full'}>
      <div className={compact ? 'mx-auto w-full max-w-[240px]' : 'mx-auto w-full max-w-[300px]'}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`今日摄入 ${intake} 千卡，目标 ${targetCalories} 千卡，完成 ${displayPct}%`}
          className="block w-full h-auto overflow-visible"
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            {rings.map(ring => (
              <linearGradient key={ring.key} id={`${uid}-${ring.key}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={ring.start} />
                <stop offset="100%" stopColor={ring.end} />
              </linearGradient>
            ))}
            <filter id={`${uid}-soft-shadow`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#172033" floodOpacity="0.10" />
            </filter>
          </defs>

          <circle cx={CENTER} cy={CENTER} r="105" fill="var(--ck-surface-subtle)" filter={`url(#${uid}-soft-shadow)`} />

          {rings.map(ring => {
            const circumference = Math.PI * 2 * ring.radius;
            const progress = hasData ? clampProgress(ring.value, ring.target) : 0;
            const overflow = ring.target > 0 && ring.value > ring.target;
            return (
              <g
                key={ring.key}
                onMouseEnter={() => setActive(ring.key)}
                onFocus={() => setActive(ring.key)}
                tabIndex={0}
                role="button"
                aria-label={`${ring.label} ${ring.value} 克，目标 ${ring.target} 克`}
                className="outline-none cursor-pointer"
              >
                <circle
                  cx={CENTER} cy={CENTER} r={ring.radius}
                  fill="none" stroke={ring.track} strokeWidth={ring.width}
                  opacity={active && active !== ring.key ? 0.46 : 0.86}
                />
                {progress > 0 && (
                  <circle
                    cx={CENTER} cy={CENTER} r={ring.radius}
                    fill="none"
                    stroke={overflow ? '#F04444' : `url(#${uid}-${ring.key})`}
                    strokeWidth={active === ring.key ? ring.width + 2 : ring.width}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray={`${progress} ${1 - progress}`}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                    style={{
                      transition: 'stroke-dasharray 700ms cubic-bezier(.22,1,.36,1), stroke-width 180ms ease, opacity 180ms ease',
                      opacity: active && active !== ring.key ? 0.45 : 1,
                    }}
                  />
                )}
                {overflow && (
                  <circle cx="120" cy={CENTER - ring.radius} r="5" fill="#F04444" stroke="#fff" strokeWidth="2" />
                )}
              </g>
            );
          })}

          {!hasData ? (
            <>
              <text x={CENTER} y="116" textAnchor="middle" fill="#A5ADBA" fontSize="24" fontWeight="800">—</text>
              <text x={CENTER} y="139" textAnchor="middle" fill="#A5ADBA" fontSize="11">等待记录</text>
            </>
          ) : selected ? (
            <>
              <text x={CENTER} y="109" textAnchor="middle" fill={selected.start} fontSize="27" fontWeight="850">{selected.value}</text>
              <text x={CENTER} y="128" textAnchor="middle" fill="#68758A" fontSize="10.5" fontWeight="650">/ {selected.target} g</text>
              <text x={CENTER} y="146" textAnchor="middle" fill={selected.value > selected.target ? '#F04444' : selected.start} fontSize="11" fontWeight="750">
                {selected.value > selected.target ? `超出 ${selected.value - selected.target}g` : `${Math.round(clampProgress(selected.value, selected.target) * 100)}%`}
              </text>
            </>
          ) : (
            <>
              <text x={CENTER} y="106" textAnchor="middle" fill="#172033" fontSize={intake >= 1000 ? 30 : 34} fontWeight="900" letterSpacing="-1.5">{intake}</text>
              <text x={CENTER} y="128" textAnchor="middle" fill="#68758A" fontSize="11.5" fontWeight="600">/ {targetCalories} kcal</text>
              <text x={CENTER} y="149" textAnchor="middle" fill={calorieOverflow > 0 ? '#F04444' : '#14B866'} fontSize="13" fontWeight="800">
                {calorieOverflow > 0 ? `+${calorieOverflow}` : `${displayPct}%`}
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-1.5" aria-hidden="true">
        {rings.map(ring => {
          const overflow = ring.value > ring.target;
          return (
            <button
              key={ring.key}
              type="button"
              onMouseEnter={() => setActive(ring.key)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(active === ring.key ? null : ring.key)}
              className="min-w-0 rounded-xl px-1.5 py-1.5 text-center transition-colors cursor-pointer"
              style={{ background: active === ring.key ? `${ring.start}12` : 'transparent' }}
            >
              <span className="flex items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ring.start }} />
                {ring.label}
              </span>
              <span className="block mt-0.5 text-[10px] font-bold tabular-nums" style={{ color: overflow ? '#F04444' : '#3D485A' }}>
                {hasData ? ring.value : '—'}<span className="font-normal text-muted-foreground/55">/{ring.target}g</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
