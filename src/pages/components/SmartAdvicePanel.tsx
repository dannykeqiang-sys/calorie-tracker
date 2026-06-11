import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Target, Leaf, Dumbbell, Lightbulb, AlertCircle, Info, RefreshCw, Apple, Heart, Star, Zap, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { generateSmartAdvice } from '../../utils/deepseek';
import type { SmartAdviceResult } from '../../utils/deepseek';
import { idbGetRecentRecords } from '../../utils/indexedDB';
import { calcTargetCalories, calcBMI } from '../../utils/calculations';
import type { UserProfile, DailyRecord } from '../../types';

interface SmartAdvicePanelProps {
  profile: UserProfile | null;
  record: DailyRecord;
  apiKey: string;
  isViewingToday?: boolean;
}

type PanelStatus = 'ready' | 'loading' | 'revealed' | 'error';

interface CacheEntry {
  snapshotKey: string;
  result: SmartAdviceResult;
}

interface StaticAdvice {
  icon: React.ElementType;
  title: string;
  content: string;
  color: string;
  bg: string;
}

interface WorkoutNutrition {
  preWorkout: string;
  postWorkout: string;
}

const TRAINING_PARTS = [
  { id: '胸', color: '#EC4899' },
  { id: '肩', color: '#F97316' },
  { id: '背', color: '#3B82F6' },
  { id: '腿', color: '#22C55E' },
  { id: '手臂', color: '#8B5CF6' },
];

function genWorkoutNutrition(muscles: string[], profile: UserProfile | null): WorkoutNutrition {
  const isLargeMuscle = muscles.some(m => m === '腿' || m === '背' || m === '胸');
  const weight = profile?.weight ?? 70;
  const proteinTarget = Math.round(weight * 0.3);
  const carbTarget = isLargeMuscle ? 40 : 25;
  const muscleLabel = muscles.join('、');

  const preWorkout = isLargeMuscle
    ? `练${muscleLabel}前 60-90 分钟：补充 ${carbTarget}g 复合碳水（如燕麦、香蕉、全麦面包）+ 20g 蛋白质，为大肌群训练储备糖原；训练前 15 分钟可补充少量简单糖快速供能。`
    : `练${muscleLabel}前 45-60 分钟：适量碳水（${carbTarget}g 燕麦或一片全麦吐司）+ 15g 蛋白质即可，上肢训练耗能相对较少，避免训练时胃部负担过重。`;

  const postWorkout = `练${muscleLabel}后 30 分钟黄金窗口：${proteinTarget}g 蛋白质（鸡胸肉、乳清蛋白、鸡蛋）+ ${isLargeMuscle ? 40 : 25}g 快速碳水（白米饭、面包），促进肌糖原回补与肌肉合成；2 小时内安排完整正餐，保证蛋白质均匀分布。`;

  return { preWorkout, postWorkout };
}

function getCacheKey(date: string): string {
  return `smart_advice_cache_${date}`;
}

function loadCache(date: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(getCacheKey(date));
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

function saveCache(date: string, entry: CacheEntry): void {
  try {
    localStorage.setItem(getCacheKey(date), JSON.stringify(entry));
  } catch {}
}

function clearCache(date: string): void {
  try {
    localStorage.removeItem(getCacheKey(date));
  } catch {}
}

const TRAINING_PLAN_PREFIX = 'training_plan_';

function loadTrainingPlan(date: string): string[] {
  try {
    const raw = localStorage.getItem(TRAINING_PLAN_PREFIX + date);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveTrainingPlan(date: string, plan: string[]): void {
  try {
    localStorage.setItem(TRAINING_PLAN_PREFIX + date, JSON.stringify(plan));
  } catch {}
}

function buildSnapshotKey(record: DailyRecord, trainingPlan?: string[]): string {
  const b = record.meals.breakfast.reduce((s, f) => s + f.calories, 0);
  const l = record.meals.lunch.reduce((s, f) => s + f.calories, 0);
  const d = record.meals.dinner.reduce((s, f) => s + f.calories, 0);
  const sn = record.meals.snack.reduce((s, f) => s + f.calories, 0);
  const e = record.exercises.reduce((s, ex) => s + ex.calories, 0);
  const w = (record.water || []).reduce((s, wi) => s + wi.amount, 0);
  const t = trainingPlan && trainingPlan.length > 0 ? `_t${[...trainingPlan].sort().join('')}` : '';
  return `b${b}_l${l}_d${d}_s${sn}_e${e}_w${w}${t}`;
}

function isAllEmpty(record: DailyRecord): boolean {
  return Object.values(record.meals).every(items => items.length === 0) &&
    record.exercises.length === 0 &&
    (record.water || []).length === 0;
}

function determineMode(record: DailyRecord, isViewingToday: boolean): 'next_meal' | 'tomorrow' | 'review' {
  if (!isViewingToday) return 'review';
  const hour = new Date().getHours();
  const hasAllMainMeals =
    record.meals.breakfast.length > 0 &&
    record.meals.lunch.length > 0 &&
    record.meals.dinner.length > 0;
  return hour < 21 && !hasAllMainMeals ? 'next_meal' : 'tomorrow';
}

function buildTodaySummary(profile: UserProfile, record: DailyRecord, trainingPlan?: string[]): string {
  const target = calcTargetCalories(profile);
  const intake = Object.values(record.meals).flat().reduce((s, f) => s + f.calories, 0);
  const burn = record.exercises.reduce((s, e) => s + e.calories, 0);
  const water = (record.water || []).reduce((s, w) => s + w.amount, 0);
  const goal = profile.goal === 'lose' ? '减脂' : profile.goal === 'gain' ? '增肌' : '维持体重';
  const mealLines = Object.entries(record.meals)
    .map(([k, items]) => {
      const label = ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' } as Record<string, string>)[k];
      const names = items.map(f => f.name).join('、') || '未录入';
      const cal = items.reduce((s, f) => s + f.calories, 0);
      return `${label}：${names}（${cal} kcal）`;
    })
    .join('\n');
  const exerciseText = record.exercises.length > 0
    ? record.exercises.map(e => `${e.name} ${e.duration}分钟 ${e.calories}kcal`).join('、')
    : '无';
  const trainingText = trainingPlan && trainingPlan.length > 0
    ? `\n今日训练计划：${trainingPlan.join('、')}，请重点针对训练前加餐和练后恢复餐给出具体建议。`
    : '';
  return `目标：${goal}，目标热量：${target} kcal\n总摄入：${intake} kcal，运动消耗：${burn} kcal，净摄入：${intake - burn} kcal\n今日饮水：${water} ml\n\n${mealLines}\n运动：${exerciseText}${trainingText}`;
}

function genStaticAdvices(profile: UserProfile, record: DailyRecord): StaticAdvice[] {
  const advices: StaticAdvice[] = [];
  const bmi = calcBMI(profile.weight, profile.height);
  const target = calcTargetCalories(profile);
  const totalIntake = Object.values(record.meals).flat().reduce((s, f) => s + f.calories, 0);
  const totalBurn = record.exercises.reduce((s, e) => s + e.calories, 0);
  const surplus = totalIntake - totalBurn - target;

  if (bmi.value < 18.5) {
    advices.push({ icon: Apple, title: '增加优质蛋白质摄入', content: 'BMI 偏低，建议每日每公斤体重摄入 1.5-2g 蛋白质，如鸡胸肉、鸡蛋、豆制品，配合力量训练，帮助健康增重。', color: '#7CB9E8', bg: 'bg-blue-50' });
  } else if (bmi.value >= 28) {
    advices.push({ icon: Apple, title: '优化饮食结构', content: '建议以优质蛋白质（占30-35%）和复合碳水（占40-50%）为主，减少精制糖摄入，增加膳食纤维，让身体在饱足感中自然瘦下来。', color: '#E07878', bg: 'bg-red-50' });
  }

  if (surplus > 200) {
    advices.push({ icon: Dumbbell, title: '热量盈余，增加运动消耗', content: `你今天摄入比目标多了 ${Math.abs(surplus)} 大卡，可以增加 ${Math.round(Math.abs(surplus) / 10)} 分钟有氧运动来平衡。`, color: '#EBB193', bg: 'bg-orange-50' });
  } else if (surplus < -300 && totalIntake > 0) {
    const remaining = Math.abs(surplus);
    advices.push({ icon: Apple, title: `还能吃 ${remaining} 大卡`, content: `距离今日目标还有 ${remaining} 大卡的空间，合理安排接下来的餐食，吃饱又营养才是关键！`, color: '#A3B899', bg: 'bg-primary/5' });
  }

  if (totalBurn === 0) {
    advices.push({ icon: Dumbbell, title: '今天还没有运动记录', content: '即使是 20 分钟的健步走（消耗约 100 大卡）也能显著改善胰岛素敏感性，促进脂肪代谢。运动是让你享受美食后最好的礼物！', color: '#7CB9E8', bg: 'bg-blue-50' });
  }

  if (profile.goal === 'lose') {
    advices.push({ icon: Heart, title: '科学减脂核心法则', content: '① 热量缺口控制在 300-500 kcal/天 ② 保证每日 1.2-1.6g/kg 蛋白质防止肌肉流失 ③ 每周 3-5 次有氧+2-3 次力量训练 ④ 保证 7-8 小时睡眠。', color: '#A3B899', bg: 'bg-green-50' });
  } else if (profile.goal === 'gain') {
    advices.push({ icon: Dumbbell, title: '科学增肌核心法则', content: '① 热量盈余控制在 200-300 kcal/天 ② 每日蛋白质 1.6-2.2g/kg ③ 以复合训练为主，每块肌肉每周至少训练 2 次 ④ 训练后 30 分钟内补充蛋白质+碳水。', color: '#8B7EC8', bg: 'bg-violet-50' });
  }

  advices.push({ icon: Star, title: '水分补充别忘了', content: `根据你的体重（${profile.weight}kg），每天至少需要饮水 ${Math.round(profile.weight * 30)}ml。充足的水分有助于代谢废物排出，在运动前后各补充 500ml 效果最佳。`, color: '#A3B899', bg: 'bg-primary/5' });

  return advices.slice(0, 4);
}

export default function SmartAdvicePanel({ profile, record, apiKey, isViewingToday = true }: SmartAdvicePanelProps) {
  const [status, setStatus] = useState<PanelStatus>('ready');
  const [result, setResult] = useState<SmartAdviceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [trainingPlan, setTrainingPlan] = useState<string[]>(() => loadTrainingPlan(record.date));

  const workoutNutrition = useMemo<WorkoutNutrition | null>(() => {
    if (trainingPlan.length === 0) return null;
    return genWorkoutNutrition(trainingPlan, profile);
  }, [trainingPlan, profile]);

  const hasDataChanged = useMemo(() => {
    const cache = loadCache(record.date);
    if (!cache) return true;
    return buildSnapshotKey(record, trainingPlan) !== cache.snapshotKey;
  }, [record, trainingPlan]);

  useEffect(() => {
    const cache = loadCache(record.date);
    if (cache) {
      setResult(cache.result);
      setStatus('revealed');
    } else {
      setStatus('ready');
    }
  }, [record.date]);

  useEffect(() => {
    setTrainingPlan(loadTrainingPlan(record.date));
  }, [record.date]);

  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(''), 4500);
  };

  const selectTraining = (part: string) => {
    setTrainingPlan(prev => {
      const next = prev.includes(part) ? [] : [part];
      saveTrainingPlan(record.date, next);
      return next;
    });
  };

  const callApi = async () => {
    if (!profile || !apiKey) return;
    setStatus('loading');
    setConfirmOpen(false);
    setErrorMsg('');

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

      const mode = determineMode(record, isViewingToday);
      const data = await generateSmartAdvice(apiKey, buildTodaySummary(profile, record, trainingPlan), historyContext, mode);
      const snapshotKey = buildSnapshotKey(record, trainingPlan);
      saveCache(record.date, { snapshotKey, result: data });
      setResult(data);
      setStatus('revealed');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI 生成失败，请稍后重试');
      setStatus('error');
    }
  };

  const generateBtnLabel = isViewingToday ? '生成今日锦囊' : '生成历史复盘';
  const emptyHint = isViewingToday
    ? '让 AI 卡卡为你推演今日锦囊'
    : '让 AI 卡卡帮你复盘这一天';
  const emptySubHint = isViewingToday
    ? '综合早、中、晚、加、动、水六维数据，智能路由至最适合你的时段策略'
    : '基于这一天的饮食与运动数据，生成温柔的复盘洞察';
  const loadingText = isViewingToday
    ? '卡卡正在为你推演专属锦囊...'
    : '卡卡正在为你复盘这一天...';

  const handleGenerate = () => {
    if (!profile) { showAlert('请先在右上角完善个人信息，再来生成专属锦囊～'); return; }
    if (!apiKey) { showAlert('请先在设置中填写 DeepSeek API Key'); return; }
    if (isAllEmpty(record)) {
      showAlert(isViewingToday ? '小主，今日手帐还是空白的呢，先随便记点什么，再来听听我的碎碎念吧～' : '这一天还没有任何记录，无法生成复盘～');
      return;
    }

    const snapshot = buildSnapshotKey(record, trainingPlan);
    const cache = loadCache(record.date);

    if (cache && cache.snapshotKey === snapshot) {
      showAlert('小主，数据没有变化，当前锦囊就是最新方案，不需要重新生成～');
      return;
    }
    if (cache && cache.snapshotKey !== snapshot) { setConfirmOpen(true); return; }
    callApi();
  };

  const handleRegen = () => {
    clearCache(record.date);
    setResult(null);
    setConfirmOpen(false);
    setStatus('ready');
  };

  const isNextMeal = result?.next_action_trigger === 'next_meal';
  const staticAdvices = profile ? genStaticAdvices(profile, record) : [];

  return (
    <div className="w-full h-auto flex flex-col space-y-4">
      {isViewingToday && (
        <div className="rounded-2xl border border-border bg-white/60 p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
              <Dumbbell className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">今日训练计划</p>
            <p className="text-xs text-muted-foreground">单选，AI 将定制加餐方案</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRAINING_PARTS.map(part => {
              const active = trainingPlan.includes(part.id);
              return (
                <button
                  key={part.id}
                  onClick={() => selectTraining(part.id)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border"
                  style={{
                    backgroundColor: active ? `${part.color}18` : 'transparent',
                    borderColor: active ? `${part.color}60` : 'rgba(0,0,0,0.1)',
                    color: active ? part.color : 'var(--muted-foreground)',
                    boxShadow: active ? `0 0 0 2px ${part.color}30` : 'none',
                  }}
                >
                  {part.id}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {workoutNutrition && (
        <div className="space-y-2.5" style={{ animation: 'smart-fade-in 0.3s ease both' }}>
          <div className="flex items-center gap-1.5 px-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-muted-foreground">
              {trainingPlan.join('、')} 训练营养方案
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-md bg-amber-200/60 flex items-center justify-center">
                <Apple className="w-3 h-3 text-amber-600" />
              </div>
              <p className="text-xs font-semibold text-amber-700">训练前加餐</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{workoutNutrition.preWorkout}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-md bg-emerald-200/60 flex items-center justify-center">
                <UtensilsCrossed className="w-3 h-3 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-emerald-700">练后恢复餐</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{workoutNutrition.postWorkout}</p>
          </div>
        </div>
      )}

      {alertMsg && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-primary/8 border border-primary/20 px-4 py-3">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed">{alertMsg}</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[220px]">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white border border-primary/30 flex items-center justify-center shadow-sm">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-secondary border-2 border-white" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-base">{emptyHint}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{emptySubHint}</p>
          </div>
          <Button onClick={handleGenerate} className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer gap-2 px-6">
            <Sparkles className="w-4 h-4" />
            {generateBtnLabel}
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[220px]">
          <div className="flex items-end gap-2 h-10">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className="w-2.5 rounded-full"
                style={{ backgroundColor: i % 2 === 0 ? '#A3B899' : '#EBB193', animation: `smart-float 1.4s ease-in-out ${i * 0.2}s infinite`, height: '10px', display: 'inline-block' }}
              />
            ))}
          </div>
          <div>
            <p className="text-sm text-foreground font-medium">{loadingText}</p>
            <p className="text-xs text-muted-foreground mt-1">{isViewingToday ? '正在分析六维数据与近期趋势' : '正在回顾饮食记录与运动情况'}</p>
          </div>
          <style>{`@keyframes smart-float { 0%, 100% { height: 10px; opacity: 0.5; } 50% { height: 28px; opacity: 1; } }`}</style>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">锦囊生成失败</p>
            <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
            <button onClick={() => setStatus('ready')} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 mt-2 transition-colors">重试</button>
          </div>
        </div>
      )}

      {status === 'revealed' && result && (
        <div className="w-full h-auto flex flex-col space-y-3 bg-white rounded-2xl border border-primary/20 p-5 shadow-sm" style={{ animation: 'smart-fade-in 0.4s ease both' }}>
          <div className="flex items-center justify-between pb-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: isNextMeal ? 'rgba(163,184,153,0.2)' : 'rgba(139,92,246,0.15)' }}>
                <Sparkles className="w-3.5 h-3.5" style={{ color: isNextMeal ? '#6B9960' : '#8B5CF6' }} />
              </div>
              <p className="text-sm font-bold text-foreground">{result.predictive_advice.title}</p>
            </div>
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{record.date}</span>
          </div>

          <div className="w-full p-3.5 rounded-xl border" style={{ backgroundColor: isNextMeal ? 'rgba(163,184,153,0.08)' : 'rgba(139,92,246,0.06)', borderColor: isNextMeal ? 'rgba(163,184,153,0.25)' : 'rgba(139,92,246,0.15)' }}>
            <p className="text-sm text-foreground leading-relaxed">{result.today_review}</p>
          </div>

          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-secondary/15 flex items-center justify-center"><Target className="w-3 h-3 text-secondary" /></div>
              <p className="text-xs font-semibold text-muted-foreground">能量目标</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed pl-7">{result.predictive_advice.energy_target}</p>
          </div>

          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center"><Leaf className="w-3 h-3 text-primary" /></div>
              <p className="text-xs font-semibold text-muted-foreground">饮食策略</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed pl-7">{result.predictive_advice.diet_strategy}</p>
          </div>

          <div className="flex flex-col space-y-1 bg-amber-50/70 border border-amber-100 p-3 rounded-xl">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center"><Dumbbell className="w-3 h-3 text-blue-500" /></div>
              <p className="text-xs font-semibold text-muted-foreground">轻松运动</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed pl-7">{result.predictive_advice.exercise_suggestion}</p>
          </div>

          {result.health_tips && (
            <div className="flex flex-col space-y-1 bg-sky-50 border border-sky-100 p-3 rounded-xl">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center"><Lightbulb className="w-3 h-3 text-sky-500" /></div>
                <p className="text-xs font-semibold text-muted-foreground">暖心小贴士</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed pl-7">{result.health_tips}</p>
            </div>
          )}

          {staticAdvices.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 pb-1 border-t border-border pt-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">个性化健康建议</span>
              </div>
              {staticAdvices.map((advice, i) => {
                const AdviceIcon = advice.icon;
                return (
                  <div key={i} className={`rounded-2xl border border-border ${advice.bg} p-4`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${advice.color}20` }}>
                        <AdviceIcon className="w-4 h-4" style={{ color: advice.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{advice.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{advice.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleGenerate}
              disabled={!hasDataChanged}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ opacity: hasDataChanged ? 1 : 0.35, cursor: hasDataChanged ? 'pointer' : 'not-allowed', color: 'var(--muted-foreground)' }}
            >
              <RefreshCw className="w-3 h-3" />
              {hasDataChanged
                ? (isViewingToday ? '数据有更新？点此重新推演' : '数据有更新？点此重新复盘')
                : (isViewingToday ? '当前数据已是最新推演依据' : '当前数据已是最新复盘依据')}
            </button>
            <button
              onClick={handleRegen}
              disabled={!hasDataChanged}
              className="text-xs underline underline-offset-2 transition-colors"
              style={{ opacity: hasDataChanged ? 0.6 : 0.3, cursor: hasDataChanged ? 'pointer' : 'not-allowed', color: 'var(--muted-foreground)' }}
            >
              重置
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()} style={{ animation: 'smart-slide-up 0.3s cubic-bezier(0.4,0,0.2,1) both' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-secondary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-secondary" />
              </div>
              <p className="font-semibold text-foreground text-sm">检测到数据有更新</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isViewingToday
                ? `需要重新为你推演新的${determineMode(record, isViewingToday) === 'next_meal' ? '下一餐' : '翌日'}策略吗？`
                : '数据有变化，需要重新生成这一天的复盘吗？'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">暂不更新</button>
              <button onClick={callApi} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">确认重新推演</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes smart-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes smart-slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
