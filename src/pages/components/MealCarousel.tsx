import { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import type { CSSProperties } from 'react';
import { Sunrise, Sun, Moon, Cookie, Dumbbell, Droplets, ChevronLeft, ChevronRight } from 'lucide-react';
import MealCardSlot from './MealCardSlot';
import ExerciseCardSlot from './ExerciseCardSlot';
import WaterCardSlot from './WaterCardSlot';
import type { MealSlotConfig, MacroTarget } from './MealCardSlot';
import type { ExerciseSlotConfig } from './ExerciseCardSlot';
import type { WaterSlotConfig } from './WaterCardSlot';
import type { DailyRecord, MealType, FoodItem, ExerciseItem, WaterItem, UserProfile } from '../../types';
import { calcMacroTargets, getDefaultMacroTargets } from '../../utils/calculations';

const MEAL_RATIOS: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
  snack: 0.10,
};

export type CarouselCardType = MealType | 'exercise' | 'water';

export interface MealCarouselRef {
  scrollToMeal: (type: CarouselCardType) => void;
}

export const CARD_ORDER: CarouselCardType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'exercise', 'water'];

export const IMAGE_POOLS: Record<CarouselCardType, string[]> = {
  breakfast: [
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&fit=crop&auto=format',
  ],
  lunch: [
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80&fit=crop&auto=format',
  ],
  dinner: [
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800&q=80&fit=crop&auto=format',
  ],
  snack: [
    'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=800&q=80&fit=crop&auto=format',
  ],
  exercise: [
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80&fit=crop&auto=format',
  ],
  water: [
    'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80&fit=crop&auto=format',
  ],
};

export function getDailyImageUrl(type: CarouselCardType, dateStr: string): string {
  const pool = IMAGE_POOLS[type] ?? [];
  if (!pool.length) return '';
  let hash = 0;
  for (const ch of (dateStr + type)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const rawUrl = pool[hash % pool.length];
  // Route through wsrv.nl CDN proxy for faster delivery and edge caching
  const noProtocol = rawUrl.replace(/^https?:\/\//, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(noProtocol)}`;
}

export const MEAL_CONFIGS_BASE: (Omit<MealSlotConfig, 'imageUrl'> & { type: MealType; pageBg: string })[] = [
  {
    type: 'breakfast',
    label: '早餐',
    en: 'BREAKFAST',
    num: '01',
    icon: Sunrise,
    gradientFrom: '#FFF7ED',
    gradientVia: '#FEF3E2',
    gradientTo: '#FFFBF5',
    accent: '#F97316',
    pageBg: 'linear-gradient(145deg, #FFF9F0, #FEEDD5, #FFF5E6)',
    time: '07:00 ~ 09:00',
    placeholder: '如：燕麦粥、鸡蛋、牛奶',
  },
  {
    type: 'lunch',
    label: '午餐',
    en: 'LUNCH',
    num: '02',
    icon: Sun,
    gradientFrom: '#F0FDF4',
    gradientVia: '#DCFCE7',
    gradientTo: '#F7FEF9',
    accent: '#22C55E',
    pageBg: 'linear-gradient(145deg, #F2FFF5, #D5F8E2, #EDFBF2)',
    time: '11:30 ~ 13:30',
    placeholder: '如：米饭、鸡胸肉、炒蔬菜',
  },
  {
    type: 'dinner',
    label: '晚餐',
    en: 'DINNER',
    num: '03',
    icon: Moon,
    gradientFrom: '#EFF6FF',
    gradientVia: '#DBEAFE',
    gradientTo: '#F5F9FF',
    accent: '#3B82F6',
    pageBg: 'linear-gradient(145deg, #F0F5FF, #D8E8FF, #EBF3FF)',
    time: '17:30 ~ 19:30',
    placeholder: '如：清蒸鱼、豆腐、绿叶菜',
  },
  {
    type: 'snack',
    label: '加餐',
    en: 'SNACK',
    num: '04',
    icon: Cookie,
    gradientFrom: '#FFF0F6',
    gradientVia: '#FCE7F3',
    gradientTo: '#FFF5FA',
    accent: '#EC4899',
    pageBg: 'linear-gradient(145deg, #FFF2F8, #FBE2F1, #FFF0F8)',
    time: '随时',
    placeholder: '如：水果、坚果、酸奶',
  },
];

export const EXERCISE_CONFIG_BASE: ExerciseSlotConfig & { pageBg: string } = {
  label: '运动',
  en: 'EXERCISE',
  num: '05',
  icon: Dumbbell,
  accent: '#60A5FA',
  pageBg: 'linear-gradient(145deg, #EDF6FF, #D8EEFF, #E8F4FF)',
  time: '',
};

export const WATER_CONFIG_BASE: WaterSlotConfig & { pageBg: string } = {
  label: '喝水',
  en: 'HYDRATION',
  num: '06',
  icon: Droplets,
  accent: '#0EA5E9',
  pageBg: 'linear-gradient(145deg, #EFF9FF, #E0F4FD, #F0F9FF)',
  time: '全天',
};

const ALL_ACCENT = [...MEAL_CONFIGS_BASE.map(c => c.accent), EXERCISE_CONFIG_BASE.accent, WATER_CONFIG_BASE.accent];

interface MealCarouselProps {
  record: DailyRecord;
  apiKey: string;
  isViewingToday?: boolean;
  profile?: UserProfile | null;
  journalDate?: string;
  fullscreen?: boolean;
  bareMode?: boolean;
  onChange: (record: DailyRecord) => void;
  onWaterReplace?: (items: WaterItem[]) => void;
  onActiveIndexChange?: (index: number) => void;
  onOpenAIInput?: () => void;
}

const MealCarousel = forwardRef<MealCarouselRef, MealCarouselProps>(
  ({ record, apiKey, isViewingToday = true, profile, journalDate, fullscreen = false, bareMode = false, onChange, onWaterReplace, onActiveIndexChange, onOpenAIInput }, ref) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [highlightedType, setHighlightedType] = useState<CarouselCardType | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const activeIndexRef = useRef(0);
    const onActiveIndexChangeRef = useRef(onActiveIndexChange);
    onActiveIndexChangeRef.current = onActiveIndexChange;

    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const [cardWidth, setCardWidth] = useState(() => {
      if (typeof window === 'undefined') return 320;
      return window.innerWidth >= 640 ? 400 : Math.round(window.innerWidth * 0.90);
    });
    const pointerStartX = useRef<number | null>(null);
    const GAP_PX = 16;

    const { proteinTarget, carbsTarget, fatTarget } = profile
      ? calcMacroTargets(profile)
      : getDefaultMacroTargets();

    const allItems = Object.values(record.meals).flat() as FoodItem[];
    const totalProtein = Math.round(allItems.reduce((s, f) => s + (f.protein ?? 0), 0));
    const totalCarbs = Math.round(allItems.reduce((s, f) => s + (f.carbs ?? 0), 0));
    const totalFat = Math.round(allItems.reduce((s, f) => s + (f.fat ?? 0), 0));

    const uneatenRatioSum = MEAL_CONFIGS_BASE
      .filter(m => record.meals[m.type].length === 0)
      .reduce((sum, m) => sum + MEAL_RATIOS[m.type], 0);

    // 智能推荐：根据时间和摄入缺口生成推荐
    const recommendations = useMemo(() => {
      if (!isViewingToday) return {} as Record<MealType, string>;
      const hour = new Date().getHours();
      const intake = allItems.reduce((s, f) => s + f.calories, 0);
      const totalWater = (record.water ?? []).reduce((s, w) => s + w.amount, 0);
      const waterGap = 2000 - totalWater;
      const hasExercise = (record.exercises ?? []).length > 0;
      const target = profile ? (() => {
        const bmr = profile.gender === 'male'
          ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
          : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
        const af: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
        const tdee = bmr * (af[profile.activityLevel] ?? 1.55);
        return Math.round(profile.goal === 'lose' ? tdee - 500 : profile.goal === 'gain' ? tdee + 300 : tdee);
      })() : 2000;
      const calRemaining = target - intake;

      const result: Record<MealType, string> = {} as Record<MealType, string>;
      const isCurrentMeal = (mt: MealType) => {
        if (mt === 'breakfast' && hour >= 7 && hour < 11) return true;
        if (mt === 'lunch' && hour >= 11 && hour < 15) return true;
        if (mt === 'dinner' && hour >= 17 && hour < 21) return true;
        return false;
      };

      for (const cfg of MEAL_CONFIGS_BASE) {
        if (record.meals[cfg.type].length > 0 || !isCurrentMeal(cfg.type)) continue;
        
        if (waterGap > 800) {
          result[cfg.type] = `🥗 胃口呼唤：你今天水份摄入偏低，${cfg.label}推荐来一份【冬瓜虾仁汤 + 荞麦面】，补水又饱腹，试试拍张照吧。`;
        } else if (hasExercise && totalCarbs < carbsTarget * 0.4 && (cfg.type === 'lunch' || cfg.type === 'dinner')) {
          result[cfg.type] = `🍠 能量补位：检测到你刚结束运动，当前最适合补充优质碳水。推荐【蒸甘薯 + 煎鸡胸肉】，去厨房准备一下吧！`;
        } else {
          result[cfg.type] = `📸 智能推荐：${cfg.label}时间到啦～来一份均衡搭配吧，拍照即可自动识别营养，开启${cfg.label}记录。`;
        }
      }
      return result;
    }, [isViewingToday, allItems, record, profile, totalCarbs, carbsTarget]);

    const dateStr = journalDate ?? '';
    const mealConfigs = useMemo(() =>
      MEAL_CONFIGS_BASE.map(cfg => ({ ...cfg, imageUrl: getDailyImageUrl(cfg.type, dateStr) })),
      [dateStr]
    );
    const exerciseConfig = useMemo(() =>
      ({ ...EXERCISE_CONFIG_BASE, imageUrl: getDailyImageUrl('exercise', dateStr) }),
      [dateStr]
    );
    const waterConfig = useMemo(() =>
      ({ ...WATER_CONFIG_BASE, imageUrl: getDailyImageUrl('water', dateStr) }),
      [dateStr]
    );

    const allImages = useMemo(() => [
      ...mealConfigs.map(c => c.imageUrl),
      exerciseConfig.imageUrl,
      waterConfig.imageUrl,
    ], [mealConfigs, exerciseConfig, waterConfig]);

    const goToIndex = useCallback((index: number) => {
      const clamped = Math.max(0, Math.min(CARD_ORDER.length - 1, index));
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      onActiveIndexChangeRef.current?.(clamped);
    }, []);

    const scrollCardIntoView = (index: number, behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      const card = cardRefs.current[index];
      if (!container || !card) return;
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = bareMode ? 24 : (containerRect.width - cardRect.width) / 2;
      const target = container.scrollLeft + cardRect.left - containerRect.left - offset;
      container.scrollTo({ left: target, behavior });
    };

    useImperativeHandle(ref, () => ({
      scrollToMeal: (type: CarouselCardType) => {
        const index = CARD_ORDER.indexOf(type);
        if (index < 0) return;
        if (!bareMode && !fullscreen && !isMobile) {
          goToIndex(index);
        } else {
          scrollCardIntoView(index);
        }
        setHighlightedType(type);
        setTimeout(() => setHighlightedType(null), 1800);
      },
    }), [bareMode, fullscreen, isMobile, goToIndex]);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
        if (!bareMode && !fullscreen) {
          setCardWidth(window.innerWidth >= 640 ? 400 : Math.round(window.innerWidth * 0.90));
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [bareMode, fullscreen]);

    useEffect(() => {
      if (!bareMode && !fullscreen && !isMobile) return;
      const container = containerRef.current;
      if (!container) return;

      const updateActive = () => {
        const snapPoint = bareMode
          ? container.scrollLeft + 24
          : container.scrollLeft + container.clientWidth / 2;
        let closest = 0;
        let minDist = Infinity;
        cardRefs.current.forEach((card, i) => {
          if (!card) return;
          const cardAnchor = bareMode
            ? card.offsetLeft
            : card.offsetLeft + card.offsetWidth / 2;
          const dist = Math.abs(snapPoint - cardAnchor);
          if (dist < minDist) { minDist = dist; closest = i; }
        });
        if (closest !== activeIndexRef.current) {
          activeIndexRef.current = closest;
          setActiveIndex(closest);
          onActiveIndexChangeRef.current?.(closest);
        }
      };

      container.addEventListener('scroll', updateActive, { passive: true });
      const raf = requestAnimationFrame(updateActive);
      return () => {
        container.removeEventListener('scroll', updateActive);
        cancelAnimationFrame(raf);
      };
    }, [bareMode, fullscreen, isMobile]);

    const handleFoodAdd = useCallback((mealType: MealType, item: FoodItem) => {
      onChange({ ...record, meals: { ...record.meals, [mealType]: [...record.meals[mealType], item] } });
    }, [record, onChange]);

    const handleFoodRemove = useCallback((mealType: MealType, id: string) => {
      onChange({ ...record, meals: { ...record.meals, [mealType]: record.meals[mealType].filter(f => f.id !== id) } });
    }, [record, onChange]);

    const handleFoodUpdate = useCallback((mealType: MealType, item: FoodItem) => {
      onChange({ ...record, meals: { ...record.meals, [mealType]: record.meals[mealType].map(f => f.id === item.id ? item : f) } });
    }, [record, onChange]);

    const mealHandlers = useMemo(() => {
      const map = {} as Record<MealType, { onAdd: (item: FoodItem) => void; onRemove: (id: string) => void; onUpdate: (item: FoodItem) => void }>;
      for (const cfg of MEAL_CONFIGS_BASE) {
        const type = cfg.type;
        map[type] = {
          onAdd: (item: FoodItem) => handleFoodAdd(type, item),
          onRemove: (id: string) => handleFoodRemove(type, id),
          onUpdate: (item: FoodItem) => handleFoodUpdate(type, item),
        };
      }
      return map;
    }, [handleFoodAdd, handleFoodRemove, handleFoodUpdate]);

    const handleExerciseAdd = useCallback((item: ExerciseItem) => {
      onChange({ ...record, exercises: [...record.exercises, item] });
    }, [record, onChange]);

    const handleExerciseRemove = useCallback((id: string) => {
      onChange({ ...record, exercises: record.exercises.filter(e => e.id !== id) });
    }, [record, onChange]);

    const handleExerciseUpdate = useCallback((item: ExerciseItem) => {
      onChange({ ...record, exercises: record.exercises.map(e => e.id === item.id ? item : e) });
    }, [record, onChange]);

    const handleWaterAdd = useCallback((item: WaterItem) => {
      onChange({ ...record, water: [...(record.water ?? []), item] });
    }, [record, onChange]);

    const handleWaterRemove = useCallback((id: string) => {
      onChange({ ...record, water: (record.water ?? []).filter(w => w.id !== id) });
    }, [record, onChange]);

    const handleWaterUpdate = useCallback((item: WaterItem) => {
      onChange({ ...record, water: (record.water ?? []).map(w => w.id === item.id ? item : w) });
    }, [record, onChange]);

    const handleWaterReplaceLocal = useCallback((items: WaterItem[]) => {
      if (onWaterReplace) {
        onWaterReplace(items);
      } else {
        onChange({ ...record, water: items });
      }
    }, [record, onChange, onWaterReplace]);

    const accent = ALL_ACCENT[activeIndex] ?? ALL_ACCENT[0];

    const getMacroTarget = (type: MealType) => {
      const ratio = MEAL_RATIOS[type];
      const hasItems = record.meals[type].length > 0;
      return hasItems
        ? { protein: Math.max(1, Math.round(proteinTarget * ratio)), carbs: Math.max(1, Math.round(carbsTarget * ratio)), fat: Math.max(1, Math.round(fatTarget * ratio)), isRedistributed: false }
        : { protein: Math.max(1, Math.round((proteinTarget - totalProtein) * (uneatenRatioSum > 0 ? ratio / uneatenRatioSum : ratio))), carbs: Math.max(1, Math.round((carbsTarget - totalCarbs) * (uneatenRatioSum > 0 ? ratio / uneatenRatioSum : ratio))), fat: Math.max(1, Math.round((fatTarget - totalFat) * (uneatenRatioSum > 0 ? ratio / uneatenRatioSum : ratio))), isRedistributed: true };
    };

    const handlePointerDown = (e: { clientX: number }) => {
      pointerStartX.current = e.clientX;
    };
    const handlePointerUp = (e: { clientX: number }) => {
      if (pointerStartX.current === null) return;
      const dx = e.clientX - pointerStartX.current;
      pointerStartX.current = null;
      if (Math.abs(dx) > 50) goToIndex(dx < 0 ? activeIndex + 1 : activeIndex - 1);
    };

    const floatingImageStyle = (_isActive: boolean, imageUrl: string | undefined): CSSProperties => ({
      height: '130px',
      marginBottom: '0px',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 10,
      borderRadius: '20px 20px 0 0',
      flexShrink: 0,
      backgroundImage: !imageUrl ? `linear-gradient(135deg, #f0f4f8, #d9e2ec)` : undefined,
      backgroundColor: !imageUrl ? '#f0f4f8' : undefined,
    });

    return (
      <div
        className={`relative overflow-hidden ${(fullscreen || isMobile) ? 'h-full flex flex-col' : 'rounded-3xl'}`}
        style={{
          boxShadow: !bareMode && !fullscreen && !isMobile
            ? `0 0 0 1.5px ${accent}25, 0 24px 64px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.09)`
            : undefined,
          transition: 'box-shadow 0.5s ease',
        }}
      >
        {!bareMode && !isMobile && allImages.map((src, i) => (
          <div
            key={src + i}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${src})`,
              opacity: activeIndex === i ? 1 : 0,
              transition: 'opacity 0.7s ease',
              zIndex: 0,
            }}
          />
        ))}
        {!bareMode && !isMobile && (
          <div
            className="absolute inset-0"
            style={{
              background: fullscreen
                ? 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.45) 35%, rgba(255,255,255,0.68) 100%)'
                : 'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0.72) 100%)',
              backdropFilter: 'blur(2px)',
              zIndex: 1,
            }}
          />
        )}

        {(!bareMode && !fullscreen && !isMobile) ? (
          <>
            <div
              className="relative"
              style={{ overflow: 'hidden', zIndex: 2 }}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            >
              <div
                style={{
                  display: 'flex',
                  gap: `${GAP_PX}px`,
                  transform: `translateX(calc(50% - ${cardWidth / 2}px - ${activeIndex * (cardWidth + GAP_PX)}px))`,
                  transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                  willChange: 'transform',
                  paddingTop: '14px',
                  paddingBottom: '4px',
                }}
              >
                {mealConfigs.map((cfg, i) => {
                  const isActive = activeIndex === i;
                  const macroTarget = getMacroTarget(cfg.type);
                  return (
                    <div
                      key={cfg.type}
                      className="flex-shrink-0 flex flex-col"
                      style={{
                        width: cardWidth,
                        position: 'relative',
                        transform: isActive ? 'scale(1) translateY(0px)' : 'scale(1) translateY(0px)',
                        transformOrigin: 'top center',
                        transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    >
                      <div style={floatingImageStyle(isActive, cfg.imageUrl)}>
                        {cfg.imageUrl && (
                          <img src={cfg.imageUrl} alt={cfg.label} loading="lazy" decoding="async" className="w-full h-full object-cover object-center" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div
                          className="absolute inset-x-0 bottom-0"
                          style={{ height: '56px', background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.92) 100%)' }}
                        />
                        <div
                          className="absolute top-3 left-3.5 flex items-center gap-2"
                          style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.38s ease 0.08s' }}
                        >
                          <span className="text-[9px] font-black text-white/60 tracking-[0.22em]">{cfg.num}</span>
                          <span className="text-sm font-black text-white leading-none" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{cfg.label}</span>
                          {cfg.time && <span className="text-[9px] text-white/55 tracking-wide hidden sm:inline">{cfg.time}</span>}
                        </div>
                      </div>
                      {!isActive && (
                        <div
                          className="absolute inset-0 cursor-pointer"
                          style={{ zIndex: 20 }}
                          onClick={() => goToIndex(i)}
                        />
                      )}
                      <div style={{ position: 'relative', zIndex: 5, flexShrink: 0 }}>
                        <MealCardSlot
                          config={cfg}
                          items={record.meals[cfg.type]}
                          isActive={isActive}
                          isHighlighted={highlightedType === cfg.type}
                          macroTarget={macroTarget}
                          noImage={true}
                          recommendation={recommendations[cfg.type]}
                          showRecommendation={!!recommendations[cfg.type]}
                          onAdd={mealHandlers[cfg.type].onAdd}
                          onRemove={mealHandlers[cfg.type].onRemove}
                          onUpdate={mealHandlers[cfg.type].onUpdate}
                          onOpenAIInput={onOpenAIInput}
                        />
                      </div>
                    </div>
                  );
                })}
                <div
                  className="flex-shrink-0 flex flex-col"
                  style={{
                    width: cardWidth,
                    position: 'relative',
                    transform: activeIndex === 4 ? 'scale(1) translateY(0px)' : 'scale(1) translateY(0px)',
                    transformOrigin: 'top center',
                    transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <div style={floatingImageStyle(activeIndex === 4, exerciseConfig.imageUrl)}>
                    {exerciseConfig.imageUrl && (
                      <img src={exerciseConfig.imageUrl} alt={exerciseConfig.label} loading="lazy" decoding="async" className="w-full h-full object-cover object-center" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0"
                      style={{ height: '56px', background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.92) 100%)' }}
                    />
                    <div
                      className="absolute top-3 left-3.5 flex items-center gap-2"
                      style={{ opacity: activeIndex === 4 ? 1 : 0, transition: 'opacity 0.38s ease 0.08s' }}
                    >
                      <span className="text-[9px] font-black text-white/60 tracking-[0.22em]">{exerciseConfig.num}</span>
                      <span className="text-sm font-black text-white leading-none" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{exerciseConfig.label}</span>
                    </div>
                  </div>
                  {activeIndex !== 4 && (
                    <div className="absolute inset-0 cursor-pointer" style={{ zIndex: 20 }} onClick={() => goToIndex(4)} />
                  )}
                  <div style={{ position: 'relative', zIndex: 5, flexShrink: 0 }}>
                    <ExerciseCardSlot
                      config={exerciseConfig}
                      items={record.exercises}
                      isActive={activeIndex === 4}
                      isHighlighted={highlightedType === 'exercise'}
                      noImage={true}
                      journalDate={journalDate}
                      onAdd={handleExerciseAdd}
                      onRemove={handleExerciseRemove}
                      onUpdate={handleExerciseUpdate}
                    />
                  </div>
                </div>
                <div
                  className="flex-shrink-0 flex flex-col"
                  style={{
                    width: cardWidth,
                    position: 'relative',
                    transform: activeIndex === 5 ? 'scale(1) translateY(0px)' : 'scale(1) translateY(0px)',
                    transformOrigin: 'top center',
                    transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <div style={floatingImageStyle(activeIndex === 5, waterConfig.imageUrl)}>
                    {waterConfig.imageUrl && (
                      <img src={waterConfig.imageUrl} alt={waterConfig.label} loading="lazy" decoding="async" className="w-full h-full object-cover object-center" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0"
                      style={{ height: '56px', background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.92) 100%)' }}
                    />
                    <div
                      className="absolute top-3 left-3.5 flex items-center gap-2"
                      style={{ opacity: activeIndex === 5 ? 1 : 0, transition: 'opacity 0.38s ease 0.08s' }}
                    >
                      <span className="text-[9px] font-black text-white/60 tracking-[0.22em]">{waterConfig.num}</span>
                      <span className="text-sm font-black text-white leading-none" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{waterConfig.label}</span>
                    </div>
                  </div>
                  {activeIndex !== 5 && (
                    <div className="absolute inset-0 cursor-pointer" style={{ zIndex: 20 }} onClick={() => goToIndex(5)} />
                  )}
                  <div style={{ position: 'relative', zIndex: 5, flexShrink: 0 }}>
                    <WaterCardSlot
                      config={waterConfig}
                      items={record.water ?? []}
                      apiKey={apiKey}
                      isActive={activeIndex === 5}
                      isHighlighted={highlightedType === 'water'}
                      noImage={true}
                      isViewingToday={isViewingToday}
                      profile={profile}
                      onAdd={handleWaterAdd}
                      onRemove={handleWaterRemove}
                      onUpdate={handleWaterUpdate}
                      onReplace={handleWaterReplaceLocal}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="relative flex items-center justify-center gap-2.5 pb-4 pt-1.5" style={{ zIndex: 2 }}>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.72)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.55)',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
                }}
              >
                <button
                  onClick={() => goToIndex(activeIndex - 1)}
                  className="flex items-center justify-center cursor-pointer flex-shrink-0 rounded-full transition-opacity"
                  style={{
                    width: 26, height: 26,
                    opacity: activeIndex === 0 ? 0.28 : 0.85,
                  }}
                  disabled={activeIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" style={{ color: accent }} />
                </button>
                {CARD_ORDER.map((type, i) => {
                  const isActive = activeIndex === i;
                  const dotAccent = ALL_ACCENT[i];
                  return (
                    <button
                      key={type}
                      onClick={() => goToIndex(i)}
                      className="rounded-full cursor-pointer flex-shrink-0"
                      style={{
                        width: isActive ? '20px' : '5px',
                        height: '5px',
                        backgroundColor: isActive ? dotAccent : `${dotAccent}30`,
                        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    />
                  );
                })}
                <button
                  onClick={() => goToIndex(activeIndex + 1)}
                  className="flex items-center justify-center cursor-pointer flex-shrink-0 rounded-full transition-opacity"
                  style={{
                    width: 26, height: 26,
                    opacity: activeIndex === CARD_ORDER.length - 1 ? 0.28 : 0.85,
                  }}
                  disabled={activeIndex === CARD_ORDER.length - 1}
                >
                  <ChevronRight className="w-4 h-4" style={{ color: accent }} />
                </button>
              </div>
              <span
                className="text-[11px] font-bold tracking-widest tabular-nums px-2.5 py-1.5 rounded-full"
                style={{
                  color: accent,
                  transition: 'color 0.5s ease',
                  background: 'rgba(255,255,255,0.65)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
              >
                {String(activeIndex + 1).padStart(2, '0')} / {String(CARD_ORDER.length).padStart(2, '0')}
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              ref={containerRef}
              className={`meal-carousel-scroll relative flex ${isMobile ? 'items-stretch' : 'items-start'} overflow-x-auto snap-x snap-mandatory ${isMobile ? 'gap-0' : 'gap-4'} ${(fullscreen || isMobile) ? 'flex-1 py-0' : 'py-6'}`}
              style={{
                paddingLeft: bareMode ? '1.5rem' : (isMobile ? '0' : 'calc(50% - min(41vw, 200px))'),
                paddingRight: bareMode ? '1.5rem' : (isMobile ? '0' : 'calc(50% - min(41vw, 200px))'),
                scrollbarWidth: 'none',
                zIndex: 2,
              }}
            >
              {mealConfigs.map((cfg, i) => {
                const macroTarget = getMacroTarget(cfg.type);
                return (
                  <div
                    key={cfg.type}
                    ref={el => { cardRefs.current[i] = el; }}
                    className={`${(bareMode || isMobile) ? 'snap-start' : 'snap-center'} flex-shrink-0 ${(fullscreen || isMobile) ? 'h-full' : ''}`}
                  >
                    <MealCardSlot
                      config={cfg}
                      items={record.meals[cfg.type]}
                      isActive={activeIndex === i}
                      isHighlighted={highlightedType === cfg.type}
                      macroTarget={macroTarget}
                      fullscreen={fullscreen || isMobile}
                      bareMode={bareMode}
                      recommendation={recommendations[cfg.type]}
                      showRecommendation={!!recommendations[cfg.type]}
                      onAdd={mealHandlers[cfg.type].onAdd}
                      onRemove={mealHandlers[cfg.type].onRemove}
                      onUpdate={mealHandlers[cfg.type].onUpdate}
                      onOpenAIInput={onOpenAIInput}
                    />
                  </div>
                );
              })}
              <div
                ref={el => { cardRefs.current[4] = el; }}
                className={`${(bareMode || isMobile) ? 'snap-start' : 'snap-center'} flex-shrink-0 ${(fullscreen || isMobile) ? 'h-full' : ''}`}
              >
                <ExerciseCardSlot
                  config={exerciseConfig}
                  items={record.exercises}
                  isActive={activeIndex === 4}
                  isHighlighted={highlightedType === 'exercise'}
                  fullscreen={fullscreen || isMobile}
                  bareMode={bareMode}
                  journalDate={journalDate}
                  onAdd={handleExerciseAdd}
                  onRemove={handleExerciseRemove}
                  onUpdate={handleExerciseUpdate}
                />
              </div>
              <div
                ref={el => { cardRefs.current[5] = el; }}
                className={`${(bareMode || isMobile) ? 'snap-start' : 'snap-center'} flex-shrink-0 ${(fullscreen || isMobile) ? 'h-full' : ''}`}
              >
                <WaterCardSlot
                  config={waterConfig}
                  items={record.water ?? []}
                  apiKey={apiKey}
                  isActive={activeIndex === 5}
                  isHighlighted={highlightedType === 'water'}
                  fullscreen={fullscreen || isMobile}
                  bareMode={bareMode}
                  isViewingToday={isViewingToday}
                  profile={profile}
                  onAdd={handleWaterAdd}
                  onRemove={handleWaterRemove}
                  onUpdate={handleWaterUpdate}
                  onReplace={handleWaterReplaceLocal}
                />
              </div>
            </div>
            {!bareMode && !isMobile && (
              <div className={`relative flex items-center justify-center gap-1.5 flex-shrink-0 ${fullscreen ? 'pb-3 pt-1' : 'pb-5'}`} style={{ zIndex: 2 }}>
                {CARD_ORDER.map((type, i) => {
                  const isActive = activeIndex === i;
                  const dotAccent = ALL_ACCENT[i];
                  return (
                    <button
                      key={type}
                      onClick={() => scrollCardIntoView(i)}
                      className="rounded-full cursor-pointer"
                      style={{
                        width: isActive ? '22px' : '6px',
                        height: '6px',
                        backgroundColor: isActive ? dotAccent : `${accent}40`,
                        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    />
                  );
                })}
                <span
                  className="ml-2 text-[11px] font-semibold tracking-widest tabular-nums"
                  style={{ color: accent, transition: 'color 0.5s ease' }}
                >
                  {String(activeIndex + 1).padStart(2, '0')} · {String(CARD_ORDER.length).padStart(2, '0')}
                </span>
              </div>
            )}
          </>
        )}

        <style>{`
          .meal-carousel-scroll::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    );
  }
);

MealCarousel.displayName = 'MealCarousel';
export default MealCarousel;
