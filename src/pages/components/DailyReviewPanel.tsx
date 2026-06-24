import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/shadcn/button';
import { Sparkles, Mail, AlertCircle } from 'lucide-react';
import { streamReview } from '../../utils/deepseek';
import { idbGetRecentRecords } from '../../utils/indexedDB';
import { calcBMR, calcTargetCalories } from '../../utils/calculations';
import type { UserProfile, DailyRecord } from '../../types';

interface DailyReviewPanelProps {
  profile: UserProfile | null;
  record: DailyRecord;
  apiKey: string;
  isComplete: boolean;
}

type Status = 'locked' | 'ready' | 'loading' | 'streaming' | 'done' | 'error';

const SYSTEM_PROMPT = `你是一位温暖、包容、不评判的 AI 健康伙伴，名字叫"卡卡"。
语气：充满同理心、鼓励、温柔、治愈，像一位懂你的老朋友或生活教练。
绝对不要：制造身材焦虑、罪恶感、学术式说教、严厉警告。
任务：在用户完成当日所有数据录入后，基于多日趋势数据，给出温柔的饮食运动优化建议，并传递高情绪价值，让用户充满动力。
格式：分段落，每段落不超过100字，配合emoji让文字更有温度，不超过400字总。`;

function getReviewCacheKey(date: string): string {
  return `daily_review_cache_${date}`;
}

function loadReviewCache(date: string): string | null {
  try {
    return localStorage.getItem(getReviewCacheKey(date));
  } catch {
    return null;
  }
}

function saveReviewCache(date: string, text: string): void {
  try {
    localStorage.setItem(getReviewCacheKey(date), text);
  } catch {
    // ignore
  }
}

function clearReviewCache(date: string): void {
  try {
    localStorage.removeItem(getReviewCacheKey(date));
  } catch {
    // ignore
  }
}

function buildUserMessage(profile: UserProfile, today: DailyRecord, history: DailyRecord[]): string {
  const bmr = calcBMR(profile);
  const target = calcTargetCalories(profile);
  const goal = profile.goal === 'lose' ? '减脂' : profile.goal === 'gain' ? '增肌' : '维持体重';

  const fmt = (r: DailyRecord) => {
    const intake = Object.values(r.meals).flat().reduce((s, f) => s + f.calories, 0);
    const burn = r.exercises.reduce((s, e) => s + e.calories, 0);
    return `${r.date}：摄入 ${intake} kcal，运动消耗 ${burn} kcal，净 ${intake - burn} kcal（目标 ${target} kcal）`;
  };

  const historyText = history.length > 0
    ? history.map(fmt).join('\n')
    : '暂无历史记录';

  const todayIntake = Object.values(today.meals).flat().reduce((s, f) => s + f.calories, 0);
  const todayBurn = today.exercises.reduce((s, e) => s + e.calories, 0);
  const todayMeals = Object.entries(today.meals)
    .map(([k, items]) => {
      const label = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[k];
      const total = items.reduce((s, f) => s + f.calories, 0);
      const names = items.map(f => f.name).join('、') || '未录入';
      return `${label}：${names}（${total} kcal）`;
    })
    .join('\n');

  return `我已完成今日所有数据录入，请帮我做一个温柔的复盘。

基本信息：${profile.gender === 'female' ? '女' : '男'}，${profile.age}岁，身高${profile.height}cm，体重${profile.weight}kg，目标：${goal}，BMR：${bmr} kcal

最近几天数据：
${historyText}

今日（${today.date}）详细：
${todayMeals}
运动：${today.exercises.length > 0 ? today.exercises.map(e => `${e.name} ${e.duration}分钟 ${e.calories}kcal`).join('、') : '未记录'}
今日合计：摄入 ${todayIntake} kcal，消耗 ${todayBurn} kcal，净摄入 ${todayIntake - todayBurn} kcal

请用温暖的语言给我一段复盘建议，重点关注情绪疏导和可行的小建议，不要指责我。`;
}

export default function DailyReviewPanel({ profile, record, apiKey, isComplete }: DailyReviewPanelProps) {
  const [status, setStatus] = useState<Status>('locked');
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const textRef = useRef('');

  useEffect(() => {
    if (!isComplete) {
      setStatus('locked');
      setText('');
      textRef.current = '';
      return;
    }
    const cached = loadReviewCache(record.date);
    if (cached) {
      setText(cached);
      textRef.current = cached;
      setStatus('done');
    } else {
      setStatus('ready');
    }
  }, [isComplete, record.date]);

  const handleGenerate = async () => {
    if (!profile || !apiKey) return;

    const cached = loadReviewCache(record.date);
    if (cached) {
      setText(cached);
      textRef.current = cached;
      setStatus('done');
      return;
    }

    setStatus('loading');
    setText('');
    textRef.current = '';

    try {
      const history = await idbGetRecentRecords(5);
      const recentHistory = history.filter(r => r.date !== record.date);
      setStatus('streaming');

      streamReview(
        apiKey,
        SYSTEM_PROMPT,
        buildUserMessage(profile, record, recentHistory),
        {
          onChunk: (chunk) => {
            textRef.current += chunk;
            setText(textRef.current);
          },
          onDone: () => {
            saveReviewCache(record.date, textRef.current);
            setStatus('done');
          },
          onError: (err) => {
            setErrorMsg(err.message);
            setStatus('error');
          },
        },
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '未知错误');
      setStatus('error');
    }
  };

  const handleRegen = () => {
    clearReviewCache(record.date);
    setText('');
    textRef.current = '';
    setStatus('ready');
  };

  if (status === 'locked') {
    return (
      <div className="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[260px]">
        <div className="relative">
          <div className="w-20 h-16 rounded-xl border-2 border-primary/40 bg-card flex items-center justify-center shadow-sm">
            <Mail className="w-8 h-8 text-primary/50" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary/40 border border-secondary/30" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-base">今日日记还没写完哦</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px]">
            写完今天的日记，就可以拆开 AI 的信件了～
            <br />
            <span className="text-xs">（需要：填写个人信息 + 至少录入一餐）</span>
          </p>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[260px]">
        <div className="relative">
          <div className="w-20 h-16 rounded-xl border-2 border-primary/50 bg-card flex items-center justify-center shadow-md">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-secondary animate-pulse" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-base">今日数据已录入完成</p>
          <p className="text-sm text-muted-foreground mt-1">点击下方按钮，让 AI 卡卡读懂你的生活日志</p>
        </div>
        {!apiKey ? (
          <p className="text-sm text-secondary font-medium">请先在右上角设置中填写 DeepSeek API Key</p>
        ) : (
          <Button
            onClick={handleGenerate}
            className="btn-breathe bg-primary hover:bg-primary/90 text-primary-foreground px-8 cursor-pointer gap-2"
          >
            <Sparkles className="w-4 h-4" />
            生成今日复盘
          </Button>
        )}
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[260px]">
        <div className="flex items-end gap-2 h-10">
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              className="w-2.5 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? '#A3B899' : '#EBB193',
                animation: `float-bubble 1.4s ease-in-out ${i * 0.2}s infinite`,
                height: '10px',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
        <div>
          <p className="text-sm text-foreground font-medium">正在认真阅读你的生活日志</p>
          <p className="text-xs text-muted-foreground mt-1">请稍等片刻，卡卡在认真思考中...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 flex flex-col gap-3 min-h-[160px]">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold text-sm">复盘生成失败</span>
        </div>
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatus('ready')}
          className="self-start cursor-pointer border-border"
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-6 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">卡卡的今日复盘</p>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('zh-CN')}</p>
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <p
          className="text-sm text-foreground leading-7 whitespace-pre-wrap"
          style={{ fontFamily: "'Noto Serif SC', serif" }}
        >
          {text}
          {status === 'streaming' && (
            <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
          )}
        </p>
      </div>

      {status === 'done' && (
        <div className="pt-2 border-t border-border flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegen}
            className="text-xs cursor-pointer border-border text-muted-foreground hover:text-foreground"
          >
            重新生成
          </Button>
        </div>
      )}
    </div>
  );
}
