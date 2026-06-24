import { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Droplets, Plus, Trash2, ArrowRight } from 'lucide-react';
import HistoryMealSection from './HistoryMealSection';
import type { DailyRecord, FoodItem, MealType, ExerciseItem, WaterItem } from '../../types';
import { loadRecordByDate, saveRecordByDate } from '../../utils/storage';
import { idbGetRecord, idbSaveRecord } from '../../utils/indexedDB';

interface HistoryDayEditorProps {
  date: string;
  apiKey: string;
  isToday: boolean;
  onSwitchToToday: () => void;
}

const MEAL_CONFIGS: { type: MealType; label: string; accent: string }[] = [
  { type: 'breakfast', label: '早餐', accent: '#F97316' },
  { type: 'lunch', label: '午餐', accent: '#22C55E' },
  { type: 'dinner', label: '晚餐', accent: '#3B82F6' },
  { type: 'snack', label: '加餐', accent: '#EC4899' },
];

function emptyRecord(date: string): DailyRecord {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
    exercises: [],
    water: [],
  };
}

export default function HistoryDayEditor({
  date,
  apiKey,
  isToday,
  onSwitchToToday,
}: HistoryDayEditorProps) {
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [exerciseInput, setExerciseInput] = useState('');
  const [exerciseCal, setExerciseCal] = useState('');
  const [waterInput, setWaterInput] = useState('');

  useEffect(() => {
    setRecord(null);
    async function load() {
      let rec: DailyRecord | null = null;
      try {
        rec = await idbGetRecord(date);
      } catch {}
      if (!rec) {
        rec = loadRecordByDate(date);
      }
      setRecord(rec ?? emptyRecord(date));
    }
    load();
  }, [date]);

  const persist = useCallback((rec: DailyRecord) => {
    saveRecordByDate(rec);
    idbSaveRecord(rec).catch(() => {});
  }, []);

  const handleFoodAdd = (mealType: MealType, item: FoodItem) => {
    setRecord(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        meals: { ...prev.meals, [mealType]: [...prev.meals[mealType], item] },
      };
      persist(updated);
      return updated;
    });
  };

  const handleFoodRemove = (mealType: MealType, id: string) => {
    setRecord(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        meals: {
          ...prev.meals,
          [mealType]: prev.meals[mealType].filter(f => f.id !== id),
        },
      };
      persist(updated);
      return updated;
    });
  };

  const handleExerciseAdd = () => {
    const name = exerciseInput.trim();
    const calories = parseInt(exerciseCal, 10);
    if (!name || isNaN(calories) || calories < 0) return;
    setRecord(prev => {
      if (!prev) return prev;
      const item: ExerciseItem = { id: crypto.randomUUID(), name, duration: 0, calories };
      const updated = { ...prev, exercises: [...prev.exercises, item] };
      persist(updated);
      return updated;
    });
    setExerciseInput('');
    setExerciseCal('');
  };

  const handleExerciseRemove = (id: string) => {
    setRecord(prev => {
      if (!prev) return prev;
      const updated = { ...prev, exercises: prev.exercises.filter(e => e.id !== id) };
      persist(updated);
      return updated;
    });
  };

  const handleWaterAdd = () => {
    const amount = parseInt(waterInput, 10);
    if (isNaN(amount) || amount <= 0) return;
    setRecord(prev => {
      if (!prev) return prev;
      const item: WaterItem = { id: crypto.randomUUID(), amount, note: '', time: '' };
      const updated = { ...prev, water: [...(prev.water || []), item] };
      persist(updated);
      return updated;
    });
    setWaterInput('');
  };

  const handleWaterRemove = (id: string) => {
    setRecord(prev => {
      if (!prev) return prev;
      const updated = { ...prev, water: (prev.water || []).filter(w => w.id !== id) };
      persist(updated);
      return updated;
    });
  };

  if (isToday) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ArrowRight className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground text-center">今天的记录在「今日手帐」中编辑</p>
        <button
          onClick={onSwitchToToday}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium cursor-pointer transition-all active:scale-95"
        >
          前往今日手帐
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const exerciseTotal = record.exercises.reduce((s, e) => s + e.calories, 0);
  const waterTotal = (record.water || []).reduce((s, w) => s + w.amount, 0);

  return (
    <div className="space-y-3">
      {MEAL_CONFIGS.map(cfg => (
        <HistoryMealSection
          key={cfg.type}
          label={cfg.label}
          accent={cfg.accent}
          items={record.meals[cfg.type]}
          apiKey={apiKey}
          onAdd={item => handleFoodAdd(cfg.type, item)}
          onRemove={id => handleFoodRemove(cfg.type, id)}
        />
      ))}

      <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/60">
          <div className="flex items-center gap-1.5">
            <Dumbbell className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-500">运动</span>
          </div>
          <span className="text-xs font-bold text-blue-400 tabular-nums">-{exerciseTotal} kcal</span>
        </div>
        <div className="px-4 py-2.5 space-y-1.5">
          {record.exercises.length === 0 && (
            <p className="text-xs text-muted-foreground/40 py-0.5">暂无运动记录</p>
          )}
          {record.exercises.map(ex => (
            <div key={ex.id} className="flex items-center justify-between py-0.5">
              <span className="text-sm text-foreground flex-1 truncate">{ex.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-muted-foreground">{ex.calories} kcal</span>
                <button
                  onClick={() => handleExerciseRemove(ex.id)}
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
              value={exerciseInput}
              onChange={e => setExerciseInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && exerciseCal && handleExerciseAdd()}
              placeholder="运动名称"
              className="flex-1 h-8 rounded-xl border border-border bg-card/80 px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <input
              type="number"
              inputMode="numeric"
              value={exerciseCal}
              onChange={e => setExerciseCal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleExerciseAdd()}
              placeholder="kcal"
              className="w-16 h-8 rounded-xl border border-border bg-card/80 px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none text-right"
            />
            <button
              onClick={handleExerciseAdd}
              disabled={!exerciseInput.trim() || !exerciseCal}
              className="w-8 h-8 rounded-xl bg-blue-400 flex items-center justify-center text-white cursor-pointer disabled:opacity-40 active:scale-90 transition-all flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-sky-50/60">
          <div className="flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-semibold text-sky-500">喝水</span>
          </div>
          <span className="text-xs font-bold text-sky-400 tabular-nums">{waterTotal} ml</span>
        </div>
        <div className="px-4 py-2.5 space-y-1.5">
          {(record.water || []).length === 0 && (
            <p className="text-xs text-muted-foreground/40 py-0.5">暂无饮水记录</p>
          )}
          {(record.water || []).map(w => (
            <div key={w.id} className="flex items-center justify-between py-0.5">
              <span className="text-sm text-foreground">
                {w.amount} ml{w.note ? ` · ${w.note}` : ''}
              </span>
              <button
                onClick={() => handleWaterRemove(w.id)}
                className="w-6 h-6 flex items-center justify-center text-muted-foreground/40 hover:text-destructive cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="number"
              inputMode="numeric"
              value={waterInput}
              onChange={e => setWaterInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWaterAdd()}
              placeholder="输入水量 ml"
              className="flex-1 h-8 rounded-xl border border-border bg-card/80 px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <button
              onClick={handleWaterAdd}
              disabled={!waterInput}
              className="w-8 h-8 rounded-xl bg-sky-400 flex items-center justify-center text-white cursor-pointer disabled:opacity-40 active:scale-90 transition-all flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
