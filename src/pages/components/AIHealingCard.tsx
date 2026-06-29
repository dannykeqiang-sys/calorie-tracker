import { useMemo } from 'react';
import { Sparkles, Droplets, Dumbbell, Flame, TrendingUp, BookOpen } from 'lucide-react';
import type { UserProfile } from '../../types';

export interface DayStats {
  date: string;
  label: string;
  intake: number;
  burn: number;
  water: number;
  pureWater: number;
  foodWater: number;
  net: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  exercises: { name: string; duration: number; calories: number }[];
  weight?: number;
  /** 四餐热量 [早餐, 午餐, 晚餐, 加餐] */
  mealCals: number[];
}

interface AIHealingCardProps {
  stats: DayStats[];
  profile: UserProfile | null;
  activeDaysCount: number;
  waterDays: number;
  exerciseDays: number;
  daysOnTarget: number;
  targetCalories: number;
  selectedDate?: string;
}

// ─── 状态分类 ────────────────────────────────────────────

export type DayState = 'perfect' | 'good' | 'normal' | 'overeat' | 'undereat' | 'no_data';

export interface StateConfig {
  emoji: string;
  title: string;
  tone: string;
  gradient: string;
  accentColor: string;
  blobTop: string;
  blobBot: string;
}

export const STATE_CONFIGS: Record<DayState, StateConfig> = {
  perfect: {
    emoji: '🌟',
    title: '今日高光',
    tone: '完美日',
    gradient: 'linear-gradient(135deg, rgba(255,215,120,0.55) 0%, rgba(255,170,110,0.45) 55%, rgba(255,205,155,0.35) 100%)',
    accentColor: '#b45309',
    blobTop: 'rgba(255,205,90,0.5)',
    blobBot: 'rgba(255,165,130,0.4)',
  },
  good: {
    emoji: '😊',
    title: '温柔一天',
    tone: '良好日',
    gradient: 'linear-gradient(135deg, rgba(180,235,200,0.55) 0%, rgba(155,225,205,0.45) 55%, rgba(205,242,225,0.35) 100%)',
    accentColor: '#047857',
    blobTop: 'rgba(140,230,185,0.45)',
    blobBot: 'rgba(185,242,210,0.35)',
  },
  normal: {
    emoji: '😌',
    title: '平稳日记',
    tone: '普通日',
    gradient: 'linear-gradient(135deg, rgba(205,220,240,0.55) 0%, rgba(220,232,248,0.45) 55%, rgba(238,243,252,0.35) 100%)',
    accentColor: '#475569',
    blobTop: 'rgba(185,205,235,0.45)',
    blobBot: 'rgba(220,232,248,0.35)',
  },
  overeat: {
    emoji: '😅',
    title: '温柔提醒',
    tone: '超标日',
    gradient: 'linear-gradient(135deg, rgba(255,205,200,0.55) 0%, rgba(255,218,205,0.45) 55%, rgba(255,230,220,0.35) 100%)',
    accentColor: '#b91c1c',
    blobTop: 'rgba(255,185,175,0.45)',
    blobBot: 'rgba(255,215,200,0.35)',
  },
  undereat: {
    emoji: '📉',
    title: '关怀提醒',
    tone: '节食日',
    gradient: 'linear-gradient(135deg, rgba(255,230,180,0.55) 0%, rgba(255,240,205,0.45) 55%, rgba(255,247,225,0.35) 100%)',
    accentColor: '#92400e',
    blobTop: 'rgba(255,220,150,0.45)',
    blobBot: 'rgba(255,238,185,0.35)',
  },
  no_data: {
    emoji: '📝',
    title: '新的开始',
    tone: '未记录',
    gradient: 'linear-gradient(135deg, rgba(222,212,248,0.55) 0%, rgba(235,228,252,0.45) 55%, rgba(245,240,255,0.35) 100%)',
    accentColor: '#6d28d9',
    blobTop: 'rgba(205,185,245,0.45)',
    blobBot: 'rgba(232,220,252,0.35)',
  },
};

export function classifyDay(today: DayStats, target: number): DayState {
  if (today.intake === 0) return 'no_data';
  const ratio = today.intake / Math.max(target, 1);
  const hasExercise = today.burn > 0;
  const hasWater = today.water >= 1500;

  if (ratio < 0.70) return 'undereat';
  if (ratio > 1.10) return 'overeat';
  if (ratio >= 0.90 && ratio <= 1.10 && hasExercise && hasWater) return 'perfect';
  if (ratio >= 0.85 && ratio <= 1.15 && (hasExercise || hasWater)) return 'good';
  return 'normal';
}

// ─── 内容生成 ────────────────────────────────────────────

function calcStreak(stats: DayStats[]): number {
  let streak = 0;
  for (let i = stats.length - 1; i >= 0; i--) {
    if (stats[i].intake > 0) streak++;
    else break;
  }
  return streak;
}

function buildMessage(state: DayState, today: DayStats, name: string): string {
  switch (state) {
    case 'perfect':
      return `${name}，今天你简直是无懈可击！热量精准、水分充足、还动了身体——给自己一个大大的拥抱吧！`;
    case 'good': {
      const gap = today.water < 1500 ? '多喝两杯水' : today.burn === 0 ? '加个小运动' : '再早点睡';
      return `${name}，很棒的一天！饮食控制得很好，如果${gap}就完美了～`;
    }
    case 'normal':
      return `${name}，平稳的一天，热量在合理范围内。身体喜欢稳定的节奏，继续保持。`;
    case 'overeat':
      return `${name}，今天吃得开心吗？没关系，偶尔放纵是生活的调味剂。明天我们可以从一杯温水开始～`;
    case 'undereat':
      return `${name}，今天吃得有点少哦，身体需要足够的燃料才能运转。记得好好吃饭，你值得被好好对待。`;
    case 'no_data':
      return `${name}，今天还没有记录，花 30 秒记一下吧？每一次记录都是和自己的对话。`;
  }
}

interface Highlight {
  icon: typeof Flame;
  label: string;
  value: string;
  color: string;
}

function buildHighlights(state: DayState, today: DayStats): Highlight[] {
  if (state === 'no_data') return [];

  const highlights: Highlight[] = [];
  const meals = today.mealCals ?? [0, 0, 0, 0];
  const mealNames = ['早餐', '午餐', '晚餐', '加餐'];
  const maxMeal = Math.max(...meals);
  const bestIdx = meals.indexOf(maxMeal);

  if (maxMeal > 0) {
    highlights.push({
      icon: Flame,
      label: '最佳一餐',
      value: `${mealNames[bestIdx]} ${maxMeal}kcal`,
      color: '#f97316',
    });
  }

  if (today.burn > 0) {
    const topExercise = today.exercises.reduce(
      (top, e) => (e.calories > (top?.calories ?? 0) ? e : top),
      today.exercises[0] as { name: string; calories: number } | undefined,
    );
    highlights.push({
      icon: Dumbbell,
      label: '运动成就',
      value: topExercise ? `${topExercise.name} ${today.burn}kcal` : `消耗 ${today.burn}kcal`,
      color: '#22c55e',
    });
  }

  if (today.water > 0) {
    const pct = Math.min(Math.round((today.water / 2000) * 100), 100);
    highlights.push({
      icon: Droplets,
      label: '水分进度',
      value: `${today.water}ml · ${pct}%`,
      color: today.water >= 1500 ? '#0ea5e9' : '#f59e0b',
    });
  }

  if (state === 'perfect') {
    highlights.push({
      icon: Sparkles,
      label: '全项达标',
      value: '完美日 ✨',
      color: '#eab308',
    });
  }

  return highlights.slice(0, 3);
}

function buildSuggestion(state: DayState, today: DayStats): string {
  switch (state) {
    case 'perfect':
      return '保持今天的节奏，你就是自己的模范';
    case 'good':
      return today.water < 1500 ? '明天起床后先来一杯温水' : '再加一份深色蔬菜，微量元素更完整';
    case 'normal':
      return '明天加个 20 分钟散步，给身体多一点活力';
    case 'overeat':
      return '明天从一份清爽的早餐开始，让身体轻松重启';
    case 'undereat':
      return '明天给自己准备一份蛋白质丰富的早餐';
    case 'no_data':
      return '从记录下一餐开始，30 秒就够了';
  }
}

// ─── 组件 ────────────────────────────────────────────────

export default function AIHealingCard({
  stats,
  profile,
  targetCalories,
  selectedDate,
}: AIHealingCardProps) {
  const name = profile?.name || '你';

  // Find the day matching selectedDate, or fallback to the last day
  const today = useMemo(() => {
    if (selectedDate && stats.length > 0) {
      const found = stats.find(s => s.date === selectedDate);
      if (found) return found;
    }
    return stats.length > 0 ? stats[stats.length - 1] : null;
  }, [stats, selectedDate]);

  const state = today ? classifyDay(today, targetCalories) : 'no_data';
  const cfg = STATE_CONFIGS[state];
  const message = today ? buildMessage(state, today, name) : buildMessage('no_data', { intake: 0 } as DayStats, name);
  const highlights = today ? buildHighlights(state, today) : [];
  const suggestion = today ? buildSuggestion(state, today) : buildSuggestion('no_data', {} as DayStats);
  const streak = calcStreak(stats);
  const dateLabel = today?.label ?? '今日';

  return (
    <div
      className="rounded-3xl p-5 border border-white/50 relative overflow-hidden"
      style={{
        background: cfg.gradient,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        transition: 'background 0.6s ease',
      }}
    >
      {/* 装饰光斑 */}
      <div
        className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${cfg.blobTop}, transparent 70%)`,
          transition: 'background 0.6s ease',
        }}
      />
      <div
        className="absolute -bottom-8 -left-6 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${cfg.blobBot}, transparent 70%)`,
          transition: 'background 0.6s ease',
        }}
      />

      {/* 头部：emoji + 标题 + 连续天数 */}
      <div className="relative flex items-center gap-3 mb-4">
        <div
          className="text-3xl flex-shrink-0 select-none"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}
        >
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-foreground leading-none">{cfg.title}</p>
          <p className="text-[10px] text-foreground/55 mt-1 font-medium">
            {cfg.tone} · {dateLabel}
          </p>
        </div>
        {streak > 0 && (
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(255,255,255,0.8)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <span className="text-[11px]">🔥</span>
            <span className="text-[11px] font-bold" style={{ color: cfg.accentColor }}>
              {streak} 天
            </span>
          </div>
        )}
      </div>

      {/* 主消息框 */}
      <div
        className="relative rounded-2xl px-4 py-3.5 mb-3.5 border border-white/60"
        style={{ background: 'rgba(255,255,255,0.62)' }}
      >
        <span
          className="absolute top-1.5 left-3 text-foreground/20 text-3xl font-serif leading-none select-none"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          "
        </span>
        <p
          className="text-sm leading-relaxed text-foreground/90 pl-3 pr-2 italic"
          style={{ fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif' }}
        >
          {message}
        </p>
        <span
          className="absolute bottom-1 right-3 text-foreground/20 text-3xl font-serif leading-none select-none"
          style={{ fontFamily: 'Georgia, serif', transform: 'rotate(180deg)', display: 'inline-block' }}
        >
          "
        </span>
      </div>

      {/* 数据亮点 */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <div
                key={i}
                className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 text-center"
                style={{
                  background: 'rgba(255,255,255,0.58)',
                  border: '1px solid rgba(255,255,255,0.75)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: h.color }} />
                <span className="text-[9px] text-foreground/55 leading-tight mt-0.5">{h.label}</span>
                <span className="text-[10px] font-bold text-foreground/85 leading-tight">{h.value}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 明日建议 */}
      {state !== 'no_data' && (
        <div
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.48)',
            border: '1px solid rgba(255,255,255,0.65)',
          }}
        >
          <TrendingUp
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
            style={{ color: cfg.accentColor }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold text-foreground/55 leading-none mb-1 tracking-wide uppercase">
              明日建议
            </p>
            <p className="text-[11px] text-foreground/80 leading-snug">{suggestion}</p>
          </div>
        </div>
      )}

      {/* 无数据引导 */}
      {state === 'no_data' && (
        <div
          className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.55)',
            border: '1px dashed rgba(109,40,217,0.35)',
          }}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: cfg.accentColor }} />
          <p className="text-[11px] font-semibold" style={{ color: cfg.accentColor }}>
            点击下方"+ 记录"开始今天的第一笔
          </p>
        </div>
      )}
    </div>
  );
}
