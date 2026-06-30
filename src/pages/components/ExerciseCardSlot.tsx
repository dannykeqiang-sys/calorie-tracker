import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Timer, Zap } from 'lucide-react';
import { Input } from '@/components/shadcn/input';
import type { ExerciseItem } from '../../types';

export interface ExerciseSlotConfig {
  label: string;
  en: string;
  num: string;
  icon: React.ElementType;
  accent: string;
  time: string;
  imageUrl?: string;
}

interface ExerciseCardSlotProps {
  config: ExerciseSlotConfig;
  items: ExerciseItem[];
  isActive: boolean;
  isHighlighted: boolean;
  journalDate?: string;
  fullscreen?: boolean;
  bareMode?: boolean;
  noImage?: boolean;
  onAdd: (item: ExerciseItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (item: ExerciseItem) => void;
}

export default function ExerciseCardSlot({
  config,
  items,
  isActive,
  isHighlighted,
  fullscreen = false,
  bareMode = false,
  noImage = false,
  onAdd,
  onRemove,
  onUpdate,
}: ExerciseCardSlotProps) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editCalories, setEditCalories] = useState('');

  const Icon = config.icon;
  const totalBurn = items.reduce((s, e) => s + e.calories, 0);
  const totalMin = items.reduce((s, e) => s + e.duration, 0);
  const showDetails = bareMode ? isActive : (!fullscreen || isActive);

  const handleAdd = () => {
    if (!name.trim() || !calories) return;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), duration: Number(duration) || 0, calories: Number(calories) });
    setName('');
    setDuration('');
    setCalories('');
  };

  const startEdit = (item: ExerciseItem) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditDuration(String(item.duration));
    setEditCalories(String(item.calories));
  };

  const cancelEdit = () => { setEditId(null); setEditName(''); setEditDuration(''); setEditCalories(''); };

  const saveEdit = () => {
    if (!editId || !editName.trim() || !editCalories) return;
    onUpdate({ id: editId, name: editName.trim(), duration: Number(editDuration) || 0, calories: Number(editCalories) });
    cancelEdit();
  };

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
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, #EDF6FF, #D8EEFF)` }} />
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
          {totalMin > 0 && <span className="ml-2 tracking-normal normal-case">{totalMin} 分钟</span>}
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
        <div className="p-5 pb-2">
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
            <p className="text-sm font-bold tabular-nums pt-1" style={{ color: config.accent }}>-{totalBurn} kcal</p>
          </div>
        </div>

        <div
          className={fullscreen ? 'flex-1 overflow-y-auto px-5 space-y-1.5 min-h-0 pt-1' : 'px-5 space-y-1.5 pt-1'}
          style={{ pointerEvents: showDetails ? 'auto' : 'none' }}
        >
          {items.length === 0 && (
            <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 tracking-wide">
              快去动起来，记录今天的运动吧
            </div>
          )}
          {items.map((item, index) =>
            editId === item.id ? (
              <div
                key={item.id}
                className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-blue-50 border border-blue-200"
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  onFocus={e => { setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
                  className="flex-1 min-w-0 text-sm bg-transparent border-b border-blue-300 outline-none py-0.5"
                />
                <input
                  type="number"
                  value={editDuration}
                  onChange={e => setEditDuration(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="w-10 text-sm bg-transparent border-b border-blue-300 outline-none text-right py-0.5"
                  placeholder="分"
                />
                <span className="text-xs text-muted-foreground">分</span>
                <input
                  type="number"
                  value={editCalories}
                  onChange={e => setEditCalories(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="w-12 text-sm bg-transparent border-b border-blue-300 outline-none text-right py-0.5"
                />
                <span className="text-xs text-muted-foreground flex-shrink-0">kcal</span>
                <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center cursor-pointer active:scale-90 text-blue-500"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="w-7 h-7 flex items-center justify-center cursor-pointer active:scale-90 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div
                key={item.id}
                className="group flex items-center justify-between py-2.5 px-3 rounded-full bg-card/52 border border-border/58 hover:bg-card/68 transition-colors"
                style={{ animation: `exerciseItemIn 0.38s cubic-bezier(0.4,0,0.2,1) ${index * 0.06}s both` }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate">{item.name}</span>
                  {item.duration > 0 && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                      <Timer className="w-2.5 h-2.5" />{item.duration}分
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: config.accent }}>-{item.calories}</span>
                  <button
                    onClick={() => startEdit(item)}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground/40 hover:text-foreground active:scale-90 transition-all cursor-pointer opacity-0 group-hover:opacity-100 sm:flex hidden"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground/40 hover:text-foreground active:scale-90 transition-all cursor-pointer sm:hidden flex"
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
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/50">自定义记录</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="运动名称"
              className="flex-1 bg-card/72 border-border/60 text-sm h-10 rounded-full min-w-0"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="分钟"
              className="w-16 bg-card/72 border-border/60 text-sm h-10 rounded-full flex-shrink-0"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Input
              type="number"
              value={calories}
              onChange={e => setCalories(e.target.value)}
              placeholder="kcal"
              className="w-16 bg-card/72 border-border/60 text-sm h-10 rounded-full flex-shrink-0"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all cursor-pointer active:scale-90 flex-shrink-0"
              style={{ backgroundColor: config.accent }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes exerciseItemIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}
