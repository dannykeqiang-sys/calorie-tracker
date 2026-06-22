import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy } from 'lucide-react';
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
import { loadProfile, saveProfile } from '../utils/storage';
import { syncProfileToCloud, loadProfileFromCloud } from '../utils/githubDB';
import { getSession } from '../utils/auth';
import { getTodayKey, makeEmptyRecord } from '../utils/recordHelpers';
import { useRecordSync } from '../hooks/useRecordSync';
import { useHistoryRecord } from '../hooks/useHistoryRecord';
import { useRecordHandlers } from '../hooks/useRecordHandlers';
import { useBatchImport } from '../hooks/useBatchImport';
import type { UserProfile, FoodItem, MealType } from '../types';

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function Home() {
  const navigate = useNavigate();

  // ── UI 状态 ──────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('calorie_deepseek_api_key') || 'sk-fc7120cfd042458892fbf370d7fd52de'
  );
  const [activeTab, setActiveTab] = useState('today');
  const [journalDate, setJournalDate] = useState(getTodayKey);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDefaultTab, setAiDefaultTab] = useState<'record' | 'chat'>('record');
  const [showAICelebration, setShowAICelebration] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [mobileCarouselActiveIndex, setMobileCarouselActiveIndex] = useState(0);

  // ── 业务 Hooks ────────────────────────────────────────
  const { record, setRecord, handleRecordChange } = useRecordSync();
  const { historyRecord, setHistoryRecord, handleHistoryRecordChange } =
    useHistoryRecord(journalDate);

  const carouselRef = useRef<MealCarouselRef>(null);
  const desktopCarouselRef = useRef<MealCarouselRef>(null);
  const autoScrollSlot = useRef(0);
  const autoScrollResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const {
    handleMealsUpdate, handleMealsReplace,
    handleExercisesUpdate, handleExercisesReplace,
    handleWaterUpdate, handleWaterReplace,
    handleHistoryMealsUpdate, handleHistoryMealsReplace,
    handleHistoryExercisesUpdate, handleHistoryExercisesReplace,
    handleHistoryWaterUpdate, handleHistoryWaterReplace,
  } = useRecordHandlers({
    setRecord, setHistoryRecord, journalDate, scheduleScroll,
    makeEmptyRecordFn: makeEmptyRecord,
  });

  const { handleBatchImport, handleBackupImport, handleReuseHistoryRecord } = useBatchImport(
    {
      handleMealsUpdate, handleExercisesUpdate, handleWaterUpdate,
      handleMealsReplace, handleExercisesReplace, handleWaterReplace,
    },
    setRecord,
  );

  // ── 初始化：鉴权 + 用户档案 ─────────────────────────────
  useEffect(() => {
    if (!getSession()) {
      navigate('/login');
      return;
    }
    document.title = '燃烧我的卡路里 - 科学管理你的热量';

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
        .catch(() => { setShowOnboarding(true); });
    }
  }, []);

  // ── 回调函数 ──────────────────────────────────────────
  const handleOnboardingComplete = useCallback(
    (p: UserProfile, _key?: string) => {
      setProfile(p);
      syncProfileToCloud(p).catch(() => {});
      setShowOnboarding(false);
      setShowTutorial(true);
    },
    [],
  );

  const handleTutorialDone = useCallback(() => setShowTutorial(false), []);

  const handleProfileSave = useCallback((p: UserProfile) => {
    setProfile(p);
    syncProfileToCloud(p).catch(() => {});
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab !== 'ai') setAiOpen(false);
  }, []);

  const handleAIInput = useCallback(() => {
    setActiveTab('ai');
    setAiOpen(true);
  }, []);

  const closeDrawerAndGoToday = useCallback(() => {
    setAiOpen(false);
    setActiveTab('today');
  }, []);

  // ── 派生值 ────────────────────────────────────────────
  if (!record) return null;

  const today = getTodayKey();
  const isViewingToday = journalDate === today;
  const activeRecord = isViewingToday
    ? record
    : (historyRecord ?? makeEmptyRecord(journalDate));
  const activeOnChange = isViewingToday ? handleRecordChange : handleHistoryRecordChange;

  const wrap = useCallback(
    <T extends (...a: any[]) => void>(fn: T) => (...a: Parameters<T>) => {
      fn(...a); closeDrawerAndGoToday();
    },
    [closeDrawerAndGoToday],
  );

  const activeHandlers = isViewingToday
    ? { handleMealsUpdate, handleMealsReplace, handleExercisesUpdate, handleExercisesReplace, handleWaterUpdate, handleWaterReplace }
    : { handleMealsUpdate: handleHistoryMealsUpdate, handleMealsReplace: handleHistoryMealsReplace, handleExercisesUpdate: handleHistoryExercisesUpdate, handleExercisesReplace: handleHistoryExercisesReplace, handleWaterUpdate: handleHistoryWaterUpdate, handleWaterReplace: handleHistoryWaterReplace };

  const aiHandlers = {
    onMealsUpdate: wrap(activeHandlers.handleMealsUpdate),
    onMealsReplace: wrap(activeHandlers.handleMealsReplace),
    onExercisesUpdate: wrap(activeHandlers.handleExercisesUpdate),
    onExercisesReplace: wrap(activeHandlers.handleExercisesReplace),
    onWaterUpdate: wrap(activeHandlers.handleWaterUpdate),
    onWaterReplace: wrap(activeHandlers.handleWaterReplace),
  };

  const desktopDateBar = (
    <div
      className="flex-shrink-0"
      style={{
        background: 'var(--background)',
        opacity: 0.88,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
        zIndex: 30,
      }}
    >
      <div className="px-6 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <DateSwitcher selectedDate={journalDate} onDateChange={setJournalDate} />
        </div>
        <div className="flex-shrink-0">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(163,184,153,0.12)', color: 'var(--primary)' }}
          >
            {isViewingToday ? '今日' : '历史'}
          </span>
        </div>
      </div>
    </div>
  );

  const desktopRightPanel = (
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
  );

  return (
    <>
      {/* ── 桌面端全屏布局 ──────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col overflow-hidden"
        style={{ height: '100dvh', background: 'linear-gradient(155deg, #e8efe4 0%, #d8e8f6 35%, #e8daf4 100%)' }}
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
                      onClick={() => { handleReuseHistoryRecord(historyRecord); setJournalDate(getTodayKey()); }}
                      className="flex items-center gap-2 py-2 px-4 rounded-xl border border-primary/30 bg-card/90 text-primary text-sm font-medium hover:bg-primary/10 transition-all cursor-pointer shadow-sm tactile-hover"
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
                  onOpenAIInput={handleAIInput}
                />
              </div>
              {desktopRightPanel}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 flex flex-col overflow-hidden">
              {desktopDateBar}
              <div
                className="flex-1 overflow-y-auto"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
              >
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
            {desktopRightPanel}
          </div>
        )}
      </div>

      {/* ── 移动端布局 ──────────────────────────────────── */}
      <div
        className="lg:hidden flex flex-col overflow-hidden"
        style={{ height: '100dvh', background: 'transparent' }}
      >
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
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.48) 45%, rgba(255,255,255,0.68) 100%)' }}
          />
        </div>

        <Navbar
          profile={profile}
          onEditProfile={() => setShowProfile(true)}
          onOpenSettings={() => setShowSettings(true)}
        />

        <div
          className="flex-shrink-0 z-10 border-b border-border"
          style={{ background: 'var(--background)', opacity: 0.92, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          <div className="px-4 sm:px-6 py-1.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <DateSwitcher selectedDate={journalDate} onDateChange={setJournalDate} />
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
          </div>

          {activeTab === 'today' && (
            <div className="flex-1 flex flex-col min-h-0">
              {!isViewingToday && historyRecord && (
                <div className="flex-shrink-0 px-4 sm:px-6 pb-2">
                  <button
                    onClick={() => { handleReuseHistoryRecord(historyRecord); setJournalDate(getTodayKey()); }}
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
                  onOpenAIInput={handleAIInput}
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
          onAIInput={handleAIInput}
        />
      </div>

      {/* ── 共享弹层 ────────────────────────────────────── */}
      <AIDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        profile={profile}
        record={activeRecord}
        apiKey={apiKey}
        isViewingToday={isViewingToday}
        defaultTab={aiDefaultTab}
        onRecordSuccess={() => setShowAICelebration(true)}
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
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
        onExport={() => setShowExport(true)}
        onBatchImport={() => setShowBatchImport(true)}
        apiKey={apiKey}
        onApiKeyChange={(newKey) => {
          localStorage.setItem('calorie_deepseek_api_key', newKey);
          setApiKey(newKey);
        }}
      />

      <ExportDataModal open={showExport} onClose={() => setShowExport(false)} />

      <BatchImportModal
        open={showBatchImport}
        onClose={() => setShowBatchImport(false)}
        apiKey={apiKey}
        onImport={handleBatchImport}
        onImportBackup={handleBackupImport}
      />

      {showOnboarding && <OnboardingPanel onComplete={handleOnboardingComplete} />}

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
