import { useState, useRef } from 'react';
import { Droplets, Plus, Trash2, Check, X } from 'lucide-react';
import type { WaterItem } from '../../types';

interface WaterTrackerProps {
  items: WaterItem[];
  onAdd: (item: WaterItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (item: WaterItem) => void;
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
  '矿泉水': 500, '运动饮料': 600,
};

function parseWaterInput(text: string): number {
  const trimmed = text.trim();
  for (const [kw, val] of Object.entries(KEYWORD_MAP)) {
    if (trimmed.includes(kw)) return val;
  }
  const match = trimmed.match(/(\d+(\.\d+)?)/);
  if (match) return Math.round(parseFloat(match[1]));
  return 250;
}

function genId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

export default function WaterTracker({ items, onAdd, onRemove, onUpdate }: WaterTrackerProps) {
  const [inputText, setInputText] = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = items.reduce((s, i) => s + i.amount, 0);
  const goal = 2000;
  const percent = Math.min(100, Math.round((total / goal) * 100));

  const handleQuickAdd = (amount: number) => {
    onAdd({ id: genId(), amount, note: '', time: getNowTime() });
  };

  const handleTextAdd = () => {
    const text = inputText.trim();
    if (!text) return;
    const amount = parseWaterInput(text);
    const note = text.replace(/\d+(\.\d+)?\s*(ml|毫升|mL)?/gi, '').trim();
    onAdd({ id: genId(), amount, note, time: getNowTime() });
    setInputText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTextAdd();
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

  return (
    <div className="w-full h-auto flex flex-col rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 overflow-hidden">
      <div className="flex flex-col gap-3 p-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Droplets className="w-4 h-4 text-sky-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sky-900">今日喝水</p>
              <p className="text-xs text-sky-500">目标 {goal} ml</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-sky-600 tabular-nums">{total}</span>
            <span className="text-xs text-sky-400 ml-1">ml</span>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-sky-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              background: percent >= 100
                ? 'linear-gradient(90deg, #38bdf8, #06b6d4)'
                : 'linear-gradient(90deg, #7dd3fc, #38bdf8)',
            }}
          />
        </div>
        <p className="text-xs text-sky-400 -mt-1">
          {percent >= 100 ? '今日喝水目标达成！' : `还差 ${goal - total} ml`} · {percent}%
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 pt-3">
        {QUICK_AMOUNTS.map(q => (
          <button
            key={q.label}
            onClick={() => handleQuickAdd(q.amount)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium text-sky-600 bg-sky-100 hover:bg-sky-200 transition-colors cursor-pointer border border-sky-200"
          >
            {q.label}
            <span className="block text-[10px] text-sky-400 font-normal">{q.amount}ml</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pt-3">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入量（如：一大杯、300ml）回车记录"
          className="flex-1 h-8 rounded-lg border border-sky-200 bg-card px-3 text-xs text-foreground placeholder:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
        />
        <button
          onClick={handleTextAdd}
          disabled={!inputText.trim()}
          className="w-8 h-8 rounded-lg bg-sky-400 hover:bg-sky-500 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-0 px-4 pt-3 pb-4">
          {items.map(item => {
            const isEditing = editState?.id === item.id;
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 py-2 border-b border-sky-100 last:border-0"
              >
                <Droplets className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                {isEditing ? (
                  <>
                    <input
                      type="number"
                      value={editState.amount}
                      onChange={e => setEditState(s => s ? { ...s, amount: e.target.value } : s)}
                      onKeyDown={handleEditKey}
                      className="w-16 h-6 rounded border border-sky-300 px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-400"
                      autoFocus
                    />
                    <span className="text-xs text-sky-400 flex-shrink-0">ml</span>
                    <input
                      type="text"
                      value={editState.note}
                      onChange={e => setEditState(s => s ? { ...s, note: e.target.value } : s)}
                      onKeyDown={handleEditKey}
                      placeholder="备注（可选）"
                      className="flex-1 h-6 rounded border border-sky-200 px-1.5 text-xs text-foreground placeholder:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300"
                    />
                    <button onClick={commitEdit} className="cursor-pointer text-sky-500 hover:text-sky-700">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="cursor-pointer text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(item)}
                      className="flex-1 flex items-center gap-1.5 text-left cursor-pointer group"
                    >
                      <span className="text-sm font-medium text-sky-700 tabular-nums group-hover:text-sky-900 transition-colors">
                        {item.amount} ml
                      </span>
                      {item.note && (
                        <span className="text-xs text-sky-400 truncate">{item.note}</span>
                      )}
                    </button>
                    <span className="text-[10px] text-sky-300 flex-shrink-0">{item.time}</span>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="w-5 h-5 rounded flex items-center justify-center text-sky-300 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <p className="px-4 pt-2 pb-4 text-xs text-sky-300 text-center">点击快捷按钮或输入记录今日饮水</p>
      )}
    </div>
  );
}
