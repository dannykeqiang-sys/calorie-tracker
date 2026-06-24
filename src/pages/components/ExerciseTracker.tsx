import { useState } from 'react';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Badge } from '@/components/shadcn/badge';
import { Plus, Trash2, Dumbbell, Timer, Check, X, Pencil } from 'lucide-react';
import type { DailyRecord, ExerciseItem } from '../../types';

interface ExerciseTrackerProps {
  record: DailyRecord;
  onChange: (record: DailyRecord) => void;
}

const QUICK_EXERCISES = [
  { name: '跑步', caloriesPerMin: 10 },
  { name: '骑行', caloriesPerMin: 8 },
  { name: '游泳', caloriesPerMin: 9 },
  { name: '力量训练', caloriesPerMin: 6 },
  { name: '瑜伽', caloriesPerMin: 4 },
  { name: '健步走', caloriesPerMin: 5 },
  { name: 'HIIT', caloriesPerMin: 12 },
  { name: '跳绳', caloriesPerMin: 11 },
];

export default function ExerciseTracker({ record, onChange }: ExerciseTrackerProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const [quickMin, setQuickMin] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editCalories, setEditCalories] = useState('');

  const totalBurn = record.exercises.reduce((s, e) => s + e.calories, 0);
  const totalMin = record.exercises.reduce((s, e) => s + e.duration, 0);

  const handleAdd = () => {
    if (!name.trim() || !duration || !calories) return;
    const item: ExerciseItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      duration: Number(duration),
      calories: Number(calories),
    };
    onChange({ ...record, exercises: [...record.exercises, item] });
    setName('');
    setDuration('');
    setCalories('');
  };

  const handleRemove = (id: string) => {
    onChange({ ...record, exercises: record.exercises.filter(e => e.id !== id) });
  };

  const handleQuickAdd = (ex: { name: string; caloriesPerMin: number }) => {
    const mins = Number(quickMin[ex.name] || 30);
    const item: ExerciseItem = {
      id: crypto.randomUUID(),
      name: ex.name,
      duration: mins,
      calories: Math.round(ex.caloriesPerMin * mins),
    };
    onChange({ ...record, exercises: [...record.exercises, item] });
  };

  const startEdit = (item: ExerciseItem) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditDuration(String(item.duration));
    setEditCalories(String(item.calories));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
    setEditDuration('');
    setEditCalories('');
  };

  const saveEdit = () => {
    if (!editId || !editName.trim() || !editCalories) return;
    const updated: ExerciseItem = {
      id: editId,
      name: editName.trim(),
      duration: Number(editDuration) || 0,
      calories: Number(editCalories),
    };
    onChange({
      ...record,
      exercises: record.exercises.map(e => e.id === editId ? updated : e),
    });
    cancelEdit();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-blue-50 to-transparent p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-blue-500" />
            </div>
            <span className="font-semibold text-foreground">运动记录</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>{totalMin} 分钟</span>
            </div>
            <Badge variant="secondary" className="text-xs text-blue-500">
              消耗 {totalBurn} kcal
            </Badge>
          </div>
        </div>

        {record.exercises.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
            {record.exercises.map(item =>
              editId === item.id ? (
                <div
                  key={item.id}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-200 animate-in fade-in duration-150"
                >
                  <Dumbbell className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 min-w-0 text-sm bg-transparent border-b border-blue-300 outline-none py-0.5"
                    placeholder="运动名称"
                  />
                  <input
                    type="number"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="w-10 text-sm bg-transparent border-b border-blue-300 outline-none text-right py-0.5 flex-shrink-0"
                    placeholder="分钟"
                  />
                  <span className="text-xs text-muted-foreground flex-shrink-0">分</span>
                  <input
                    type="number"
                    value={editCalories}
                    onChange={e => setEditCalories(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="w-12 text-sm bg-transparent border-b border-blue-300 outline-none text-right py-0.5 flex-shrink-0"
                    placeholder="kcal"
                  />
                  <span className="text-xs text-muted-foreground flex-shrink-0">kcal</span>
                  <button
                    onClick={saveEdit}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-100 active:scale-90 transition-all cursor-pointer flex-shrink-0 text-blue-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-100 active:scale-90 transition-all cursor-pointer flex-shrink-0 text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-card/70 border border-border/50 group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Dumbbell className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-foreground truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{item.duration}分钟</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <span className="text-xs font-medium text-blue-500">{item.calories} kcal</span>
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
                      onClick={() => handleRemove(item.id)}
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

        <div className="grid grid-cols-3 gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="运动名称"
            className="bg-card/80 border-border/70 text-foreground placeholder:text-muted-foreground text-sm col-span-1"
          />
          <Input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="时长(分)"
            className="bg-card/80 border-border/70 text-foreground placeholder:text-muted-foreground text-sm"
          />
          <div className="flex gap-1">
            <Input
              type="number"
              value={calories}
              onChange={e => setCalories(e.target.value)}
              placeholder="kcal"
              className="bg-card/80 border-border/70 text-foreground placeholder:text-muted-foreground text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button
              size="icon"
              onClick={handleAdd}
              className="cursor-pointer flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowQuick(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors underline underline-offset-2"
          >
            {showQuick ? '收起' : '快速添加常见运动'}
          </button>
          {showQuick && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_EXERCISES.map(ex => (
                <div key={ex.name} className="rounded-xl bg-card border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{ex.name}</span>
                    <span className="text-xs text-muted-foreground">{ex.caloriesPerMin}kcal/分</span>
                  </div>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      value={quickMin[ex.name] ?? '30'}
                      onChange={e => setQuickMin(p => ({ ...p, [ex.name]: e.target.value }))}
                      className="bg-muted border-border text-foreground text-xs h-7 px-2"
                      placeholder="分钟"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleQuickAdd(ex)}
                      className="h-7 px-2 text-xs cursor-pointer bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
