import { useState } from 'react';
import { Button } from '@/components/shadcn/button';
import { Sparkles, Leaf, Dumbbell, Target, AlertCircle, Lightbulb } from 'lucide-react';
import { generatePredictiveAdvice } from '../../utils/deepseek';
import { idbGetRecentRecords } from '../../utils/indexedDB';
import { calcTargetCalories } from '../../utils/calculations';
import type { UserProfile, DailyRecord } from '../../types';

interface PredictiveAdviceCardProps {
  profile: UserProfile | null;
  record: DailyRecord;
  apiKey: string;
  isComplete: boolean;
}

type Status = 'locked' | 'ready' | 'loading' | 'opening' | 'revealed' | 'error';

interface AdviceState {
  title: string;
  today_review: string;
  energy_target: string;
  diet_strategy: string;
  exercise_suggestion: string;
  health_tips?: string;
}

function getAdviceCacheKey(date: string): string {
  return `predictive_advice_cache_${date}`;
}

function loadAdviceCache(date: string): AdviceState | null {
  try {
    const raw = localStorage.getItem(getAdviceCacheKey(date));
    return raw ? JSON.parse(raw) as AdviceState : null;
  } catch {
    return null;
  }
}

function saveAdviceCache(date: string, advice: AdviceState): void {
  try {
    localStorage.setItem(getAdviceCacheKey(date), JSON.stringify(advice));
  } catch {
    // ignore
  }
}

function clearAdviceCache(date: string): void {
  try {
    localStorage.removeItem(getAdviceCacheKey(date));
  } catch {
    // ignore
  }
}

function buildTodaySummary(profile: UserProfile, record: DailyRecord): string {
  const target = calcTargetCalories(profile);
  const intake = Object.values(record.meals).flat().reduce((s, f) => s + f.calories, 0);
  const burn = record.exercises.reduce((s, e) => s + e.calories, 0);
  const mealLines = Object.entries(record.meals)
    .map(([k, items]) => {
      const label = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[k];
      const names = items.map(f => f.name).join('、') || '未录入';
      const cal = items.reduce((s, f) => s + f.calories, 0);
      return `${label}：${names}（${cal} kcal）`;
    })
    .join('\n');
  const exerciseText = record.exercises.length > 0
    ? record.exercises.map(e => `${e.name} ${e.duration}分钟 ${e.calories}kcal`).join('、')
    : '无';
  return `目标热量：${target} kcal\n总摄入：${intake} kcal\n运动消耗：${burn} kcal\n净摄入：${intake - burn} kcal\n\n${mealLines}\n运动：${exerciseText}`;
}

function determineMode(record: DailyRecord): 'next_meal' | 'tomorrow' {
  const hour = new Date().getHours();
  const hasAllMainMeals =
    record.meals.breakfast.length > 0 &&
    record.meals.lunch.length > 0 &&
    record.meals.dinner.length > 0;
  return hour < 21 && !hasAllMainMeals ? 'next_meal' : 'tomorrow';
}

export default function PredictiveAdviceCard({ profile, record, apiKey, isComplete }: PredictiveAdviceCardProps) {
  const [status, setStatus] = useState<Status>(isComplete ? 'ready' : 'locked');
  const [advice, setAdvice] = useState<AdviceState | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isComplete && status !== 'locked') setStatus('locked');
  if (isComplete && status === 'locked') setStatus('ready');

  const handleUnlock = async () => {
    if (!profile || !apiKey) return;

    const cached = loadAdviceCache(record.date);
    if (cached) {
      setAdvice(cached);
      setStatus('opening');
      setTimeout(() => setStatus('revealed'), 500);
      return;
    }

    setStatus('loading');

    try {
      const history = await idbGetRecentRecords(7);
      const historyContext = history
        .filter(r => r.date !== record.date)
        .map(r => {
          const intake = Object.values(r.meals).flat().reduce((s, f) => s + f.calories, 0);
          const burn = r.exercises.reduce((s, e) => s + e.calories, 0);
          return `${r.date}：摄入 ${intake} kcal，运动 ${burn} kcal`;
        })
        .join('\n') || '暂无近期历史';

      const mode = determineMode(record);
      const result = await generatePredictiveAdvice(
        apiKey,
        buildTodaySummary(profile, record),
        historyContext,
        mode,
      );

      const newAdvice: AdviceState = {
        title: result.predictive_advice.title,
        today_review: result.today_review,
        energy_target: result.predictive_advice.energy_target,
        diet_strategy: result.predictive_advice.diet_strategy,
        exercise_suggestion: result.predictive_advice.exercise_suggestion,
        health_tips: result.predictive_advice.health_tips,
      };

      saveAdviceCache(record.date, newAdvice);
      setAdvice(newAdvice);
      setStatus('opening');
      setTimeout(() => setStatus('revealed'), 500);
    } catch {
      setErrorMsg('AI 生成失败，请稍后重试');
      setStatus('error');
    }
  };

  const handleRegen = () => {
    clearAdviceCache(record.date);
    setAdvice(null);
    setStatus('ready');
  };

  if (status === 'locked') {
    return (
      <div className="w-full h-auto rounded-2xl border border-dashed border-secondary/40 bg-gradient-to-br from-secondary/5 to-primary/5 p-6 flex flex-col items-center justify-center text-center gap-3">
        <svg width="40" height="32" viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="4" width="40" height="28" rx="4" fill="#EBB193" fillOpacity="0.2" stroke="#EBB193" strokeWidth="1.5"/>
          <path d="M0 8 L20 20 L40 8" stroke="#EBB193" strokeWidth="1.5" fill="none"/>
        </svg>
        <div>
          <p className="text-sm font-semibold text-foreground">翌日治愈锦囊</p>
          <p className="text-xs text-muted-foreground mt-1">完成今日饮食记录后解锁</p>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="w-full h-auto rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/8 to-primary/8 p-6 flex flex-col items-center justify-center text-center gap-4">
        <div className="relative">
          <svg width="48" height="38" viewBox="0 0 48 38" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
            <rect x="0" y="4" width="48" height="34" rx="5" fill="white" stroke="#EBB193" strokeWidth="1.5"/>
            <path d="M0 9 L24 24 L48 9" stroke="#EBB193" strokeWidth="1.5" fill="none"/>
          </svg>
          <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-secondary animate-pulse" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">今日数据已就绪</p>
          <p className="text-xs text-muted-foreground mt-1">让 AI 为你预测下一步治愈方案</p>
        </div>
        {!apiKey ? (
          <p className="text-xs text-secondary font-medium">请先在设置中填写 DeepSeek API Key</p>
        ) : (
          <Button
            onClick={handleUnlock}
            size="sm"
            className="bg-secondary hover:bg-secondary/90 text-white cursor-pointer gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            开启锦囊
          </Button>
        )}
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="w-full h-auto rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/8 to-primary/8 p-8 flex flex-col items-center justify-center text-center gap-4">
        <div className="flex items-end gap-1.5 h-8">
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              className="w-2 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? '#A3B899' : '#EBB193',
                animation: `float-bar 1.2s ease-in-out ${i * 0.15}s infinite`,
                height: '8px',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">正在为你生成专属锦囊...</p>
        <style>{`
          @keyframes float-bar {
            0%, 100% { height: 8px; opacity: 0.5; }
            50% { height: 24px; opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (status === 'opening') {
    return (
      <div className="w-full h-auto rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/8 to-primary/8 p-8 flex flex-col items-center justify-center text-center gap-4">
        <svg
          width="56" height="44" viewBox="0 0 56 44" fill="none"
          className="drop-shadow animate-bounce"
        >
          <rect x="0" y="6" width="56" height="38" rx="6" fill="white" stroke="#EBB193" strokeWidth="1.5"/>
          <path d="M0 12 L28 28 L56 12" stroke="#EBB193" strokeWidth="1.5" fill="none"/>
        </svg>
        <p className="text-sm text-muted-foreground">正在打开锦囊...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full h-auto rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-destructive">{errorMsg}</p>
          <button
            onClick={() => setStatus('ready')}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 mt-1"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-auto flex flex-col space-y-4 bg-card rounded-2xl border border-primary/20 p-5"
      style={{ animation: 'fade-slide-in 0.4s ease both' }}
    >
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <div className="w-7 h-7 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-secondary" />
        </div>
        <p className="text-sm font-bold text-foreground">{advice?.title}</p>
      </div>

      <div className="w-full h-auto p-3 bg-primary/5 border border-primary/15 rounded-xl">
        <p className="text-sm text-foreground leading-relaxed">{advice?.today_review}</p>
      </div>

      <div className="w-full h-auto flex flex-col space-y-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-6 h-6 rounded-lg bg-secondary/15 flex items-center justify-center flex-shrink-0">
            <Target className="w-3 h-3 text-secondary" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">能量目标</p>
        </div>
        <p className="text-sm text-foreground leading-normal pl-7.5">{advice?.energy_target}</p>
      </div>

      <div className="w-full h-auto flex flex-col space-y-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Leaf className="w-3 h-3 text-primary" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">饮食策略</p>
        </div>
        <p className="text-sm text-foreground leading-normal pl-7.5">{advice?.diet_strategy}</p>
      </div>

      <div className="w-full h-auto flex flex-col space-y-1 bg-amber-50/60 border border-amber-100 p-3 rounded-xl">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Dumbbell className="w-3 h-3 text-blue-500" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">轻松运动</p>
        </div>
        <p className="text-sm text-foreground leading-normal pl-7.5">{advice?.exercise_suggestion}</p>
      </div>

      {advice?.health_tips && (
        <div className="w-full h-auto flex flex-col space-y-1 bg-sky-50 border border-sky-100 p-3 rounded-xl">
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-3 h-3 text-sky-500" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">健康小贴士</p>
          </div>
          <p className="text-sm text-foreground leading-normal pl-7.5">{advice.health_tips}</p>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleRegen}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 transition-colors"
        >
          重新生成
        </button>
      </div>

      <style>{`
        @keyframes fade-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
