import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { FoodItem } from '../../types';
import { estimateCalories } from '../../utils/deepseek';

interface HistoryMealSectionProps {
  label: string;
  accent: string;
  items: FoodItem[];
  apiKey: string;
  onAdd: (item: FoodItem) => void;
  onRemove: (id: string) => void;
}

export default function HistoryMealSection({
  label,
  accent,
  items,
  apiKey,
  onAdd,
  onRemove,
}: HistoryMealSectionProps) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const total = items.reduce((s, i) => s + i.calories, 0);

  const handleAdd = async () => {
    const text = inputText.trim();
    if (!text) return;

    if (apiKey) {
      setLoading(true);
      try {
        const result = await estimateCalories(apiKey, text);
        onAdd({ id: crypto.randomUUID(), name: result.food_name, calories: result.calories });
      } catch {
        onAdd({ id: crypto.randomUUID(), name: text, calories: 0 });
      } finally {
        setLoading(false);
      }
    } else {
      onAdd({ id: crypto.randomUUID(), name: text, calories: 0 });
    }
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: `${accent}12` }}
      >
        <span className="text-xs font-semibold" style={{ color: accent }}>
          {label}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: accent }}>
          {total} kcal
        </span>
      </div>

      <div className="px-4 py-2.5 space-y-1.5">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground/40 py-0.5">暂无记录</p>
        )}
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-0.5">
            <span className="text-sm text-foreground flex-1 truncate">{item.name}</span>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {item.calories} kcal
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="w-6 h-6 flex items-center justify-center text-muted-foreground/40 hover:text-destructive cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={apiKey ? `添加${label}，AI估算热量` : `添加${label}食物名称`}
            disabled={loading}
            className="flex-1 h-8 rounded-xl border border-border bg-card/80 px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 disabled:opacity-50"
            style={{ '--tw-ring-color': `${accent}40` } as React.CSSProperties}
          />
          <button
            onClick={handleAdd}
            disabled={!inputText.trim() || loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white cursor-pointer disabled:opacity-40 active:scale-90 transition-all flex-shrink-0"
            style={{ backgroundColor: accent }}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
