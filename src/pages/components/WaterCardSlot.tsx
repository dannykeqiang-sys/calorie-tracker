import { useState, useRef } from 'react';
import { Trash2, Check, X, Plus, Sparkles, Loader2, Pencil } from 'lucide-react';
import type { WaterItem, UserProfile } from '../../types';
import { parseWaterContent } from '../../utils/deepseek';
import type { WaterLogItem } from '../../utils/deepseek';

export interface WaterSlotConfig {
  label: string;
  en: string;
  num: string;
  icon: React.ElementType;
  accent: string;
  time: string;
  imageUrl?: string;
}

interface WaterCardSlotProps {
  config: WaterSlotConfig;
  items: WaterItem[];
  apiKey: string;
  isActive: boolean;
  isHighlighted: boolean;
  isViewingToday?: boolean;
  fullscreen?: boolean;
  bareMode?: boolean;
  noImage?: boolean;
  profile?: UserProfile | null;
  onAdd: (item: WaterItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (item: WaterItem) => void;
  onReplace?: (items: WaterItem[]) => void;
}

const QUICK_AMOUNTS = [
  { label: '小杯', amount: 200 },
  { label: '一杯', amount: 250 },
  { label: '大杯', amount: 300 },
  { label: '一瓶', amount: 500 },
];

const KEYWORD_MAP: Record<string, number> = {
  '一小杯': 200, '小杯': 200,
  '一杯': 250, '一碗': 250,
  '大杯': 300, '一大杯': 300,
  '一瓶': 500, '一瓶水': 500,
  '矿泉水': 500,
};

function simpleParseWater(text: string): { amount: number; note: string } {
  const trimmed = text.trim();
  for (const [kw, val] of Object.entries(KEYWORD_MAP)) {
    if (trimmed.includes(kw)) return { amount: val, note: trimmed.replace(kw, '').trim() };
  }
  const match = trimmed.match(/(\d+(\.\d+)?)/);
  if (match) {
    const amount = Math.round(parseFloat(match[1]));
    const note = trimmed.replace(match[0], '').replace(/ml|毫升|mL/gi, '').trim();
    return { amount, note };
  }
  return { amount: 250, note: trimmed };
}

function getNowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface EditState {
  id: string;
  amount: string;
  note: string;
}

type InputStatus = 'idle' | 'parsing' | 'confirm' | 'error';

export default function WaterCardSlot({
  config,
  items,
  apiKey,
  isActive,
  isHighlighted,
  isViewingToday = true,
  fullscreen = false,
  bareMode = false,
  noImage = false,
  profile,
  onAdd,
  onRemove,
  onUpdate,
  onReplace,
}: WaterCardSlotProps) {
  const [inputText, setInputText] = useState('');
  const [inputStatus, setInputStatus] = useState<InputStatus>('idle');
  const [pendingLogs, setPendingLogs] = useState<WaterLogItem[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = config.icon;
  const total = items.reduce((s, i) => s + i.amount, 0);
  const goal = profile ? Math.min(3000, Math.max(1500, Math.round(profile.weight * 30))) : 2000;
  const percent = Math.min(100, Math.round((total / goal) * 100));

  const handleQuickAdd = (amount: number) => {
    onAdd({ id: crypto.randomUUID(), amount, note: '', time: getNowTime() });
  };

  const handleSmartParse = async () => {
    const text = inputText.trim();
    if (!text) return;

    if (!apiKey) {
      const { amount, note } = simpleParseWater(text);
      onAdd({ id: crypto.randomUUID(), amount, note, time: getNowTime() });
      setInputText('');
      inputRef.current?.focus();
      return;
    }

    setInputStatus('parsing');
    try {
      const result = await parseWaterContent(apiKey, text);
      if (result.has_data && result.data.water_logs.length > 0) {
        setPendingLogs(result.data.water_logs);
        setAnalysisSummary(result.analysis_summary);
        setInputStatus('confirm');
      } else {
        const { amount, note } = simpleParseWater(text);
        onAdd({ id: crypto.randomUUID(), amount, note, time: getNowTime() });
        setInputText('');
        setInputStatus('idle');
      }
    } catch {
      setErrorMsg('AI 解析失败，已按默认方式记录');
      const { amount, note } = simpleParseWater(text);
      onAdd({ id: crypto.randomUUID(), amount, note, time: getNowTime() });
      setInputText('');
      setInputStatus('error');
      setTimeout(() => setInputStatus('idle'), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSmartParse();
  };

  const handleConfirm = () => {
    const time = getNowTime();
    pendingLogs.forEach(log => {
      onAdd({ id: crypto.randomUUID(), amount: log.amount, note: log.raw_text, time });
    });
    setInputText('');
    setPendingLogs([]);
    setAnalysisSummary('');
    setInputStatus('idle');
    inputRef.current?.focus();
  };

  const handleReplace = () => {
    if (!onReplace) return;
    const time = getNowTime();
    const newItems = pendingLogs.map(log => ({
      id: crypto.randomUUID(),
      amount: log.amount,
      note: log.raw_text,
      time,
    }));
    onReplace(newItems);
    setInputText('');
    setPendingLogs([]);
    setAnalysisSummary('');
    setInputStatus('idle');
    inputRef.current?.focus();
  };

  const handleRetry = () => {
    setPendingLogs([]);
    setAnalysisSummary('');
    setInputStatus('idle');
    inputRef.current?.focus();
  };

  const startEdit = (item: WaterItem) => {
    setEditState({ id: item.id, amount: String(item.amount), note: item.note ?? '' });
  };

  const commitEdit = () => {
    if (!editState) return;
    const item = items.find(i => i.id === editState.id);
    if (!item) return;
    const amount = parseInt(editState.amount, 10);
    if (!isNaN(amount) && amount > 0) {
      onUpdate({ ...item, amount, note: editState.note });
    }
    setEditState(null);
  };

  const cancelEdit = () => setEditState(null);

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const showDetails = bareMode ? isActive : (!fullscreen || isActive);
  const goalText = percent >= 100
    ? (isViewingToday ? '今日目标达成！' : '当日目标达成！')
    : `目标 ${goal} ml`;

  return (
    <div
      className={`relative ${bareMode ? 'w-[260px]' : 'w-screen sm:w-[400px]'} rounded-[2rem] overflow-hidden flex flex-col select-none ${fullscreen ? 'h-full' : ''}`}
      style={{
        maxHeight: fullscreen || bareMode ? undefined : noImage ? '280px' : (isActive ? '900px' : '216px'),
        opacity: isActive ? 1 : bareMode ? 0.75 : 0.62,
        boxShadow: bareMode
          ? (isActive ? '0 8px 24px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.08)')
          : (isActive
              ? 'inset 0 1px 1px rgba(255,255,255,0.75), 0 24px 56px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.10)'
              : 'inset 0 1px 1px rgba(255,255,255,0.55), 0 8px 24px rgba(0,0,0,0.07)'),
        borderTop: bareMode ? undefined : '1.5px solid rgba(255,255,255,0.65)',
        borderLeft: bareMode ? undefined : '1.5px solid rgba(255,255,255,0.45)',
        transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease, box-shadow 0.5s ease',
        outline: isHighlighted ? `2px solid ${config.accent}` : 'none',
        outlineOffset: '3px',
      }}
    >
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{
          height: noImage ? '0px' : (bareMode && isActive ? '0px' : fullscreen ? (isActive ? '200px' : '0px') : '8rem'),
          transition: 'height 0.6s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {config.imageUrl ? (
          <img
            src={config.imageUrl}
            alt={config.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, #EFF9FF, #E0F4FD)` }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.32) 100%)' }}
        />
        <p
          className="absolute top-3 right-4 text-5xl font-black leading-none select-none"
          style={{ color: 'rgba(255,255,255,0.14)' }}
        >
          {config.num}
        </p>
        <p className="absolute bottom-2.5 left-5 text-[10px] text-white/70 tracking-[0.18em] uppercase font-medium">
          {config.en}
        </p>
      </div>

      <div
        className={fullscreen ? 'flex-1 flex flex-col min-h-0' : 'flex flex-col'}
        style={{
          background: noImage
            ? `linear-gradient(135deg, ${config.accent}18 0%, rgba(255,255,255,0.68) 72px, rgba(255,255,255,0.60) 100%)`
            : `linear-gradient(135deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.42) 100%)`,
          backdropFilter: 'url(#liquid-distort) blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        }}
      >
        {noImage && (
          <div className="flex-shrink-0" style={{
            height: '2.5px',
            background: `linear-gradient(to right, ${config.accent}, ${config.accent}50, transparent)`,
            opacity: isActive ? 1 : 0.5,
          }} />
        )}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${config.accent}22` }}
              >
                <Icon className="w-4 h-4" style={{ color: config.accent }} />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground leading-none tracking-tight">{config.label}</h2>
                {noImage && config.time && (
                  <p className="text-[9px] text-muted-foreground/40 tracking-wide mt-0.5">{config.time}</p>
                )}
              </div>
            </div>
            <p className="text-sm font-bold tabular-nums pt-1" style={{ color: config.accent }}>{total} ml</p>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{goalText}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${config.accent}20` }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  background: `linear-gradient(90deg, ${config.accent}99, ${config.accent})`,
                }}
              />
            </div>
          </div>

          <div
            className="grid grid-cols-4 gap-1.5 mt-3"
            style={{ opacity: showDetails ? 1 : 0, transition: 'opacity 0.35s ease', pointerEvents: showDetails ? 'auto' : 'none' }}
          >
            {QUICK_AMOUNTS.map(q => (
              <button
                key={q.label}
                onClick={() => handleQuickAdd(q.amount)}
                className="flex flex-col items-center py-1.5 rounded-full text-xs font-medium cursor-pointer active:scale-90 transition-all border"
                style={{
                  backgroundColor: `${config.accent}12`,
                  borderColor: `${config.accent}30`,
                  color: config.accent,
                }}
              >
                <span>{q.label}</span>
                <span className="text-[10px] opacity-70">{q.amount}</span>
              </button>
            ))}
          </div>
        </div>

        {showDetails && inputStatus === 'confirm' && (
          <div
            className="mx-5 mb-2 rounded-2xl border p-3 space-y-2.5"
            style={{ backgroundColor: `${config.accent}08`, borderColor: `${config.accent}30` }}
          >
            <p className="text-xs text-muted-foreground leading-relaxed">{analysisSummary}</p>
            <div className="flex flex-wrap gap-1.5">
              {pendingLogs.map((log, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ backgroundColor: `${config.accent}18`, borderColor: `${config.accent}35`, color: config.accent }}
                >
                  {log.raw_text}
                  <span className="font-bold">+{log.amount} ml</span>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                className="py-1.5 px-3 rounded-xl border text-xs text-muted-foreground cursor-pointer hover:bg-white/60 transition-colors flex-shrink-0"
                style={{ borderColor: `${config.accent}30` }}
              >
                重新输入
              </button>
              {onReplace && items.length > 0 && (
                <button
                  onClick={handleReplace}
                  className="flex-1 py-1.5 rounded-xl text-xs font-medium cursor-pointer active:scale-95 transition-all border"
                  style={{ borderColor: config.accent, color: config.accent, backgroundColor: `${config.accent}10` }}
                >
                  覆盖全部
                </button>
              )}
              <button
                onClick={handleConfirm}
                className="flex-1 py-1.5 rounded-xl text-xs text-white font-medium cursor-pointer active:scale-95 transition-all"
                style={{ backgroundColor: config.accent }}
              >
                追加记录
              </button>
            </div>
          </div>
        )}

        {showDetails && inputStatus === 'error' && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs text-muted-foreground border border-destructive/20 bg-destructive/5">
            {errorMsg}
          </div>
        )}

        <div
          className={fullscreen ? 'flex-1 overflow-y-auto px-5 space-y-1.5 min-h-0' : 'px-5 space-y-1.5'}
          style={{ pointerEvents: showDetails ? 'auto' : 'none' }}
        >
          {items.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 tracking-wide">
              点击快捷按钮或输入食物/饮料记录水分
            </div>
          )}
          {items.map(item =>
            editState?.id === item.id ? (
              <div
                key={item.id}
                className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-sky-50 border border-sky-200"
              >
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  value={editState.amount}
                  onChange={e => setEditState(s => s ? { ...s, amount: e.target.value } : s)}
                  onKeyDown={handleEditKey}
                  onFocus={e => { setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                  className="w-16 text-sm bg-transparent border-b border-sky-300 outline-none text-right py-0.5"
                />
                <span className="text-xs text-muted-foreground flex-shrink-0">ml</span>
                <input
                  type="text"
                  value={editState.note}
                  onChange={e => setEditState(s => s ? { ...s, note: e.target.value } : s)}
                  onKeyDown={handleEditKey}
                  placeholder="备注"
                  className="flex-1 text-sm bg-transparent border-b border-sky-200 outline-none py-0.5"
                />
                <button onClick={commitEdit} className="w-7 h-7 flex items-center justify-center cursor-pointer active:scale-90 text-sky-500">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={cancelEdit} className="w-7 h-7 flex items-center justify-center cursor-pointer active:scale-90 text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                key={item.id}
                className="group flex items-center justify-between py-2.5 px-3 rounded-full bg-white/52 border border-white/58 hover:bg-white/68 transition-colors"
                style={{ animation: 'mealItemIn 0.38s cubic-bezier(0.4,0,0.2,1) both' }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium tabular-nums" style={{ color: config.accent }}>{item.amount} ml</span>
                  {item.note && <span className="text-xs text-muted-foreground truncate">{item.note}</span>}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground/60">{item.time}</span>
                  <button
                    onClick={() => startEdit(item)}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground/50 hover:text-primary active:scale-90 transition-all cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground/50 hover:text-destructive active:scale-90 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div
          className="mx-5 mt-2 mb-0 h-px"
          style={{ backgroundColor: `${config.accent}20`, opacity: showDetails ? 1 : 0, transition: 'opacity 0.35s ease' }}
        />

        <div
          className="px-5 pt-3 pb-5"
          style={{ opacity: showDetails ? 1 : 0, transition: 'opacity 0.35s ease', pointerEvents: showDetails ? 'auto' : 'none' }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={e => { setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
              disabled={inputStatus === 'parsing' || inputStatus === 'confirm'}
              placeholder={apiKey ? '输入任意食物/饮料，智能识别含水量' : '输入量，如：一大杯、300ml'}
              className="flex-1 h-10 rounded-full border border-white/80 bg-white/72 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{ '--tw-ring-color': `${config.accent}40` } as React.CSSProperties}
            />
            <button
              onClick={handleSmartParse}
              disabled={!inputText.trim() || inputStatus === 'parsing' || inputStatus === 'confirm'}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all cursor-pointer active:scale-90 flex-shrink-0 disabled:opacity-40"
              style={{ backgroundColor: config.accent }}
            >
              {inputStatus === 'parsing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : apiKey ? (
                <Sparkles className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
          {apiKey && inputStatus === 'idle' && (
            <p className="text-[10px] text-muted-foreground/50 mt-1.5 pl-1">
              支持：西瓜、冬瓜汤、拿铁、一碗粥...
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes mealItemIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}
