import { useMemo } from 'react';
import { Sparkles, Star, Target, Droplets, Dumbbell, Trophy } from 'lucide-react';
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
}

function generateInsight(
  name: string,
  activeDays: number,
  waterDays: number,
  exerciseDays: number,
  daysOnTarget: number,
): string {
  if (activeDays === 0) {
    return `${name}，打开这里就是第一步。不用完美，只要开始，每一次记录都是你对自己最温柔的承诺。`;
  }
  const highlights: string[] = [];
  if (waterDays >= 5) highlights.push(`这周有 ${waterDays} 天都在认真喝水，身体一定感受到了你的温柔`);
  else if (waterDays >= 3) highlights.push(`这周喝水达标 ${waterDays} 天，细胞们在悄悄感谢你`);
  if (exerciseDays >= 4) highlights.push(`运动坚持了 ${exerciseDays} 天，活力值满满`);
  else if (exerciseDays >= 2) highlights.push(`动起来了 ${exerciseDays} 天，每一步都算数`);
  if (daysOnTarget >= 5) highlights.push(`热量达标 ${daysOnTarget} 天，饮食节律越来越稳`);
  else if (daysOnTarget >= 3) highlights.push(`${daysOnTarget} 天保持了不错的热量节制`);
  if (highlights.length === 0) {
    if (activeDays >= 5) return `${name}，连续记录了 ${activeDays} 天，这种持续的自我关注本身就是一种修行。继续保持。`;
    return `${name}，已记录 ${activeDays} 天，了解自己是改变的起点。你走在对的路上，不要停。`;
  }
  return `${name}，${highlights.join('，')}。每一天的坚持，都在温柔地照顾你自己。`;
}

interface TagConfig {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}

function buildTags(activeDays: number, waterDays: number, exerciseDays: number, daysOnTarget: number): TagConfig[] {
  const tags: TagConfig[] = [];
  if (activeDays >= 7) tags.push({ label: '完美记录周', color: '#8B5CF6', bg: 'rgba(139,92,246,0.13)', icon: Trophy });
  else if (activeDays >= 5) tags.push({ label: `记录 ${activeDays} 天`, color: '#6366F1', bg: 'rgba(99,102,241,0.13)', icon: Target });
  if (daysOnTarget >= 5) tags.push({ label: '热量达标', color: '#22C55E', bg: 'rgba(34,197,94,0.13)', icon: Trophy });
  if (waterDays >= 5) tags.push({ label: '水分充盈', color: '#0EA5E9', bg: 'rgba(14,165,233,0.13)', icon: Droplets });
  if (exerciseDays >= 3) tags.push({ label: '运动达人', color: '#F97316', bg: 'rgba(249,115,22,0.13)', icon: Dumbbell });
  return tags;
}

export default function AIHealingCard({
  profile,
  activeDaysCount,
  waterDays,
  exerciseDays,
  daysOnTarget,
}: AIHealingCardProps) {
  const name = profile?.name || '你';

  const message = useMemo(
    () => generateInsight(name, activeDaysCount, waterDays, exerciseDays, daysOnTarget),
    [name, activeDaysCount, waterDays, exerciseDays, daysOnTarget],
  );

  const tags = useMemo(
    () => buildTags(activeDaysCount, waterDays, exerciseDays, daysOnTarget),
    [activeDaysCount, waterDays, exerciseDays, daysOnTarget],
  );

  return (
    <div
      className="rounded-3xl p-5 border border-white/50 relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div
        className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(192,132,252,0.28), rgba(129,140,248,0.08) 70%)',
        }}
      />
      <div
        className="absolute -bottom-8 -left-6 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(251,207,232,0.35), transparent 70%)',
        }}
      />

      <div className="relative flex items-center gap-2.5 mb-4">
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #c084fc 0%, #818cf8 100%)',
            boxShadow: '0 4px 14px rgba(139,92,246,0.40)',
          }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-none">AI 周期治愈锦囊</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">近 7 天综合分析</p>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {[0, 1, 2].map(i => (
            <Star
              key={i}
              className="w-3 h-3 fill-amber-400 text-amber-400"
              style={{ opacity: 0.65 + i * 0.15 }}
            />
          ))}
        </div>
      </div>

      <div
        className="relative rounded-2xl px-4 py-3.5 mb-3.5 border border-white/60"
        style={{ background: 'rgba(255,255,255,0.58)' }}
      >
        <span
          className="absolute top-1.5 left-3 text-purple-300/60 text-3xl font-serif leading-none select-none"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          "
        </span>
        <p
          className="text-sm leading-relaxed text-foreground/85 pl-3 pr-2 italic"
          style={{ fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif' }}
        >
          {message}
        </p>
        <span
          className="absolute bottom-1 right-3 text-purple-300/60 text-3xl font-serif leading-none select-none"
          style={{ fontFamily: 'Georgia, serif', transform: 'rotate(180deg)', display: 'inline-block' }}
        >
          "
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => {
            const TagIcon = tag.icon;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: tag.bg, color: tag.color }}
              >
                <TagIcon className="w-3 h-3" />
                {tag.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
