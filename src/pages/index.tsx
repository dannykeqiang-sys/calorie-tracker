import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Upload } from 'lucide-react';
import Navbar from './components/Navbar';
import UserProfilePanel from './components/UserProfilePanel';
import SettingsPanel from './components/SettingsPanel';
import BottomNav from './components/BottomNav';
import AIDrawer from './components/AIDrawer';
import MealCarousel, { getDailyImageUrl, CARD_ORDER } from './components/MealCarousel';
import type { MealCarouselRef } from './components/MealCarousel';
import DateSwitcher from './components/DateSwitcher';
import AnalyticsPanel from './components/AnalyticsPanel';
import SmartAdvicePanel from './components/SmartAdvicePanel';
import OnboardingPanel from './components/OnboardingPanel';
import TutorialOverlay from './components/TutorialOverlay';
import WeightChip from './components/WeightChip';
import DesktopHeader from './components/DesktopHeader';
import DesktopRightPanel from './components/DesktopRightPanel';
import DesktopParallaxSlider from './components/DesktopParallaxSlider';
import ExportDataModal from './components/ExportDataModal';
import BatchImportModal from './components/BatchImportModal';
import type { ImportMode } from './components/BatchImportModal';
import type { MultiDateEntry } from '../utils/deepseek';
import { loadProfile, saveProfile, loadTodayRecord, saveTodayRecord, loadRecordByDate, saveRecordByDate } from '../utils/storage';
import { idbSaveRecord, idbGetRecord } from '../utils/indexedDB';
import { syncRecordToCloud, syncProfileToCloud, loadProfileFromCloud } from '../utils/githubDB';
import { getSession } from '../utils/auth';
import CameraShutter from './components/CameraShutter';
import type { UserProfile, DailyRecord, MealRecord, FoodItem, MealType, ExerciseItem, WaterItem } from '../types';

const DEEPSEEK_KEY_STORAGE = 'calorie_deepseek_api_key';
const QWEN_KEY_STORAGE = 'calorie_qwen_api_key';
const BUILT_IN_QWEN_KEY = 'sk-ws-H.REPPMXR.ifl2.MEQCIFIxa_gYlNpNOP8eSa5p2qo2fY583jzpyeEAzriVEeE2AiBrCvoYMHd5DC5rzmt7NNJx_m5tU0L07W4I1NxUPZEUQw';

function loadDeepSeekKey(): string {
  return localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '';
}

function saveDeepSeekKey(key: string) {
  localStorage.setItem(DEEPSEEK_KEY_STORAGE, key);
}

function loadQwenKey(): string {
  return localStorage.getItem(QWEN_KEY_STORAGE) || BUILT_IN_QWEN_KEY;
}

function saveQwenKey(key: string) {
  localStorage.setItem(QWEN_KEY_STORAGE, key);
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function makeEmptyRecord(date: string): DailyRecord {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] } as MealRecord,
    exercises: [],
    water: [],
  };
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [qwenApiKey, setQwenApiKey] = useState<string>('');
  const [activeTab, setActiveTab] = useState('today');
  const [journalDate, setJournalDate] = useState(getTodayKey);
  const [historyRecord, setHistoryRecord] = useState<DailyRecord | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDefaultTab, setAiDefaultTab] = useState<'record' | 'chat'>('record');
  const [showAICelebration, setShowAICelebration] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [mobileCarouselActiveIndex, setMobileCarouselActiveIndex] = useState(0);

  const carouselRef = useRef<MealCarouselRef>(null);
  const desktopCarouselRef = useRef<MealCarouselRef>(null);
  const autoScrollSlot = useRef(0);
  const autoScrollResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!getSession()) {
      navigate('/login');
      return;
    }
    document.title = '燃烧我的卡路里 - 科学管理你的热量';
    setRecord(loadTodayRecord());
    setApiKey(loadDeepSeekKey());
    setQwenApiKey(loadQwenKey());
    const localProfile = loadProfile();
    if (localProfile) {
      setProfile(localProfile);
    } else {
      loadProfileFromCloud()
        .then(cloudProfile => {
          if (cloudProfile) {
            setProfile(cloudProfile);
            saveProfile(cloudProfile);
          } else {
            setShowOnboarding(true);
          }
        })
        .catch(() => {
          setShowOnboarding(true);
        });
    }
  }, []);

  useEffect(() => {
    const today = getTodayKey();
    if (journalDate === today) {
      setHistoryRecord(null);
      return;
    }
    idbGetRecord(journalDate)
      .then(idbRec => {
        setHistoryRecord(idbRec ?? loadRecordByDate(journalDate));
      })
      .catch(() => {
        setHistoryRecord(loadRecordByDate(journalDate));
      });
  }, [journalDate]);

  const scheduleScroll = useCallback((type: MealType | 'exercise') => {
    const slot = autoScrollSlot.current;
    autoScrollSlot.current = slot + 1;
    setTimeout(() => {
      carouselRef.current?.scrollToMeal(type);
      desktopCarouselRef.current?.scrollToMeal(type);
    }, slot * 750 + 200);
    if (autoScrollResetTimer.current) clearTimeout(autoScrollResetTimer.current);
    autoScrollResetTimer.current = setTimeout(
      () => { autoScrollSlot.current = 0; },
      (slot + 1) * 750 + 1200,
    );
  }, []);

  const handleRecordChange = useCallback((newRecord: DailyRecord) => {
    setRecord(newRecord);
    saveTodayRecord(newRecord);
    idbSaveRecord(newRecord).catch(() => {});
    syncRecordToCloud(newRecord).catch(() => {});
  }, []);

  const handleHistoryRecordChange = useCallback((newRecord: DailyRecord) => {
    setHistoryRecord(newRecord);
    saveRecordByDate(newRecord);
    idbSaveRecord(newRecord).catch(() => {});
  }, []);

  const handleMealsUpdate = useCallback(
    (updates: { mealType: MealType; item: FoodItem }[]) => {
      setRecord(prev => {
        if (!prev) return prev;
        const newMeals = { ...prev.meals };
        for (const { mealType, item } of updates) {
          newMeals[mealType] = [...newMeals[mealType], item];
        }
        const newRecord = { ...prev, meals: newMeals };
        saveTodayRecord(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        syncRecordToCloud(newRecord).catch(() => {});
        return newRecord;
      });
      const uniqueTypes = [...new Set(updates.map(u => u.mealType))];
      uniqueTypes.forEach(type => scheduleScroll(type));
    },
    [scheduleScroll],
  );

  const handleExercisesUpdate = useCallback(
    (exercises: ExerciseItem[]) => {
      setRecord(prev => {
        if (!prev) return prev;
        const newRecord = { ...prev, exercises: [...prev.exercises, ...exercises] };
        saveTodayRecord(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        syncRecordToCloud(newRecord).catch(() => {});
        return newRecord;
      });
      if (exercises.length > 0) scheduleScroll('exercise');
    },
    [scheduleScroll],
  );

  const handleMealsReplace = useCallback(
    (updates: { mealType: MealType; item: FoodItem }[]) => {
      setRecord(prev => {
        if (!prev) return prev;
        const newMeals = { ...prev.meals };
        const affectedTypes = new Set(updates.map(u => u.mealType));
        for (const type of affectedTypes) newMeals[type] = [];
        for (const { mealType, item } of updates) {
          newMeals[mealType] = [...newMeals[mealType], item];
        }
        const newRecord = { ...prev, meals: newMeals };
        saveTodayRecord(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        syncRecordToCloud(newRecord).catch(() => {});
        return newRecord;
      });
      const uniqueTypes = [...new Set(updates.map(u => u.mealType))];
      uniqueTypes.forEach(type => scheduleScroll(type));
    },
    [scheduleScroll],
  );

  const handleExercisesReplace = useCallback(
    (exercises: ExerciseItem[]) => {
      setRecord(prev => {
        if (!prev) return prev;
        const newRecord = { ...prev, exercises };
        saveTodayRecord(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        syncRecordToCloud(newRecord).catch(() => {});
        return newRecord;
      });
      if (exercises.length > 0) scheduleScroll('exercise');
    },
    [scheduleScroll],
  );

  const handleWaterUpdate = useCallback((items: WaterItem[]) => {
    setRecord(prev => {
      if (!prev) return prev;
      const newRecord = { ...prev, water: [...(prev.water ?? []), ...items] };
      saveTodayRecord(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
  }, []);

  const handleHistoryMealsUpdate = useCallback(
    (updates: { mealType: MealType; item: FoodItem }[]) => {
      setHistoryRecord(prev => {
        const base = prev ?? makeEmptyRecord(journalDate);
        const newMeals = { ...base.meals };
        for (const { mealType, item } of updates) {
          newMeals[mealType] = [...newMeals[mealType], item];
        }
        const newRecord = { ...base, meals: newMeals };
        saveRecordByDate(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        return newRecord;
      });
      const uniqueTypes = [...new Set(updates.map(u => u.mealType))];
      uniqueTypes.forEach(type => scheduleScroll(type));
    },
    [journalDate, scheduleScroll],
  );

  const handleHistoryMealsReplace = useCallback(
    (updates: { mealType: MealType; item: FoodItem }[]) => {
      setHistoryRecord(prev => {
        const base = prev ?? makeEmptyRecord(journalDate);
        const newMeals = { ...base.meals } as MealRecord;
        const affectedTypes = new Set(updates.map(u => u.mealType));
        for (const type of affectedTypes) newMeals[type] = [];
        for (const { mealType, item } of updates) {
          newMeals[mealType] = [...newMeals[mealType], item];
        }
        const newRecord = { ...base, meals: newMeals };
        saveRecordByDate(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        return newRecord;
      });
      const uniqueTypes = [...new Set(updates.map(u => u.mealType))];
      uniqueTypes.forEach(type => scheduleScroll(type));
    },
    [journalDate, scheduleScroll],
  );

  const handleHistoryExercisesUpdate = useCallback(
    (exercises: ExerciseItem[]) => {
      setHistoryRecord(prev => {
        const base = prev ?? makeEmptyRecord(journalDate);
        const newRecord = { ...base, exercises: [...base.exercises, ...exercises] };
        saveRecordByDate(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        return newRecord;
      });
      if (exercises.length > 0) scheduleScroll('exercise');
    },
    [journalDate, scheduleScroll],
  );

  const handleHistoryExercisesReplace = useCallback(
    (exercises: ExerciseItem[]) => {
      setHistoryRecord(prev => {
        const base = prev ?? makeEmptyRecord(journalDate);
        const newRecord = { ...base, exercises };
        saveRecordByDate(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        return newRecord;
      });
      if (exercises.length > 0) scheduleScroll('exercise');
    },
    [journalDate, scheduleScroll],
  );

  const handleHistoryWaterUpdate = useCallback(
    (items: WaterItem[]) => {
      setHistoryRecord(prev => {
        const base = prev ?? makeEmptyRecord(journalDate);
        const newRecord = { ...base, water: [...(base.water ?? []), ...items] };
        saveRecordByDate(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        return newRecord;
      });
    },
    [journalDate],
  );

  const handleWaterReplace = useCallback((items: WaterItem[]) => {
    setRecord(prev => {
      if (!prev) return prev;
      const newRecord = { ...prev, water: items };
      saveTodayRecord(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
  }, []);

  const handleHistoryWaterReplace = useCallback(
    (items: WaterItem[]) => {
      setHistoryRecord(prev => {
        const base = prev ?? makeEmptyRecord(journalDate);
        const newRecord = { ...base, water: items };
        saveRecordByDate(newRecord);
        idbSaveRecord(newRecord).catch(() => {});
        syncRecordToCloud(newRecord).catch(() => {});
        return newRecord;
      });
    },
    [journalDate],
  );

  const handleOnboardingComplete = useCallback((p: UserProfile, key: string) => {
    setProfile(p);
    if (key) {
      setApiKey(key);
      saveDeepSeekKey(key);
    }
    syncProfileToCloud(p).catch(() => {});
    setShowOnboarding(false);
    setShowTutorial(true);
  }, []);

  const handleTutorialDone = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const handleReuseHistoryRecord = useCallback(() => {
    if (!historyRecord) return;
    setRecord(prev => {
      const base = prev ?? makeEmptyRecord(getTodayKey());
      const newRecord = {
        ...base,
        meals: { ...historyRecord.meals },
        exercises: [...historyRecord.exercises],
        water: [...(historyRecord.water ?? [])],
      };
      saveTodayRecord(newRecord);
      idbSaveRecord(newRecord).catch(() => {});
      syncRecordToCloud(newRecord).catch(() => {});
      return newRecord;
    });
  }, [historyRecord]);

  const handleProfileSave = useCallback((p: UserProfile) => {
    setProfile(p);
    syncProfileToCloud(p).catch(() => {});
  }, []);

  const handleApiKeySave = useCallback((key: string) => {
    setApiKey(key);
    saveDeepSeekKey(key);
  }, []);

  const handleQwenApiKeySave = useCallback((key: string) => {
    setQwenApiKey(key);
    saveQwenKey(key);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab !== 'ai') setAiOpen(false);
  }, []);

  const handleHubPress = useCallback(() => {
    if (activeTab === 'ai') {
      // 已在 AI 分析页 → 唤起拍照底栏
      setShowCamera(true);
    } else {
      // 首次点击 → 切到 AI 逐日分析页
      setActiveTab('ai');
    }
  }, [activeTab]);

  // 视觉识别回填
  const handleVisionResult = useCallback((items: FoodItem[], mealType: MealType, _summary: string) => {
    const updates = items.map(item => ({
      mealType,
      item: { ...item, id: crypto.randomUUID() },
    }));
    handleMealsUpdate(updates);
    const uniqueTypes = [...new Set(updates.map(u => u.mealType))];
    uniqueTypes.forEach(type => scheduleScroll(type));
  }, [handleMealsUpdate, scheduleScroll]);

  const handleBatchImport = useCallback(async (entries: MultiDateEntry[], mode: ImportMode) => {
    const todayKey = getTodayKey();
    for (const entry of entries) {
      const isToday = entry.date === todayKey;
      const mealUpdates: { mealType: MealType; item: FoodItem }[] = [];
      for (const mt of ['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]) {
        for (const f of (entry.meals[mt] ?? [])) {
          mealUpdates.push({
            mealType: mt,
            item: { id: crypto.randomUUID(), name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, sodium: f.sodium },
          });
        }
      }
      const exerciseItems: ExerciseItem[] = (entry.exercises ?? []).map(e => ({
        id: crypto.randomUUID(), name: e.name, calories: e.calories, duration: 0,
      }));
      const waterItems: WaterItem[] = (entry.water_logs ?? []).map(w => ({
        id: crypto.randomUUID(), amount: w.amount, note: w.raw_text, time: '',
      }));
      if (isToday) {
        if (mode === 'overwrite') {
          if (mealUpdates.length > 0) handleMealsReplace(mealUpdates);
          if (exerciseItems.length > 0) handleExercisesReplace(exerciseItems);
          if (waterItems.length > 0) handleWaterReplace(waterItems);
        } else {
          if (mealUpdates.length > 0) handleMealsUpdate(mealUpdates);
          if (exerciseItems.length > 0) handleExercisesUpdate(exerciseItems);
          if (waterItems.length > 0) handleWaterUpdate(waterItems);
        }
      } else {
        let existing: DailyRecord;
        try {
          existing = (await idbGetRecord(entry.date)) ?? loadRecordByDate(entry.date) ?? makeEmptyRecord(entry.date);
        } catch {
          existing = loadRecordByDate(entry.date) ?? makeEmptyRecord(entry.date);
        }
        let newRecord: DailyRecord;
        if (mode === 'overwrite') {
          const newMeals = { breakfast: [], lunch: [], dinner: [], snack: [] } as MealRecord;
          for (const { mealType, item } of mealUpdates) {
            newMeals[mealType] = [...newMeals[mealType], item];
          }
          newRecord = { ...existing, meals: newMeals, exercises: exerciseItems, water: waterItems };
        } else {
          const newMeals = { ...existing.meals };
          for (const { mealType, item } of mealUpdates) {
            newMeals[mealType] = [...(newMeals[mealType] ?? []), item];
          }
          newRecord = {
            ...existing,
            meals: newMeals,
            exercises: [...(existing.exercises ?? []), ...exerciseItems],
            water: [...(existing.water ?? []), ...waterItems],
          };
        }
        saveRecordByDate(newRecord);
        await idbSaveRecord(newRecord).catch(() => {});
      }
    }
  }, [handleMealsUpdate, handleExercisesUpdate, handleWaterUpdate, handleMealsReplace, handleExercisesReplace, handleWaterReplace]);

  // 口令恢复：直接将完整记录写入
  const handleBackupImport = useCallback(async (records: DailyRecord[]) => {
    for (const r of records) {
      saveRecordByDate(r);
      await idbSaveRecord(r).catch(() => {});
    }
    // 如果恢复的记录包含今天，刷新当前记录
    const todayKey = getTodayKey();
    if (records.some(r => r.date === todayKey)) {
      setRecord(loadTodayRecord());
    }
  }, []);

  const closeDrawerAndGoToday = useCallback(() => {
    setAiOpen(false);
    setActiveTab('today');
  }, []);

  if (!record) return null;

  const today = getTodayKey();
  const isViewingToday = journalDate === today;
  const activeRecord = isViewingToday ? record : (historyRecord ?? makeEmptyRecord(journalDate));
  const activeOnChange = isViewingToday ? handleRecordChange : handleHistoryRecordChange;

  const aiHandlers = isViewingToday
    ? {
        onMealsUpdate: (updates: { mealType: MealType; item: FoodItem }[]) => { handleMealsUpdate(updates); closeDrawerAndGoToday(); },
        onMealsReplace: (updates: { mealType: MealType; item: FoodItem }[]) => { handleMealsReplace(updates); closeDrawerAndGoToday(); },
        onExercisesUpdate: (exercises: ExerciseItem[]) => { handleExercisesUpdate(exercises); closeDrawerAndGoToday(); },
        onExercisesReplace: (exercises: ExerciseItem[]) => { handleExercisesReplace(exercises); closeDrawerAndGoToday(); },
        onWaterUpdate: (items: WaterItem[]) => { handleWaterUpdate(items); closeDrawerAndGoToday(); },
        onWaterReplace: (items: WaterItem[]) => { handleWaterReplace(items); closeDrawerAndGoToday(); },
      }
    : {
        onMealsUpdate: (updates: { mealType: MealType; item: FoodItem }[]) => { handleHistoryMealsUpdate(updates); closeDrawerAndGoToday(); },
        onMealsReplace: (updates: { mealType: MealType; item: FoodItem }[]) => { handleHistoryMealsReplace(updates); closeDrawerAndGoToday(); },
        onExercisesUpdate: (exercises: ExerciseItem[]) => { handleHistoryExercisesUpdate(exercises); closeDrawerAndGoToday(); },
        onExercisesReplace: (exercises: ExerciseItem[]) => { handleHistoryExercisesReplace(exercises); closeDrawerAndGoToday(); },
        onWaterUpdate: (items: WaterItem[]) => { handleHistoryWaterUpdate(items); closeDrawerAndGoToday(); },
        onWaterReplace: (items: WaterItem[]) => { handleHistoryWaterReplace(items); closeDrawerAndGoToday(); },
      };

  const desktopDateBar = (
    <div
      className="flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid rgba(255,255,255,0.5)',
        boxShadow: 'inset 0 6px 12px rgba(255,255,255,0.3)',
        zIndex: 30,
      }}
    >
      <div className="px-6 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <DateSwitcher selectedDate={journalDate} onDateChange={setJournalDate} />
        </div>
        <div className="flex-shrink-0">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'rgba(163,184,153,0.12)', color: 'var(--primary)' }}>
            {isViewingToday ? '今日' : '历史'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端全屏布局 */}
      <div
        className="hidden lg:flex flex-col overflow-hidden"
        style={{ height: '100dvh', background: 'linear-gradient(135deg, #e6efe0 0%, #d4e8f4 40%, #e8d8f2 100%)' }}
      >
        <DesktopHeader
          profile={profile}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onEditProfile={() => setShowProfile(true)}
          onOpenSettings={() => setShowSettings(true)}
          onBatchImport={() => setShowBatchImport(true)}
        />

        {activeTab === 'today' ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {desktopDateBar}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 min-h-0 relative overflow-hidden">
                {!isViewingToday && historyRecord && (
                  <div className="absolute top-3 left-6 z-50">
                    <button
                      onClick={() => { handleReuseHistoryRecord(); setJournalDate(getTodayKey()); }}
                      className="flex items-center gap-2 py-2 px-4 rounded-xl border border-primary/30 bg-white/80 text-primary text-sm font-medium hover:bg-primary/10 transition-all cursor-pointer shadow-sm"
                      style={{ backdropFilter: 'blur(8px)' }}
                    >
                      <Copy className="w-4 h-4" />
                      复用此日手帐到今天
                    </button>
                  </div>
                )}
                <DesktopParallaxSlider
                  ref={desktopCarouselRef}
                  record={activeRecord}
                  apiKey={apiKey}
                  isViewingToday={isViewingToday}
                  profile={profile}
                  journalDate={journalDate}
                  onChange={activeOnChange}
                  onWaterReplace={isViewingToday ? handleWaterReplace : handleHistoryWaterReplace}
                  onCameraOpen={() => setShowCamera(true)}
                />
              </div>
              <DesktopRightPanel
                record={activeRecord}
                profile={profile}
                apiKey={apiKey}
                journalDate={journalDate}
                isViewingToday={isViewingToday}
                onMealsUpdate={aiHandlers.onMealsUpdate}
                onMealsReplace={aiHandlers.onMealsReplace}
                onExercisesUpdate={aiHandlers.onExercisesUpdate}
                onExercisesReplace={aiHandlers.onExercisesReplace}
                onWaterUpdate={aiHandlers.onWaterUpdate}
                onWaterReplace={aiHandlers.onWaterReplace}
                onRecordSuccess={() => setShowAICelebration(true)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 flex flex-col overflow-hidden">
              {desktopDateBar}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
                <div className="px-6 py-5 space-y-5">
                  {activeTab === 'analytics' && (
                    <AnalyticsPanel profile={profile} record={activeRecord} journalDate={journalDate} />
                  )}
                  {activeTab === 'ai' && (
                    <SmartAdvicePanel profile={profile} record={activeRecord} apiKey={apiKey} isViewingToday={isViewingToday} />
                  )}
                </div>
              </div>
            </main>
            <DesktopRightPanel
              record={activeRecord}
              profile={profile}
              apiKey={apiKey}
              journalDate={journalDate}
              isViewingToday={isViewingToday}
              onMealsUpdate={aiHandlers.onMealsUpdate}
              onMealsReplace={aiHandlers.onMealsReplace}
              onExercisesUpdate={aiHandlers.onExercisesUpdate}
              onExercisesReplace={aiHandlers.onExercisesReplace}
              onWaterUpdate={aiHandlers.onWaterUpdate}
              onWaterReplace={aiHandlers.onWaterReplace}
              onRecordSuccess={() => setShowAICelebration(true)}
            />
          </div>
        )}
      </div>

      {/* 移动端布局 */}
      <div className="lg:hidden flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'transparent' }}>
        {/* 移动端全屏视差背景 */}
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {CARD_ORDER.map((type, i) => (
            <div
              key={type}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${getDailyImageUrl(type, journalDate)})`,
                opacity: mobileCarouselActiveIndex === i ? 1 : 0,
                transition: 'opacity 0.7s ease',
              }}
            />
          ))}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.52) 45%, rgba(255,255,255,0.72) 100%)' }}
          />
        </div>

        <Navbar
          profile={profile}
          onEditProfile={() => setShowProfile(true)}
          onOpenSettings={() => setShowSettings(true)}
        />

        <div className="flex-shrink-0 z-10 border-b border-white/40" style={{ background: 'rgba(250,248,245,0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="px-4 sm:px-6 py-1.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <DateSwitcher
                selectedDate={journalDate}
                onDateChange={setJournalDate}
              />
            </div>
            <WeightChip journalDate={journalDate} />
          </div>
        </div>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex-shrink-0 flex items-center gap-2 pt-3 pb-2 px-4 sm:px-6">
            <div className="flex-1 min-w-0">
              {activeTab === 'today' && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: 'var(--primary)', opacity: 0.5 }} />
                  <span className="text-sm font-bold text-foreground">今日手帐</span>
                  <span className="text-xs text-muted-foreground/45 hidden sm:inline">
                    {isViewingToday ? '记录饮食与运动' : '历史记录查看'}
                  </span>
                </div>
              )}
              {activeTab === 'analytics' && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: 'var(--primary)', opacity: 0.5 }} />
                  <span className="text-sm font-bold text-foreground">对比时光机</span>
                  <span className="text-xs text-muted-foreground/45 hidden sm:inline">
                    {isViewingToday ? '近7天健康趋势' : `${formatDateLabel(journalDate)} · 近7天`}
                  </span>
                </div>
              )}
              {activeTab === 'ai' && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: 'var(--primary)', opacity: 0.5 }} />
                  <span className="text-sm font-bold text-foreground">AI 分析</span>
                  <span className="text-xs text-muted-foreground/45 hidden sm:inline">炎症指数 · 训练建议</span>
                </div>
              )}
            </div>
            {activeTab === 'today' && (
              <button
                onClick={() => setShowBatchImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)' }}
              >
                <Upload className="w-3 h-3" />
                导入
              </button>
            )}
          </div>

          {activeTab === 'today' && (
            <div className="flex-1 flex flex-col min-h-0">
              {!isViewingToday && historyRecord && (
                <div className="flex-shrink-0 px-4 sm:px-6 pb-2">
                  <button
                    onClick={() => { handleReuseHistoryRecord(); setJournalDate(getTodayKey()); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-all cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    复用此日手帐到今天
                  </button>
                </div>
              )}

              <div data-tutorial="cards" className="flex-1 min-h-0 pb-16">
                <MealCarousel
                  ref={carouselRef}
                  record={activeRecord}
                  apiKey={apiKey}
                  isViewingToday={isViewingToday}
                  profile={profile}
                  journalDate={journalDate}
                  onChange={activeOnChange}
                  onWaterReplace={isViewingToday ? handleWaterReplace : handleHistoryWaterReplace}
                  onActiveIndexChange={setMobileCarouselActiveIndex}
                  onCameraOpen={() => setShowCamera(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex-1 overflow-y-auto pb-20 px-4 sm:px-6">
              <AnalyticsPanel profile={profile} record={activeRecord} journalDate={journalDate} />
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex-1 overflow-y-auto pb-20 px-4 sm:px-6">
              <SmartAdvicePanel profile={profile} record={activeRecord} apiKey={apiKey} isViewingToday={isViewingToday} />
            </div>
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCameraOpen={handleHubPress}
        />
      </div>

      {/* 共享弹层 */}
      <AIDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        profile={profile}
        record={activeRecord}
        apiKey={apiKey}
        isViewingToday={isViewingToday}
        defaultTab={aiDefaultTab}
        onRecordSuccess={() => setShowAICelebration(true)}
        onCameraOpen={() => setShowCamera(true)}
        {...aiHandlers}
      />

      <UserProfilePanel
        open={showProfile}
        profile={profile}
        onClose={() => setShowProfile(false)}
        onSave={handleProfileSave}
      />
      <SettingsPanel
        open={showSettings}
        apiKey={apiKey}
        qwenApiKey={qwenApiKey}
        onClose={() => setShowSettings(false)}
        onSave={handleApiKeySave}
        onSaveQwen={handleQwenApiKeySave}
        onLogout={handleLogout}
        onExport={() => setShowExport(true)}
        onBatchImport={() => setShowBatchImport(true)}
      />

      <ExportDataModal
        open={showExport}
        onClose={() => setShowExport(false)}
      />

      <BatchImportModal
        open={showBatchImport}
        onClose={() => setShowBatchImport(false)}
        apiKey={apiKey}
        onImport={handleBatchImport}
        onImportBackup={handleBackupImport}
      />

      <CameraShutter
        open={showCamera}
        apiKey={qwenApiKey}
        onClose={() => setShowCamera(false)}
        onResult={handleVisionResult}
      />

      {showOnboarding && (
        <OnboardingPanel onComplete={handleOnboardingComplete} />
      )}

      {showTutorial && profile && (
        <TutorialOverlay
          name={profile.name}
          onDone={handleTutorialDone}
          onTabChange={handleTabChange}
        />
      )}
    </>
  );
}
