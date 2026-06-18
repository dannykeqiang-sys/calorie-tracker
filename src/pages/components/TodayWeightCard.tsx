import { useState } from 'react';
import { Scale, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const WEIGHT_KEY = 'calorie_weight_records';

interface WeightRecord {
  date: string;
  weight: number;
}

function loadWeightRecords(): Record<string, number> {
  try {
    const raw = localStorage.getItem(WEIGHT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWeightRecord(date: string, weight: number) {
  const all = loadWeightRecords();
  all[date] = weight;
  localStorage.setItem(WEIGHT_KEY, JSON.stringify(all));
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

const ENCOURAGEMENTS = [
  '每一天的记录，都是对自己温柔的在意。',
  '体重只是数字，你今天的坚持比数字更有价值。',
  '变化需要时间，而你每天都在积累。',
  '记录的每一克，都是诚实与自我的对话。',
  '数字不定义你，习惯才会。你正在做对的事。',
  '你愿意打开这里，就已经比昨天的自己更勇敢了。',
];

function getEncouragement(): string {
  const today = getTodayKey();
  const dayOfYear = Math.floor((new Date(today).getTime() - new Date(new Date().getFullYear() + '-01-01').getTime()) / 86400000);
  return ENCOURAGEMENTS[dayOfYear % ENCOURAGEMENTS.length];
}

interface TodayWeightCardProps {
  baseWeight?: number;
}

export default function TodayWeightCard({ baseWeight }: TodayWeightCardProps) {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();
  const records = loadWeightRecords();

  const [todayWeight, setTodayWeight] = useState<number | null>(records[today] ?? null);
  const [inputVal, setInputVal] = useState('');
  const [editing, setEditing] = useState(false);
  const [shake, setShake] = useState(false);

  const yesterdayWeight = records[yesterday] ?? null;
  const diff = todayWeight !== null && yesterdayWeight !== null
    ? +(todayWeight - yesterdayWeight).toFixed(1)
    : null;

  const handleSave = () => {
    const val = parseFloat(inputVal);
    if (!inputVal || isNaN(val) || val < 20 || val > 300) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setTodayWeight(val);
    saveWeightRecord(today, val);
    setEditing(false);
    setInputVal('');
  };

  const getDiffInfo = () => {
    if (diff === null) return null;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: '#A3B899', text: '与昨日持平', label: `0 kg` };
    if (diff > 0) return { icon: TrendingUp, color: '#F97316', text: '较昨日上升', label: `+${diff} kg` };
    return { icon: TrendingDown, color: '#10B981', text: '较昨日下降', label: `${diff} kg` };
  };

  const diffInfo = getDiffInfo();
  const refWeight = baseWeight ?? null;
  const totalDiff = todayWeight !== null && refWeight ? +(todayWeight - refWeight).toFixed(1) : null;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9E8)' }}
            >
              <Scale className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-sm font-bold text-foreground">今日体重</p>
          </div>
          {todayWeight !== null && !editing && (
            <button
              onClick={() => { setEditing(true); setInputVal(String(todayWeight)); }}
              className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer px-2 py-1"
            >
              修改
            </button>
          )}
        </div>

        {todayWeight === null && !editing ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {getEncouragement()}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9E8)' }}
            >
              记录今日体重
            </button>
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 ${shake ? 'animate-pulse' : ''}`}>
              <input
                type="number"
                autoFocus
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                placeholder="如：58.5"
                className="flex-1 h-10 rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground outline-none focus:border-primary transition-colors tabular-nums"
                step="0.1"
                min="20"
                max="300"
              />
              <span className="text-sm text-muted-foreground flex-shrink-0">kg</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setInputVal(''); }}
                className="flex-1 py-2 rounded-xl text-xs text-muted-foreground border border-border cursor-pointer hover:bg-muted/30 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9E8)' }}
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black tabular-nums text-foreground">{todayWeight}</span>
              <span className="text-base text-muted-foreground mb-0.5">kg</span>
              {diffInfo && (
                <div className="ml-auto flex items-center gap-1 mb-0.5">
                  <diffInfo.icon className="w-3.5 h-3.5" style={{ color: diffInfo.color }} />
                  <span className="text-xs font-semibold tabular-nums" style={{ color: diffInfo.color }}>
                    {diffInfo.label}
                  </span>
                </div>
              )}
            </div>

            {diffInfo && (
              <p className="text-[11px] text-muted-foreground">{diffInfo.text}</p>
            )}

            {totalDiff !== null && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ backgroundColor: totalDiff <= 0 ? '#10B98112' : '#F9731612' }}
              >
                <span className="text-[11px] text-muted-foreground">与设定体重相比</span>
                <span
                  className="text-xs font-bold tabular-nums ml-auto"
                  style={{ color: totalDiff <= 0 ? '#10B981' : '#F97316' }}
                >
                  {totalDiff > 0 ? '+' : ''}{totalDiff} kg
                </span>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              {getEncouragement()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export { loadWeightRecords };
export type { WeightRecord };
