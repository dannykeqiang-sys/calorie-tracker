import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
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
  onOpenAIInput?: () => void;
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

// Card positions: smooth horizontal flow with symmetric slide in/out
// Active card is centered in the right panel, others queue on right or exit to left
// x offsets are relative to the centered anchor (left: 50%)
const getCardPosition = (delta: number) => {
  if (delta === 0) return { x: 0, scale: 1.0, opacity: 1.0, z: 20, rotateY: 0 };
  // Cards waiting on the right (slide in from right)
  if (delta === 1) return { x: 240, scale: 0.85, opacity: 0.6, z: 19, rotateY: -6 };
  if (delta === 2) return { x: 440, scale: 0.72, opacity: 0.35, z: 18, rotateY: -10 };
  if (delta === 3) return { x: 600, scale: 0.6, opacity: 0.15, z: 17, rotateY: -14 };
  if (delta > 3) return { x: 800, scale: 0.5, opacity: 0, z: 16, rotateY: -16 };
  // Cards that have passed slide out to the left
  if (delta === -1) return { x: -240, scale: 0.85, opacity: 0.5, z: 15, rotateY: 6 };
  if (delta === -2) return { x: -440, scale: 0.72, opacity: 0.25, z: 14, rotateY: 10 };
  return { x: -800, scale: 0.5, opacity: 0, z: 13, rotateY: 14 };
};

// Background clip-path expansion origins for forward navigation.
const FWD_ORIGINS: Record<number, string> = {
  1: 'inset(22% 21% 64% 63% round 16px)',
  2: 'inset(22% 7% 64% 79% round 16px)',
  3: 'inset(15% 2% 60% 90% round 16px)',
};
const BWD_ORIGIN = 'inset(22% 98% 64% 0% round 16px)';
const INIT_ORIGIN = 'inset(22% 38% 64% 44% round 16px)';

// ── Single-switch wheel handler with lock ──
const WHEEL_THRESHOLD = 50; // Threshold to trigger a single switch
const SWITCH_LOCK_MS = 750; // Lock duration — animation must finish before next switch

const DesktopParallaxSlider = forwardRef<MealCarouselRef, DesktopParallaxSliderProps>(
  ({ record, apiKey, isViewingToday = true, profile, journalDate, onChange, onWaterReplace, onOpenAIInput }, ref) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [bgOrigin, setBgOrigin] = useState(INIT_ORIGIN);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevActiveRef = useRef(0);
    const swipeStartX = useRef<number | null>(null);
    const swipeStartY = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
    const tiltTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hover state for active card
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);

    // Spring-based tilt for smooth physics
    const tiltX = useMotionValue(0);
    const tiltSpring = useSpring(tiltX, { stiffness: 300, damping: 22, mass: 0.8 });

    // Wheel accumulator + lock
    const wheelAccumRef = useRef(0);
    const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const switchLockedRef = useRef(false);

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
      if (switchLockedRef.current) return; // Block if animation still playing
      if (timerRef.current) clearTimeout(timerRef.current);

      // Lock immediately
      switchLockedRef.current = true;

      const direction = newIndex - prevActiveRef.current;
      const origin = direction > 0
        ? (FWD_ORIGINS[Math.min(direction, 3)] ?? FWD_ORIGINS[3])
        : BWD_ORIGIN;
      setBgOrigin(origin);

      prevActiveRef.current = newIndex;
      setActiveIndex(newIndex);
      setIsTransitioning(true);

      // Unlock after animation completes (800ms for slower, elegant transitions)
      timerRef.current = setTimeout(() => {
        setIsTransitioning(false);
        switchLockedRef.current = false;
      }, 800);
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

    // ── Single-switch wheel handler with strict lock ──
    const handleWheel = useCallback((e: WheelEvent) => {
      // Pinch-to-zoom: ctrlKey (Windows) or metaKey (macOS trackpad pinch)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return;
      }

      // Only handle horizontal trackpad swipes (deltaX dominant)
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

      // Prevent browser back/forward navigation
      e.preventDefault();

      // If locked (animation playing), ignore all input
      if (switchLockedRef.current) return;

      // Accumulate horizontal delta
      wheelAccumRef.current += e.deltaX;

      // Reset idle timer — clear accumulator if user stops scrolling
      if (wheelIdleTimerRef.current) clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = setTimeout(() => {
        wheelAccumRef.current = 0;
        tiltX.set(0);
      }, 300);

      // Gentle tilt feedback (reduced intensity)
      const maxTilt = 4;
      const tiltAmount = Math.max(-maxTilt, Math.min(maxTilt, wheelAccumRef.current * 0.025));
      tiltX.set(tiltAmount);

      // Direction indicator
      const direction = e.deltaX > 0 ? 'right' : 'left';
      setSwipeDirection(direction);
      if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
      tiltTimerRef.current = setTimeout(() => {
        setSwipeDirection(null);
        tiltX.set(0);
      }, 500);

      // Switch ONE card when threshold exceeded, then lock
      if (Math.abs(wheelAccumRef.current) >= WHEEL_THRESHOLD) {
        const dir = wheelAccumRef.current > 0 ? 1 : -1;
        // Reset accumulator completely — no momentum preservation
        wheelAccumRef.current = 0;
        tiltX.set(0);

        if (dir > 0 && activeIndex < CARD_ORDER.length - 1) {
          switchCard(activeIndex + 1);
        } else if (dir < 0 && activeIndex > 0) {
          switchCard(activeIndex - 1);
        }
        // switchCard sets switchLockedRef = true, blocking further switches for 800ms
      }
    }, [activeIndex, switchCard, tiltX]);

    // Attach non-passive wheel listener to allow preventDefault()
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // Preload first two background images for instant display
    useEffect(() => {
      bgImages.slice(0, 2).forEach((src) => {
        if (!src) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
      });
    }, [bgImages]);

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
          onAdd={item => handleFoodAdd(type as MealType, item)}
          onRemove={id => handleFoodRemove(type as MealType, id)}
          onUpdate={item => handleFoodUpdate(type as MealType, item)}
          onOpenAIInput={onOpenAIInput}
        />
      );
    };

    return (
      <div className="relative w-full h-full overflow-hidden" style={{ isolation: 'isolate' }}>

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
              clipPath: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
              filter: { duration: 0.8, ease: 'easeOut' },
              opacity: { duration: 0.3, ease: 'easeOut' },
            }}
          />
        </AnimatePresence>

        {/* ── LAYER 1: Left text panel gradient — ultra-soft fade, no hard edge ── */}
        <div
          className="absolute top-0 bottom-0 left-0 pointer-events-none"
          style={{
            width: '55%',
            background: 'linear-gradient(to right, rgba(4,4,6,0.9) 0%, rgba(4,4,6,0.85) 30%, rgba(4,4,6,0.65) 50%, rgba(4,4,6,0.4) 68%, rgba(4,4,6,0.18) 82%, rgba(4,4,6,0.05) 92%, transparent 100%)',
            zIndex: 10,
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
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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
                    <motion.button
                      onClick={() => activeIndex > 0 && switchCard(activeIndex - 1)}
                      disabled={activeIndex === 0}
                      animate={{
                        scale: swipeDirection === 'left' ? 1.15 : 1,
                        borderColor: swipeDirection === 'left' ? accent : activeIndex === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)',
                        backgroundColor: swipeDirection === 'left' ? `${accent}38` : 'rgba(255,255,255,0.08)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: '1.5px solid',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: activeIndex === 0 ? 0.3 : 1,
                        color: '#fff',
                      }}
                    >
                      <ChevronLeft style={{ width: 16, height: 16 }} />
                    </motion.button>
                    <motion.button
                      onClick={() => activeIndex < CARD_ORDER.length - 1 && switchCard(activeIndex + 1)}
                      disabled={activeIndex === CARD_ORDER.length - 1}
                      animate={{
                        scale: swipeDirection === 'right' ? 1.15 : 1,
                        borderColor: swipeDirection === 'right' ? accent : activeIndex === CARD_ORDER.length - 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)',
                        backgroundColor: swipeDirection === 'right' ? `${accent}50` : activeIndex < CARD_ORDER.length - 1 ? `${accent}38` : 'rgba(255,255,255,0.08)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: '1.5px solid',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: activeIndex === CARD_ORDER.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: activeIndex === CARD_ORDER.length - 1 ? 0.3 : 1,
                        color: '#fff',
                      }}
                    >
                      <ChevronRight style={{ width: 16, height: 16 }} />
                    </motion.button>
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

          {/* RIGHT: Immersive card stack (supports swipe left/right) */}
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 92%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 92%, transparent 100%)',
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { swipeStartX.current = null; swipeStartY.current = null; }}
          >
            {/* No dark overlay — let background image breathe fully */}

            {CARD_ORDER.map((type, i) => {
              const delta = i - activeIndex;
              const pos = getCardPosition(delta);
              const clickable = delta > 0 && delta <= 4;
              const isHovered = hoveredCard === i;

              // Hover: gentle scale-up + brightness for non-active cards
              const hoverScale = isHovered && clickable ? pos.scale * 1.06 : pos.scale;
              const hoverOpacity = isHovered && clickable ? Math.min(1, pos.opacity + 0.15) : pos.opacity;

              return (
                <div
                  key={type}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: pos.z,
                  }}
                >
                <motion.div
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    originX: 0.5,
                    originY: 0.5,
                    rotateY: delta === 0 ? tiltSpring : pos.rotateY,
                  }}
                  animate={{
                    x: pos.x,
                    scale: hoverScale,
                    opacity: hoverOpacity,
                    filter: isHovered && clickable
                      ? `drop-shadow(0 12px 32px rgba(0,0,0,0.5)) brightness(1.15)`
                      : delta === 0
                        ? 'drop-shadow(0 12px 40px rgba(0,0,0,0.5)) drop-shadow(0 0 40px rgba(255,255,255,0.18))'
                        : 'none',
                  }}
                  transition={{
                    x: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
                    scale: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.5, ease: [0.25, 1, 0.5, 1] },
                    rotateY: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                    filter: { duration: 0.4, ease: 'easeOut' },
                  }}
                  onClick={clickable ? () => switchCard(i) : undefined}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Hover label overlay for non-active cards */}
                  {clickable && (
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          style={{
                            position: 'absolute',
                            bottom: -28,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            whiteSpace: 'nowrap',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: 'rgba(255,255,255,0.85)',
                            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                            pointerEvents: 'none',
                            zIndex: 30,
                          }}
                        >
                          {CARD_META[i]?.label}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                  {renderCard(type, delta === 0)}
                </motion.div>
                </div>
              );
            })}

            {/* Swipe direction arrow indicators */}
            <AnimatePresence>
              {swipeDirection && (
                <motion.div
                  key={`swipe-${swipeDirection}`}
                  initial={{ opacity: 0, x: swipeDirection === 'left' ? 20 : -20 }}
                  animate={{ opacity: 0.6, x: 0 }}
                  exit={{ opacity: 0, x: swipeDirection === 'left' ? -10 : 10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    [swipeDirection === 'left' ? 'left' : 'right']: 12,
                    transform: 'translateY(-50%)',
                    zIndex: 25,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `${accent}40`,
                      backdropFilter: 'blur(8px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {swipeDirection === 'left'
                      ? <ChevronLeft style={{ width: 20, height: 20, color: '#fff' }} />
                      : <ChevronRight style={{ width: 20, height: 20, color: '#fff' }} />
                    }
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    );
  }
);

DesktopParallaxSlider.displayName = 'DesktopParallaxSlider';
export default DesktopParallaxSlider;
