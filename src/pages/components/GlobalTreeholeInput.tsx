import { useState, useRef } from 'react';
import { Button } from '@/components/shadcn/button';
import { Mic, MicOff, Sparkles, CheckCircle, AlertCircle, X, Plus, RefreshCw } from 'lucide-react';
import { parseMixedMeals } from '../../utils/deepseek';
import { safeNormalizeString } from '../../utils/stringUtils';
import type { FoodItem, MealType, DailyRecord, ExerciseItem, WaterItem } from '../../types';

interface GlobalTreeholeInputProps {
  apiKey: string;
  record: DailyRecord;
  isViewingToday?: boolean;
  onMealsUpdate: (updates: { mealType: MealType; item: FoodItem }[]) => void;
  onMealsReplace: (updates: { mealType: MealType; item: FoodItem }[]) => void;
  onExercisesUpdate: (exercises: ExerciseItem[]) => void;
  onExercisesReplace: (exercises: ExerciseItem[]) => void;
  onWaterUpdate: (items: WaterItem[]) => void;
  onWaterReplace?: (items: WaterItem[]) => void;
  onRecordSuccess?: () => void;
}

type Status = 'idle' | 'listening' | 'parsing' | 'confirm' | 'success' | 'error';

declare class WebkitSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } }; isFinal: boolean } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

interface SummaryItem {
  label: string;
  name: string;
  calories: number;
  isExercise?: boolean;
  isWater?: boolean;
  waterAmount?: number;
}

interface PendingResult {
  mealUpdates: { mealType: MealType; item: FoodItem }[];
  exerciseItems: ExerciseItem[];
  waterItems: WaterItem[];
  summaryItems: SummaryItem[];
  summary: string;
}

export default function GlobalTreeholeInput({
  apiKey,
  isViewingToday = true,
  onMealsUpdate,
  onMealsReplace,
  onExercisesUpdate,
  onExercisesReplace,
  onWaterUpdate,
  onWaterReplace,
  onRecordSuccess,
}: GlobalTreeholeInputProps) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [summary, setSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [summaryItems, setSummaryItems] = useState<SummaryItem[]>([]);
  const [pending, setPending] = useState<PendingResult | null>(null);
  const recognitionRef = useRef<WebkitSpeechRecognition | null>(null);

  const isSpeechSupported = () =>
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startVoice = () => {
    if (!isSpeechSupported()) return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SR() as WebkitSpeechRecognition;
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    setStatus('listening');

    recognition.onresult = (e) => {
      const transcript = safeNormalizeString(e.results[0][0].transcript);
      setText(transcript);
    };
    recognition.onend = () => {
      if (status === 'listening') setStatus('idle');
    };
    recognition.onerror = () => setStatus('idle');
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setStatus('idle');
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    if (!apiKey) {
      setErrorMsg('请先在设置中填写 DeepSeek API Key');
      setStatus('error');
      return;
    }

    setStatus('parsing');
    setSummary('');
    setErrorMsg('');
    setSummaryItems([]);
    setPending(null);

    try {
      const result = await parseMixedMeals(apiKey, text.trim());

      if (!result.has_data) {
        setErrorMsg('没有识别到有效的饮食信息，请重新描述');
        setStatus('error');
        return;
      }

      const mealUpdates: { mealType: MealType; item: FoodItem }[] = [];
      const items: SummaryItem[] = [];
      const mealKeys: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

      for (const key of mealKeys) {
        const foods = result.data[key];
        if (!Array.isArray(foods)) continue;
        for (const food of foods) {
          const safeName = safeNormalizeString(food.name);
          if (!safeName || food.calories <= 0) continue;
          mealUpdates.push({
            mealType: key,
            item: {
              id: crypto.randomUUID(),
              name: safeName,
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
            },
          });
          items.push({ label: MEAL_LABELS[key], name: safeName, calories: food.calories });
        }
      }

      const exerciseItems: ExerciseItem[] = [];
      if (Array.isArray(result.data.exercises)) {
        for (const ex of result.data.exercises) {
          const safeName = safeNormalizeString(ex.name);
          if (!safeName || ex.calories <= 0) continue;
          exerciseItems.push({
            id: crypto.randomUUID(),
            name: safeName,
            duration: 0,
            calories: ex.calories,
          });
          items.push({ label: '运动', name: safeName, calories: ex.calories, isExercise: true });
        }
      }

      const waterItems: WaterItem[] = [];
      if (Array.isArray(result.data.water_logs)) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        for (const w of result.data.water_logs) {
          if (!w.raw_text || w.amount <= 0) continue;
          const safeName = safeNormalizeString(w.raw_text);
          if (!safeName) continue;
          waterItems.push({ id: crypto.randomUUID(), amount: w.amount, note: safeName, time: timeStr });
          items.push({ label: '喝水', name: safeName, calories: 0, isWater: true, waterAmount: w.amount });
        }
      }

      if (mealUpdates.length === 0 && exerciseItems.length === 0 && waterItems.length === 0) {
        setErrorMsg('没有识别到有效的饮食或运动信息，请重新描述');
        setStatus('error');
        return;
      }

      setPending({ mealUpdates, exerciseItems, waterItems, summaryItems: items, summary: result.analysis_summary });
      setStatus('confirm');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let friendlyMsg = 'AI 解析失败，请检查网络连接';
      if (/401|unauthorized/i.test(rawMsg)) {
        friendlyMsg = 'API Key 无效，请在设置中配置您自己的 DeepSeek API Key';
      } else if (/402|insufficient/i.test(rawMsg)) {
        friendlyMsg = 'API 额度不足，请在设置中更换有效的 API Key';
      } else if (/429|rate.?limit/i.test(rawMsg)) {
        friendlyMsg = '请求过于频繁，请稍后再试';
      } else if (/5\d\d/.test(rawMsg)) {
        friendlyMsg = 'DeepSeek 服务暂时不可用，请稍后重试';
      }
      setErrorMsg(friendlyMsg);
      setStatus('error');
    }
  };

  const handleAppend = () => {
    if (!pending) return;
    onRecordSuccess?.();
    if (pending.mealUpdates.length > 0) onMealsUpdate(pending.mealUpdates);
    if (pending.exerciseItems.length > 0) onExercisesUpdate(pending.exerciseItems);
    if (pending.waterItems.length > 0) onWaterUpdate(pending.waterItems);
    setSummary(pending.summary);
    setSummaryItems(pending.summaryItems);
    setPending(null);
    setStatus('success');
  };

  const handleReplace = () => {
    if (!pending) return;
    onRecordSuccess?.();
    if (pending.mealUpdates.length > 0) onMealsReplace(pending.mealUpdates);
    if (pending.exerciseItems.length > 0) onExercisesReplace(pending.exerciseItems);
    if (pending.waterItems.length > 0) {
      if (onWaterReplace) onWaterReplace(pending.waterItems);
      else onWaterUpdate(pending.waterItems);
    }
    setSummary(pending.summary);
    setSummaryItems(pending.summaryItems);
    setPending(null);
    setStatus('success');
  };

  const reset = () => {
    setStatus('idle');
    setSummary('');
    setErrorMsg('');
    setSummaryItems([]);
    setPending(null);
    setText('');
  };

  const isListening = status === 'listening';
  const isParsing = status === 'parsing';

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{isViewingToday ? '今日吃了什么？' : '当日吃了什么？'}</p>
          <p className="text-xs text-muted-foreground">{isViewingToday ? '今天吃了什么、去哪挥汗了、喝了什么？大白话告诉我，AI 自动分类回填～' : '当日吃了什么、去哪挥汗了、喝了什么？大白话告诉我，AI 自动分类回填～'}</p>
        </div>
      </div>

      {status === 'confirm' && pending ? (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="rounded-xl bg-white/80 border border-primary/20 p-3 space-y-2">
            <p className="text-sm text-foreground leading-relaxed">{pending.summary}</p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {pending.summaryItems.map((m, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: m.isWater
                      ? 'rgba(96,165,250,0.15)'
                      : m.isExercise
                      ? 'rgba(125,185,232,0.15)'
                      : 'rgba(163,184,153,0.15)',
                    color: m.isWater ? '#3B82F6' : m.isExercise ? '#4A90A4' : '#6B9960',
                  }}
                >
                  {m.label} · {m.name}
                  {m.isWater ? ` +${m.waterAmount}ml` : m.isExercise ? ` -${m.calories} kcal` : ` +${m.calories} kcal`}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground px-0.5">如何处理识别结果？</p>
            <div className="flex gap-2">
              <button
                onClick={handleAppend}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-sm font-medium transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                追加到现有记录
              </button>
              <button
                onClick={handleReplace}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 border border-secondary/25 text-secondary text-sm font-medium transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                {isViewingToday ? '覆盖今日记录' : '覆盖当日记录'}
              </button>
            </div>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 transition-colors text-center"
            >
              取消，重新输入
            </button>
          </div>
        </div>
      ) : status === 'success' ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-white/80 border border-primary/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{summary}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {summaryItems.map((m, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: m.isWater
                      ? 'rgba(96,165,250,0.15)'
                      : m.isExercise
                      ? 'rgba(125,185,232,0.15)'
                      : 'rgba(163,184,153,0.15)',
                    color: m.isWater ? '#3B82F6' : m.isExercise ? '#4A90A4' : '#6B9960',
                  }}
                >
                  {m.label} · {m.name}
                  {m.isWater ? ` +${m.waterAmount}ml` : m.isExercise ? ` -${m.calories} kcal` : ` +${m.calories} kcal`}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 transition-colors"
          >
            继续记录下一条
          </button>
        </div>
      ) : status === 'error' ? (
        <div className="rounded-xl bg-white/80 border border-destructive/20 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-2 mt-1 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isListening ? '正在聆听，请说话...' : '如：早上喝了牛奶，中午吃了米饭和鸡胸肉，下午跑步了30分钟'}
              rows={4}
              className="w-full resize-none rounded-xl border border-border/70 bg-white/80 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {text && !isParsing && (
              <button
                onClick={() => setText('')}
                className="absolute right-2 top-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isSpeechSupported() && (
            <button
              type="button"
              onClick={isListening ? stopVoice : startVoice}
              className="w-full h-12 rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer border overflow-hidden relative"
              style={{
                backgroundColor: isListening ? 'rgba(163,184,153,0.18)' : 'rgba(163,184,153,0.08)',
                borderColor: isListening ? '#A3B899' : 'rgba(163,184,153,0.35)',
                boxShadow: isListening ? '0 0 0 3px rgba(163,184,153,0.18), inset 0 1px 3px rgba(163,184,153,0.1)' : 'none',
              }}
            >
              {isListening ? (
                <>
                  <div className="flex items-end gap-[3px] h-6">
                    {[0.35, 0.6, 0.9, 1.0, 0.75, 0.5, 0.85, 0.65, 1.0, 0.7, 0.45, 0.8].map((h, i) => (
                      <span
                        key={i}
                        className="w-[3px] rounded-full bg-primary"
                        style={{
                          height: `${h * 22}px`,
                          animation: `voiceBar 0.7s ease-in-out ${i * 0.06}s infinite alternate`,
                          opacity: 0.75 + h * 0.25,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-primary">点击停止</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-primary/70" />
                  <span className="text-xs font-medium text-primary/70">语音输入</span>
                  <div className="flex items-end gap-[3px] h-4 opacity-30">
                    {[0.5, 0.8, 1.0, 0.8, 0.5, 0.7, 0.9, 0.6].map((h, i) => (
                      <span
                        key={i}
                        className="w-[2px] rounded-full bg-primary"
                        style={{ height: `${h * 14}px` }}
                      />
                    ))}
                  </div>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || isParsing}
              className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white cursor-pointer disabled:cursor-not-allowed text-sm font-medium"
            >
              {isParsing ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>识别中...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>AI 识别</span>
                </div>
              )}
            </Button>
          </div>

          {isParsing && (
            <div className="flex items-center gap-2 px-1">
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                    style={{ animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">正在将食材转化为能量手帐...</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.3); opacity: 0.6; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
