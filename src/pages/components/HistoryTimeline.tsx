import { useState, useEffect, useRef } from 'react';
import { idbGetAllRecords } from '../../utils/indexedDB';
import { calcTargetCalories } from '../../utils/calculations';
import type { DailyRecord, UserProfile } from '../../types';
import { TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react';

interface HistoryTimelineProps {
  profile: UserProfile | null;
}

function getTotalIntake(record: DailyRecord): number {
  return Object.values(record.meals ?? {}).flat().reduce((s, f) => s + (f.calories ?? 0), 0);
}

function getTotalBurn(record: DailyRecord): number {
  return (record.exercises ?? []).reduce((s, e) => s + (e.calories ?? 0), 0);
}

function formatDateLabel(dateStr: string): { month: string; day: string; weekday: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return {
    month: `${d.getMonth() + 1}月`,
    day: `${d.getDate()}`,
    weekday: weekdays[d.getDay()],
  };
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

interface MiniLineChartProps {
  records: DailyRecord[];
  target: number;
}

function MiniLineChart({ records, target }: MiniLineChartProps) {
  if (records.length < 2) return null;

  const W = 320;
  const H = 56;
  const PAD_X = 10;
  const PAD_Y = 6;

  const values = records.map(r => getTotalIntake(r));
  const allValues = [...values, target];
  const minV = Math.max(0, Math.min(...allValues) - 100);
  const maxV = Math.max(...allValues) + 100;

  const toX = (i: number) => PAD_X + (i / (records.length - 1)) * (W - PAD_X * 2);
  const toY = (v: number) => PAD_Y + (1 - (v - minV) / (maxV - minV)) * (H - PAD_Y * 2);

  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPoints = `${toX(0)},${H - PAD_Y} ${points} ${toX(records.length - 1)},${H - PAD_Y}`;
  const targetY = toY(target);

  return (
    <div className="rounded-lg border border-border bg-card px-3 pt-2 pb-1 mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        <TrendingUp className="w-3 h-3 text-primary" />
        <span className="text-[11px] font-medium text-muted-foreground">热量趋势 · 最近 {records.length} 天</span>
        <span className="ml-auto text-[10px] text-muted-foreground/50">目标 {target}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A3B899" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#A3B899" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={PAD_X} y1={targetY} x2={W - PAD_X} y2={targetY}
          stroke="#EBB193" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.7" />
        <polygon points={areaPoints} fill="url(#areaGrad)" />
        <polyline points={points} fill="none" stroke="#A3B899" strokeWidth="1.8"
          strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r="2.5"
            fill="white" stroke="#A3B899" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  );
}

interface DayCardProps {
  record: DailyRecord;
  target: number;
  isLast: boolean;
}

function DayCard({ record, target, isLast }: DayCardProps) {
  const intake = getTotalIntake(record);
  const burn = getTotalBurn(record);
  const net = intake - burn;
  const surplus = net - target;
  const today = isToday(record.date);
  const label = formatDateLabel(record.date);

  const mealCount = Object.values(record.meals).filter(m => m.length > 0).length;
  const allFoods = Object.values(record.meals).flat();

  const getSurplusInfo = () => {
    if (Math.abs(surplus) < 50) return { icon: Minus, color: '#A3B899', text: '平衡' };
    if (surplus > 0) return { icon: TrendingUp, color: '#EBB193', text: `+${Math.abs(surplus)}` };
    return { icon: TrendingDown, color: '#7CB9E8', text: `-${Math.abs(surplus)}` };
  };

  const info = getSurplusInfo();
  const InfoIcon = info.icon;

  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center text-white flex-shrink-0 shadow-sm ${today ? 'bg-primary' : 'bg-muted-foreground/35'}`}>
          <span className="text-[11px] leading-none font-bold">{label.day}</span>
          <span className="text-[9px] leading-none opacity-80">{label.weekday.slice(1)}</span>
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      <div className={`flex-1 mb-2 rounded-xl border px-3 py-2 ${today ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{label.month}{label.day}日 {label.weekday}</span>
            {today && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-white font-medium">今天</span>}
          </div>
          <div className="flex items-center gap-0.5 text-[10px]" style={{ color: info.color }}>
            <InfoIcon className="w-2.5 h-2.5" />
            <span className="font-medium">{info.text} kcal</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] mb-1.5 text-muted-foreground">
          <span>摄入 <span className="font-semibold text-foreground tabular-nums">{intake}</span></span>
          {burn > 0 && <span>运动 <span className="font-semibold text-blue-400 tabular-nums">-{burn}</span></span>}
          <span>{mealCount} 餐</span>
        </div>

        {allFoods.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allFoods.slice(0, 5).map(f => (
              <span key={f.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border text-muted-foreground">
                {f.name} <span className="text-primary font-medium">{f.calories}</span>
              </span>
            ))}
            {allFoods.length > 5 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                +{allFoods.length - 5}
              </span>
            )}
          </div>
        )}

        {record.exercises.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {record.exercises.map(e => (
              <span key={e.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-500">
                {e.name} {e.duration}分
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryTimeline({ profile }: HistoryTimelineProps) {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    idbGetAllRecords()
      .then(all => {
        if (!mountedRef.current) return;
        const sorted = all
          .filter(r => {
            try {
              return getTotalIntake(r) > 0 || getTotalBurn(r) > 0;
            } catch {
              return false;
            }
          })
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 14);
        setRecords(sorted);
      })
      .catch(() => { if (mountedRef.current) setRecords([]); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  const target = profile ? calcTargetCalories(profile) : 2000;
  const chartRecords = [...records].reverse();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">加载历史记录中...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground">还没有历史记录</p>
        <p className="text-xs text-muted-foreground mt-1">开始记录今天的饮食和运动，时光轴将在这里展开</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {chartRecords.length >= 2 && (
        <MiniLineChart records={chartRecords} target={target} />
      )}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">健康手帐</span>
          <span className="text-[11px] text-muted-foreground">最近 {records.length} 天</span>
        </div>
        <div>
          {records.map((r, i) => (
            <DayCard key={r.date} record={r} target={target} isLast={i === records.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
