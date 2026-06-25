import { useState } from 'react';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Badge } from '@/components/shadcn/badge';
import { Plus, Trash2, Coffee, Sun, Moon, Cookie, Sparkles, Check, X, Pencil } from 'lucide-react';
import type { DailyRecord, FoodItem, MealType } from '../../types';
import { estimateCalories } from '../../utils/deepseek';
import { safeNormalizeString } from '../../utils/stringUtils';

interface MealTrackerProps {
  record: DailyRecord;
  apiKey: string;
  onChange: (record: DailyRecord) => void;
}

const MEAL_CONFIG: {
  type: MealType;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  placeholder: string;
}[] = [
  { type: 'breakfast', label: '早餐', icon: Coffee, color: '#C9934A', bg: 'from-amber-50', placeholder: '如：燕麦片' },
  { type: 'lunch', label: '午餐', icon: Sun, color: '#A3B899', bg: 'from-green-50', placeholder: '如：米饭+鸡胸肉' },
  { type: 'dinner', label: '晚餐', icon: Moon, color: '#8B7EC8', bg: 'from-violet-50', placeholder: '如：蔬菜沙拉' },
  { type: 'snack', label: '加餐', icon: Cookie, color: '#EBB193', bg: 'from-orange-50', placeholder: '如：蛋白棒' },
];

const QUICK_FOODS = [
  { name: '白米饭(1碗)', calories: 232 },
  { name: '鸡胸肉(100g)', calories: 165 },
  { name: '水煮蛋', calories: 77 },
  { name: '牛奶(250ml)', calories: 135 },
  { name: '全麦面包', calories: 69 },
  { name: '香蕉', calories: 89 },
  { name: '苹果', calories: 52 },
  { name: '燕麦片(50g)', calories: 189 },
];

function MealSection({
  config,
  items,
  apiKey,
  onAdd,
  onRemove,
  onUpdate,
}: {
  config: (typeof MEAL_CONFIG)[0];
  items: FoodItem[];
  apiKey: string;
  onAdd: (item: FoodItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (item: FoodItem) => void;
}) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [toast, setToast] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [aiMacros, setAiMacros] = useState<{ protein?: number; carbs?: number; fat?: number; sodium?: number } | null>(null);

  const Icon = config.icon;
  const total = items.reduce((s, f) => s + f.calories, 0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleAdd = () => {
    if (!name.trim() || !calories) return;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), calories: Number(calories), ...(aiMacros ?? {}) });
    setName('');
    setCalories('');
    setAiMacros(null);
  };

  const handleQuickAdd = (food: { name: string; calories: number }) => {
    onAdd({ id: crypto.randomUUID(), ...food });
    setShowQuick(false);
  };

  const handleAIEstimate = async () => {
    if (!name.trim()) return;
    if (!apiKey) {
      showToast('请先在设置中填写 DeepSeek API Key');
      return;
    }
    setEstimating(true);
    try {
      const result = await estimateCalories(apiKey, name.trim());
      setName(safeNormalizeString(result.food_name));
      setCalories(String(result.calories));
      setAiMacros({ protein: result.protein, carbs: result.carbs, fat: result.fat, sodium: result.sodium });
      showToast(`AI 估算约 ${result.calories} kcal · ${safeNormalizeString(result.reason)}`);
    } catch {
      showToast('AI 估算失败，请手动输入热量');
    } finally {
      setEstimating(false);
    }
  };

  const handleNameBlur = () => {
    if (name.trim() && !calories && apiKey && !estimating) {
      handleAIEstimate();
    }
  };

  const startEdit = (item: FoodItem) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditCalories(String(item.calories));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
    setEditCalories('');
  };

  const saveEdit = () => {
    if (!editId || !editName.trim() || !editCalories) return;
    onUpdate({ id: editId, name: safeNormalizeString(editName.trim()), calories: Number(editCalories) });
    cancelEdit();
  };

  const canEstimate = name.trim().length > 0 && !estimating;

  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${config.bg} to-transparent p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.color}20` }}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <span className="font-semibold text-foreground">{config.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs font-medium" style={{ color: config.color }}>
          {total} kcal
        </Badge>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {items.map(item =>
            editId === item.id ? (
              <div
                key={item.id}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border animate-in fade-in duration-150"
                style={{ backgroundColor: `${config.color}0D`, borderColor: `${config.color}40` }}
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="flex-1 min-w-0 text-sm bg-transparent border-b outline-none py-0.5"
                  style={{ borderColor: `${config.color}60` }}
                />
                <input
                  type="number"
                  value={editCalories}
                  onChange={e => setEditCalories(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="w-14 text-sm bg-transparent border-b outline-none text-right py-0.5"
                  style={{ borderColor: `${config.color}60` }}
                />
                <span className="text-xs text-muted-foreground flex-shrink-0">kcal</span>
                <button
                  onClick={saveEdit}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-card/60 active:scale-90 transition-all cursor-pointer flex-shrink-0"
                  style={{ color: config.color }}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-card/60 active:scale-90 transition-all cursor-pointer flex-shrink-0 text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                key={item.id}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-card/70 border border-border/50 group"
              >
                <span className="text-sm text-foreground flex-1 min-w-0 truncate mr-2">{item.name}</span>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-xs font-medium" style={{ color: config.color }}>{item.calories} kcal</span>
                  <button
                    onClick={() => startEdit(item)}
                    aria-label="编辑"
                    className="w-9 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-foreground active:scale-90 transition-all cursor-pointer opacity-0 group-hover:opacity-100 sm:block hidden"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    aria-label="编辑"
                    className="w-9 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-foreground active:scale-90 transition-all cursor-pointer sm:hidden"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    aria-label="删除"
                    className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive active:scale-90 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="relative space-y-2">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setAiMacros(null); }}
            onBlur={handleNameBlur}
            placeholder={config.placeholder}
            className="bg-card/80 border-border/70 text-foreground placeholder:text-muted-foreground text-sm flex-1 min-w-0"
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd(); }}
          />
          <button
            onClick={handleAIEstimate}
            disabled={!canEstimate}
            title="AI 估算热量"
            className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center transition-all cursor-pointer border ${
              canEstimate
                ? 'border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary'
                : 'border-border/40 bg-card/50 text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            {estimating ? (
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
          <Input
            type="number"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            placeholder="kcal"
            className="bg-card/80 border-border/70 text-foreground placeholder:text-muted-foreground text-sm w-16 flex-shrink-0"
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd(); }}
          />
          <Button
            size="icon"
            onClick={handleAdd}
            className="cursor-pointer flex-shrink-0 text-white"
            style={{ backgroundColor: config.color }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {toast && (
          <div className="absolute left-0 right-0 -top-10 z-20 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-foreground/90 text-background text-xs shadow-lg max-w-xs text-center leading-snug">
              {toast}
            </div>
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowQuick(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors underline underline-offset-2"
        >
          {showQuick ? '收起' : '快速添加常见食物'}
        </button>
        {showQuick && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_FOODS.map(food => (
              <button
                key={food.name}
                onClick={() => handleQuickAdd(food)}
                className="px-2 py-1 text-xs rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground transition-colors cursor-pointer"
              >
                {food.name} ({food.calories})
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MealTracker({ record, apiKey, onChange }: MealTrackerProps) {
  const handleAdd = (mealType: MealType, item: FoodItem) => {
    onChange({
      ...record,
      meals: { ...record.meals, [mealType]: [...record.meals[mealType], item] },
    });
  };

  const handleRemove = (mealType: MealType, id: string) => {
    onChange({
      ...record,
      meals: { ...record.meals, [mealType]: record.meals[mealType].filter(f => f.id !== id) },
    });
  };

  const handleUpdate = (mealType: MealType, updated: FoodItem) => {
    onChange({
      ...record,
      meals: {
        ...record.meals,
        [mealType]: record.meals[mealType].map(f => f.id === updated.id ? updated : f),
      },
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {MEAL_CONFIG.map(config => (
        <MealSection
          key={config.type}
          config={config}
          items={record.meals[config.type]}
          apiKey={apiKey}
          onAdd={item => handleAdd(config.type, item)}
          onRemove={id => handleRemove(config.type, id)}
          onUpdate={updated => handleUpdate(config.type, updated)}
        />
      ))}
    </div>
  );
}
