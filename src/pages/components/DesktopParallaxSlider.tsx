import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MealCardSlot from './MealCardSlot';
import ExerciseCardSlot from './ExerciseCardSlot';
import WaterCardSlot from './WaterCardSlot';
import type { MacroTarget } from './MealCardSlot';
import type { DailyRecord, MealType, FoodItem, ExerciseItem, WaterItem, UserProfile } from '../../types';
import { calcMacroTargets, getDefaultMacroTargets } from '../../utils/calculations';
import {
  CARD_ORDER,
  MEAL_CONFIGS_BASE,
  EXERCISE_CONFIG_BASE,
  WATER_CONFIG_BASE,
  getDailyImageUrl,
} from './MealCarousel';
import type { CarouselCardType, MealCarouselRef } from './MealCarousel';

interface DesktopParallaxSliderProps {
  record: DailyRecord;
  apiKey: string;
  isViewingToday?: boolean;
  profile?: UserProfile | null;
  journalDate?: string;
  onChange: (record: DailyRecord) => void;
  onWaterReplace?: (items: WaterItem[]) => void;
  onCameraOpen?: () => void;
}

const MEAL_RATIOS: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
  snack: 0.10,
};

const ALL_ACCENT = [
  ...MEAL_CONFIGS_BASE.map(c => c.accent),
  EXERCISE_CONFIG_BASE.accent,
  WATER_CONFIG_BASE.accent,
];

const CARD_META = [
  ...MEAL_CONFIGS_BASE.map(c => ({ label: c.label, en: c.en, num: c.num, time: c.time, accent: c.accent, type: c.type as CarouselCardType })),
  { label: EXERCISE_CONFIG_BASE.label, en: EXERCISE_CONFIG_BASE.en, num: EXERCISE_CONFIG_BASE.num, time: EXERCISE_CONFIG_BASE.time ?? '', accent: EXERCISE_CONFIG_BASE.accent, type: 'exercise' as CarouselCardType },
  { label: WATER_CONFIG_BASE.label, en: WATER_CONFIG_BASE.en, num: WATER_CONFIG_BASE.num, time: WATER_CONFIG_BASE.time ?? '', accent: WATER_CONFIG_BASE.accent, type: 'water' as CarouselCardType },
];

// Card stack positions: delta = cardIndex - activeIndex
// x in px (within right panel, absolute from left: 0)
const STACK = [
  { x: 24, scale: 1.0, opacity: 1.00, z: 20 },
  { x: 292, scale: 0.875, opacity: 0.68, z: 19 },
  { x: 500, scale: 0.760, opacity: 0.42, z: 18 },
  { x: 659, scale: 0.650, opacity: 0.16, z: 17 },
];

// Background clip-path expansion origins for forward navigation.
// Key = how many steps forward we jumped (1, 2, 3+).
// Values are clip-path inset() representing where the card's banner was before switching.
// Calculations assume: right panel starts at 42%, card width 260px, banner height 8rem≈128px,
// screen 1440×900, card vertically centered, card top at ~22% from screen top.
const FWD_ORIGINS: Record<number, string> = {
  1: 'inset(22% 21% 64% 63% round 16px)',
  2: 'inset(22% 7% 64% 79% round 16px)',
  3: 'inset(15% 2% 60% 90% round 16px)',
};
const BWD_ORIGIN = 'inset(22% 98% 64% 0% round 16px)';
const INIT_ORIGIN = 'inset(22% 38% 64% 44% round 16px)';

const DesktopParallaxSlider = forwardRef<MealCarouselRef, DesktopParallaxSliderProps>(
  ({ record, apiKey, isViewingToday = true, profile, journalDate, onChange, onWaterReplace, onCameraOpen }, ref) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [bgOrigin, setBgOrigin] = useState(INIT_ORIGIN);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevActiveRef = useRef(0);
    const swipeStartX = useRef<number | null>(null);
    const swipeStartY = useRef<number | null>(null);

    const dateStr = journalDate ?? '';

    const { proteinTarget, carbsTarget, fatTarget } = profile
      ? calcMacroTargets(profile)
      : getDefaultMacroTargets();

    const allItems = useMemo(() => Object.values(record.meals).flat() as FoodItem[], [record.meals]);
    const totalProtein = useMemo(() => Math.round(allItems.reduce((s, f) => s + (f.protein ?? 0), 0)), [allItems]);
    const totalCarbs = useMemo(() => Math.round(allItems.reduce((s, f) => s + (f.carbs ?? 0), 0)), [allItems]);
    const totalFat = useMemo(() => Math.round(allItems.reduce((s, f) => s + (f.fat ?? 0), 0)), [allItems]);

    const uneatenRatioSum = useMemo(() =>
      MEAL_CONFIGS_BASE
        .filter(m => record.meals[m.type].length === 0)
        .reduce((sum, m) => sum + MEAL_RATIOS[m.type], 0),
      [record.meals]
    );

    const mealConfigs = useMemo(() =>
      MEAL_CONFIGS_BASE.map(cfg => ({ ...cfg, imageUrl: getDailyImageUrl(cfg.type, dateStr) })),
      [dateStr]
    );
    const exerciseConfig = useMemo(() => ({ ...EXERCISE_CONFIG_BASE, imageUrl: getDailyImageUrl('exercise', dateStr) }), [dateStr]);
    const waterConfig = useMemo(() => ({ ...WATER_CONFIG_BASE, imageUrl: getDailyImageUrl('water', dateStr) }), [dateStr]);
    const bgImages = useMemo(() => CARD_ORDER.map(type => getDailyImageUrl(type, dateStr)), [dateStr]);

    const switchCard = useCallback((newIndex: number) => {
      if (newIndex === prevActiveRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      const direction = newIndex - prevActiveRef.current;
      const origin = direction > 0
        ? (FWD_ORIGINS[Math.min(direction, 3)] ?? FWD_ORIGINS[3])
        : BWD_ORIGIN;
      setBgOrigin(origin);

      prevActiveRef.current = newIndex;
      setActiveIndex(newIndex);
      setIsTransitioning(true);
      timerRef.current = setTimeout(() => setIsTransitioning(false), 820);
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      swipeStartX.current = e.clientX;
      swipeStartY.current = e.clientY;
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (swipeStartX.current === null) return;
      const dx = e.clientX - swipeStartX.current;
      const dy = e.clientY - (swipeStartY.current ?? e.clientY);
      swipeStartX.current = null;
      swipeStartY.current = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0 && activeIndex < CARD_ORDER.length - 1) switchCard(activeIndex + 1);
      else if (dx > 0 && activeIndex > 0) switchCard(activeIndex - 1);
    }, [activeIndex, switchCard]);

    useImperativeHandle(ref, () => ({
      scrollToMeal: (type: CarouselCardType) => {
        const index = CARD_ORDER.indexOf(type);
        if (index >= 0) switchCard(index);
      },
    }));

    const getMacroTarget = useCallback((mealType: MealType, ratio: number): MacroTarget => {
      const hasItems = record.meals[mealType].length > 0;
      if (hasItems) {
        return {
          protein: Math.max(1, Math.round(proteinTarget * ratio)),
          carbs: Math.max(1, Math.round(carbsTarget * ratio)),
          fat: Math.max(1, Math.round(fatTarget * ratio)),
          isRedistributed: false,
        };
      }
      return {
        protein: Math.max(1, Math.round((proteinTarget - totalProtein) * (uneatenRatioSum > 0 ? ratio / uneatenRatioSum : ratio))),
        carbs: Math.max(1, Math.round((carbsTarget - totalCarbs) * (uneatenRatioSum > 0 ? ratio / uneatenRatioSum : ratio))),
        fat: Math.max(1, Math.round((fatTarget - totalFat) * (uneatenRatioSum > 0 ? ratio / uneatenRatioSum : ratio))),
        isRedistributed: true,
      };
    }, [proteinTarget, carbsTarget, fatTarget, totalProtein, totalCarbs, totalFat, uneatenRatioSum, record.meals]);

    const handleFoodAdd = useCallback((mealType: MealType, item: FoodItem) =>
      onChange({ ...record, meals: { ...record.meals, [mealType]: [...record.meals[mealType], item] } }),
      [record, onChange]);
    const handleFoodRemove = useCallback((mealType: MealType, id: string) =>
      onChange({ ...record, meals: { ...record.meals, [mealType]: record.meals[mealType].filter(f => f.id !== id) } }),
      [record, onChange]);
    const handleFoodUpdate = useCallback((mealType: MealType, item: FoodItem) =>
      onChange({ ...record, meals: { ...record.meals, [mealType]: record.meals[mealType].map(f => f.id === item.id ? item : f) } }),
      [record, onChange]);
    const handleExAdd = useCallback((item: ExerciseItem) =>
      onChange({ ...record, exercises: [...record.exercises, item] }), [record, onChange]);
    const handleExRemove = useCallback((id: string) =>
      onChange({ ...record, exercises: record.exercises.filter(e => e.id !== id) }), [record, onChange]);
    const handleExUpdate = useCallback((item: ExerciseItem) =>
      onChange({ ...record, exercises: record.exercises.map(e => e.id === item.id ? item : e) }), [record, onChange]);
    const handleWAdd = useCallback((item: WaterItem) =>
      onChange({ ...record, water: [...(record.water ?? []), item] }), [record, onChange]);
    const handleWRemove = useCallback((id: string) =>
      onChange({ ...record, water: (record.water ?? []).filter(w => w.id !== id) }), [record, onChange]);
    const handleWUpdate = useCallback((item: WaterItem) =>
      onChange({ ...record, water: (record.water ?? []).map(w => w.id === item.id ? item : w) }), [record, onChange]);
    const handleWReplace = useCallback((items: WaterItem[]) => {
      if (onWaterReplace) onWaterReplace(items);
      else onChange({ ...record, water: items });
    }, [record, onChange, onWaterReplace]);

    const cardInfo = CARD_META[activeIndex];
    const accent = ALL_ACCENT[activeIndex];

    const slotStats = useMemo(() => {
      const info = CARD_META[activeIndex];
      if (!info) return { value: 0, unit: 'kcal', label: '' };
      if (info.type === 'exercise') return { value: record.exercises.reduce((s, e) => s + e.calories, 0), unit: 'kcal', label: '已消耗' };
      if (info.type === 'water') return { value: (record.water ?? []).reduce((s, w) => s + w.amount, 0), unit: 'ml', label: '已补水' };
      return { value: record.meals[info.type as MealType].reduce((s, f) => s + f.calories, 0), unit: 'kcal', label: '已摄入' };
    }, [activeIndex, record]);

    const renderCard = (type: CarouselCardType, isActive: boolean) => {
      const showInteractive = isActive && !isTransitioning;
      if (type === 'exercise') {
        return (
          <ExerciseCardSlot
            config={exerciseConfig}
            items={record.exercises}
            isActive={showInteractive}
            isHighlighted={false}
            bareMode
            journalDate={journalDate}
            onAdd={handleExAdd}
            onRemove={handleExRemove}
            onUpdate={handleExUpdate}
          />
        );
      }
      if (type === 'water') {
        return (
          <WaterCardSlot
            config={waterConfig}
            items={record.water ?? []}
            apiKey={apiKey}
            isActive={showInteractive}
            isHighlighted={false}
            bareMode
            isViewingToday={isViewingToday}
            profile={profile}
            onAdd={handleWAdd}
            onRemove={handleWRemove}
            onUpdate={handleWUpdate}
            onReplace={handleWReplace}
          />
        );
      }
      const cfg = mealConfigs.find(c => c.type === type)!;
      const ratio = MEAL_RATIOS[type as MealType];
      return (
        <MealCardSlot
          config={cfg}
          items={record.meals[type as MealType]}
          isActive={showInteractive}
          isHighlighted={false}
          macroTarget={getMacroTarget(type as MealType, ratio)}
          bareMode
          onCameraOpen={onCameraOpen}
          onAdd={item => handleFoodAdd(type as MealType, item)}
          onRemove={id => handleFoodRemove(type as MealType, id)}
          onUpdate={item => handleFoodUpdate(type as MealType, item)}
        />
      );
    };

    return (
      <div className="relative w-full h-full overflow-hidden">

        {/* ── LAYER 0: Immersive background ── */}
        <AnimatePresence initial={false}>
          <motion.div
            key={activeIndex}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImages[activeIndex]})` }}
            initial={{
              clipPath: bgOrigin,
              scale: 1.14,
              opacity: 0,
              filter: 'brightness(1.9) blur(22px)',
            }}
            animate={{
              clipPath: 'inset(0% 0% 0% 0% round 0px)',
              scale: 1.0,
              opacity: 1,
              filter: 'brightness(1) blur(0px)',
            }}
            exit={{
              scale: 1.08,
              opacity: 0,
              filter: 'brightness(0.7) blur(4px)',
              transition: { duration: 0.38, ease: 'easeIn' },
            }}
            transition={{
              clipPath: { duration: 0.62, ease: [0.14, 1.12, 0.3, 1] },
              scale: { type: 'spring', stiffness: 260, damping: 24, mass: 1.1 },
              filter: { duration: 0.72, ease: 'easeOut' },
              opacity: { duration: 0.22, ease: 'easeOut' },
            }}
          />
        </AnimatePresence>

        {/* ── LAYER 1: Cinematic left-to-right gradient veil ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(108deg, rgba(4,4,6,0.78) 0%, rgba(4,4,6,0.42) 40%, rgba(4,4,6,0.04) 100%)',
            zIndex: 10,
          }}
        />

        {/* ── LAYER 2: Right-edge vignette (clips overflow cards) ── */}
        <div
          className="absolute inset-y-0 right-0 pointer-events-none"
          style={{
            width: '10%',
            background: 'linear-gradient(to right, transparent, rgba(4,4,6,0.65))',
            zIndex: 26,
          }}
        />

        {/* ── LAYER 3: UI ── */}
        <div className="absolute inset-0 flex" style={{ zIndex: 20 }}>

          {/* LEFT: Animated info panel */}
          <div
            className="flex flex-col justify-center select-none overflow-hidden flex-shrink-0"
            style={{
              width: '42%',
              paddingLeft: 'clamp(2.5rem,5vw,5rem)',
              paddingRight: 'clamp(1.5rem,2.5vw,2.5rem)',
              paddingTop: '2rem',
              paddingBottom: '2rem',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 32, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -22, filter: 'blur(3px)' }}
                transition={{ duration: 0.42, ease: [0.25, 1, 0.5, 1] }}
              >
                {/* Ghost sequence number */}
                <div
                  className="font-black leading-none tabular-nums pointer-events-none"
                  style={{
                    fontSize: 'clamp(7rem,14vw,12rem)',
                    lineHeight: 0.82,
                    letterSpacing: '-0.04em',
                    color: `${cardInfo.accent}26`,
                    marginBottom: '0.1em',
                  }}
                >
                  {cardInfo.num}
                </div>

                {/* EN headline */}
                <h1
                  className="font-black uppercase leading-none"
                  style={{
                    fontSize: 'clamp(2rem,3.6vw,3.2rem)',
                    color: '#ffffff',
                    letterSpacing: '0.05em',
                    textShadow: '0 4px 32px rgba(0,0,0,0.55)',
                    marginBottom: '0.42em',
                  }}
                >
                  {cardInfo.en}
                </h1>

                {/* Chinese label + time divider */}
                <div className="flex items-center gap-3" style={{ marginBottom: '1.6rem' }}>
                  <span
                    className="font-bold"
                    style={{ fontSize: 'clamp(0.9rem,1.4vw,1.2rem)', color: 'rgba(255,255,255,0.86)', letterSpacing: '0.06em' }}
                  >
                    {cardInfo.label}
                  </span>
                  {cardInfo.time && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem' }}>|</span>
                      <span style={{ fontSize: 'clamp(0.58rem,0.82vw,0.75rem)', color: 'rgba(255,255,255,0.42)', letterSpacing: '0.13em', fontWeight: 500 }}>
                        {cardInfo.time}
                      </span>
                    </>
                  )}
                </div>

                {/* Stats pill */}
                <div
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full"
                  style={{
                    background: `${cardInfo.accent}24`,
                    border: `1.5px solid ${cardInfo.accent}50`,
                    backdropFilter: 'blur(14px)',
                    marginBottom: '2.2rem',
                  }}
                >
                  <span className="font-black tabular-nums" style={{ color: '#ffffff', fontSize: '1.05rem', lineHeight: 1 }}>
                    {slotStats.value}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.7rem', fontWeight: 600 }}>
                    {slotStats.unit} {slotStats.label}
                  </span>
                </div>

                {/* Navigation dots + arrow buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {CARD_META.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => switchCard(i)}
                      className="rounded-full"
                      style={{
                        width: i === activeIndex ? '26px' : '6px',
                        height: '6px',
                        backgroundColor: i === activeIndex ? accent : 'rgba(255,255,255,0.18)',
                        transition: 'all 0.38s cubic-bezier(0.4,0,0.2,1)',
                        cursor: 'pointer',
                        border: 'none',
                        padding: 0,
                      }}
                    />
                  ))}
                  <span
                    className="ml-2 tabular-nums"
                    style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.32)' }}
                  >
                    {String(activeIndex + 1).padStart(2, '0')} · {String(CARD_META.length).padStart(2, '0')}
                  </span>

                  {/* Prev / Next arrow buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => activeIndex > 0 && switchCard(activeIndex - 1)}
                      disabled={activeIndex === 0}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: `1.5px solid ${activeIndex === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)'}`,
                        background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: activeIndex === 0 ? 0.3 : 1,
                        transition: 'all 0.24s ease',
                        color: '#fff',
                      }}
                    >
                      <ChevronLeft style={{ width: 16, height: 16 }} />
                    </button>
                    <button
                      onClick={() => activeIndex < CARD_ORDER.length - 1 && switchCard(activeIndex + 1)}
                      disabled={activeIndex === CARD_ORDER.length - 1}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: `1.5px solid ${activeIndex === CARD_ORDER.length - 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)'}`,
                        background: `${activeIndex < CARD_ORDER.length - 1 ? accent + '38' : 'rgba(255,255,255,0.08)'}`,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: activeIndex === CARD_ORDER.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: activeIndex === CARD_ORDER.length - 1 ? 0.3 : 1,
                        transition: 'all 0.24s ease',
                        color: '#fff',
                      }}
                    >
                      <ChevronRight style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT: Immersive card stack (supports swipe left/right) */}
          <div
            className="relative flex-1 overflow-visible"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { swipeStartX.current = null; swipeStartY.current = null; }}
          >
            {CARD_ORDER.map((type, i) => {
              const delta = i - activeIndex;
              const inStack = delta >= 0 && delta < STACK.length;
              const cfg = inStack ? STACK[delta] : null;

              const targetX = delta < 0 ? -380 : cfg ? cfg.x : STACK[STACK.length - 1].x + 140;
              const targetScale = delta < 0 ? 0.3 : cfg ? cfg.scale : 0.55;
              const targetOpacity = delta < 0 ? 0 : cfg ? cfg.opacity : 0;
              const zIndex = delta === 0 ? 20 : (cfg?.z ?? 15);
              const clickable = delta > 0 && delta < STACK.length;

              return (
                <motion.div
                  key={type}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    zIndex,
                    cursor: clickable ? 'pointer' : 'default',
                    originX: 0.5,
                    originY: 0.5,
                  }}
                  animate={{
                    x: targetX,
                    y: '-50%',
                    scale: targetScale,
                    opacity: targetOpacity,
                  }}
                  transition={{
                    x: { type: 'spring', stiffness: 220, damping: 26, mass: 1 },
                    y: { duration: 0 },
                    scale: { type: 'spring', stiffness: 220, damping: 26, mass: 1 },
                    opacity: { duration: 0.38, ease: 'easeInOut' },
                  }}
                  onClick={clickable ? () => switchCard(i) : undefined}
                  whileHover={clickable ? { scale: (cfg?.scale ?? 0.6) * 1.03, opacity: Math.min(1, (cfg?.opacity ?? 0.2) + 0.15) } : undefined}
                >
                  {renderCard(type, delta === 0)}
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>
    );
  }
);

DesktopParallaxSlider.displayName = 'DesktopParallaxSlider';
export default DesktopParallaxSlider;
