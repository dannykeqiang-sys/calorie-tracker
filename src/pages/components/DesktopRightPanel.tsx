import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RotateCcw, MessageCircle, PenLine } from 'lucide-react';
import WeightChip from './WeightChip';
import GlobalTreeholeInput from './GlobalTreeholeInput';
import { streamChatWithContext } from '../../utils/deepseek';
import type { ChatMessage } from '../../utils/deepseek';
import { calcTargetCalories, calcBMI } from '../../utils/calculations';
import type { UserProfile, DailyRecord, FoodItem, MealType, ExerciseItem, WaterItem } from '../../types';

type AITab = 'record' | 'chat';

const QUICK_QUESTIONS = [
  '今天吃的怎么样？',
  '下一餐吃什么好？',
  '今天还能吃多少？',
  '帮我评价营养搭配',
];

const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

function buildSystemPrompt(profile: UserProfile | null, record: DailyRecord): string {
  const totalIntake = Object.values(record.meals).flat().reduce((s, f) => s + f.calories, 0);
  const totalBurn = record.exercises.reduce((s, e) => s + e.calories, 0);
  const waterTotal = (record.water ?? []).reduce((s, w) => s + w.amount, 0);

  let profileInfo = '用户未设置个人信息。';
  if (profile) {
    const target = calcTargetCalories(profile);
    const bmi = calcBMI(profile.weight, profile.height);
    const goalText = profile.goal === 'lose' ? '减脂' : profile.goal === 'gain' ? '增肌' : '维持体重';
    profileInfo = `用户：${profile.name || '用户'}，${profile.gender === 'male' ? '男' : '女'}，${profile.age}岁，身高${profile.height}cm，体重${profile.weight}kg，BMI ${bmi.value.toFixed(1)}（${bmi.category}），目标：${goalText}，每日目标热量：${target} kcal。`;
  }

  const mealLines: string[] = [];
  for (const [key, foods] of Object.entries(record.meals)) {
    if (foods.length > 0) {
      const items = foods.map(f => `${f.name}(${f.calories}kcal)`).join('、');
      mealLines.push(`${MEAL_LABELS[key]}：${items}`);
    }
  }
  const exerciseText = record.exercises.length > 0
    ? `运动：${record.exercises.map(e => `${e.name}(消耗${e.calories}kcal)`).join('、')}`
    : '';

  const todayInfo = mealLines.length > 0
    ? `今日饮食记录：\n${mealLines.join('\n')}${exerciseText ? '\n' + exerciseText : ''}\n摄入合计：${totalIntake} kcal，运动消耗：${totalBurn} kcal，净摄入：${totalIntake - totalBurn} kcal。${waterTotal > 0 ? `饮水：${waterTotal}ml。` : ''}`
    : '今日暂无饮食记录。';

  return `你是温暖的 AI 健康顾问"卡卡"。语气温柔治愈，简洁明了，不制造焦虑，不说教，高情绪价值。回答控制在200字以内，用自然段落分隔，不要用 markdown 标题或星号粗体格式。

${profileInfo}

${todayInfo}

根据以上信息回答用户关于今日饮食评价、营养建议、下一餐安排的问题。`;
}

function MessageBlocks({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  if (!content && isStreaming) {
    return (
      <div className="flex gap-1 items-center h-5 px-1">
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    );
  }
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length <= 1) {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      return (
        <div className="space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-xs text-foreground leading-relaxed">{line}</p>
          ))}
        </div>
      );
    }
    return <p className="text-xs text-foreground leading-relaxed">{content}</p>;
  }
  return (
    <div className="space-y-1.5">
      {paragraphs.map((para, i) => (
        <div
          key={i}
          className="rounded-lg px-2.5 py-1.5 text-xs text-foreground leading-relaxed"
          style={{
            backgroundColor: i % 2 === 0 ? 'rgba(163,184,153,0.09)' : 'rgba(235,177,147,0.09)',
            borderLeft: `2px solid ${i % 2 === 0 ? 'rgba(163,184,153,0.4)' : 'rgba(235,177,147,0.4)'}`,
          }}
        >
          {para}
        </div>
      ))}
    </div>
  );
}

interface DesktopRightPanelProps {
  record: DailyRecord;
  profile: UserProfile | null;
  apiKey: string;
  journalDate: string;
  isViewingToday?: boolean;
  onMealsUpdate: (updates: { mealType: MealType; item: FoodItem }[]) => void;
  onMealsReplace: (updates: { mealType: MealType; item: FoodItem }[]) => void;
  onExercisesUpdate: (exercises: ExerciseItem[]) => void;
  onExercisesReplace: (exercises: ExerciseItem[]) => void;
  onWaterUpdate: (items: WaterItem[]) => void;
  onWaterReplace?: (items: WaterItem[]) => void;
  onRecordSuccess?: () => void;
}

export default function DesktopRightPanel({
  record,
  profile,
  apiKey,
  journalDate,
  isViewingToday = true,
  onMealsUpdate,
  onMealsReplace,
  onExercisesUpdate,
  onExercisesReplace,
  onWaterUpdate,
  onWaterReplace,
  onRecordSuccess,
}: DesktopRightPanelProps) {
  const [aiTab, setAiTab] = useState<AITab>('record');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    if (!apiKey) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: '请先在设置中填写 DeepSeek API Key，才能和卡卡聊天哦～' },
      ]);
      setInput('');
      return;
    }
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const systemPrompt = buildSystemPrompt(profile, record);
    await streamChatWithContext(apiKey, systemPrompt, newMessages, {
      onChunk: chunk => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      },
      onDone: () => setIsStreaming(false),
      onError: () => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: '抱歉，卡卡好像走神了，请稍后再试～' };
          return updated;
        });
        setIsStreaming(false);
      },
    });
  };

  return (
    <aside
      data-tutorial="ai-input-btn"
      className="w-[300px] xl:w-[340px] flex flex-col flex-shrink-0 overflow-hidden"
      style={{ borderLeft: '1px solid var(--ck-border-medium)', background: 'var(--background)' }}
    >
      {/* 紧凑营养概览 */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        {(() => {
          const allItems = Object.values(record.meals).flat();
          const totalCalories = allItems.reduce((s, f) => s + f.calories, 0);
          const totalBurn = record.exercises.reduce((s, e) => s + e.calories, 0);
          const netCal = totalCalories - totalBurn;
          const targetCal = profile ? calcTargetCalories(profile) : 1800;
          const totalProtein = Math.round(allItems.reduce((s, f) => s + (f.protein ?? 0), 0));
          const totalCarbs = Math.round(allItems.reduce((s, f) => s + (f.carbs ?? 0), 0));
          const totalFat = Math.round(allItems.reduce((s, f) => s + (f.fat ?? 0), 0));
          const calPct = Math.min(100, Math.round((netCal / targetCal) * 100));
          const isOver = netCal > targetCal;
          const MEAL_COLORS = { breakfast: '#F59E0B', lunch: '#A3B899', dinner: '#7CB9E8', snack: '#F472B6' };
          const mealCals = {
            breakfast: record.meals.breakfast.reduce((s, f) => s + f.calories, 0),
            lunch: record.meals.lunch.reduce((s, f) => s + f.calories, 0),
            dinner: record.meals.dinner.reduce((s, f) => s + f.calories, 0),
            snack: record.meals.snack.reduce((s, f) => s + f.calories, 0),
          };
          const totalMealCal = Object.values(mealCals).reduce((s, v) => s + v, 0);
          const barScale = totalMealCal > targetCal ? targetCal / totalMealCal : 1;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-black tabular-nums leading-none" style={{ color: isOver ? '#EF4444' : 'var(--foreground)' }}>
                    {netCal}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/ {targetCal} kcal</span>
                </div>
                <WeightChip journalDate={journalDate} />
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex gap-px" style={{ backgroundColor: 'var(--ck-active)' }}>
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(meal => {
                  const w = (mealCals[meal] * barScale / targetCal) * 100;
                  if (w < 0.5) return null;
                  return (
                    <div
                      key={meal}
                      className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${w}%`, backgroundColor: MEAL_COLORS[meal] }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="font-semibold text-blue-500">P {totalProtein}g</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="font-semibold text-amber-500">C {totalCarbs}g</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="font-semibold text-red-400">F {totalFat}g</span>
                {totalBurn > 0 && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-muted-foreground/60">运动 -{totalBurn}</span>
                  </>
                )}
                <span className="ml-auto text-muted-foreground/40">{calPct}%</span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex-shrink-0 mx-3 mb-1" style={{ height: '1px', backgroundColor: 'var(--ck-border-subtle)' }} />

      {/* AI 区域 */}
      <div className="flex flex-col min-h-0" style={{ flex: '1 1 0' }}>

        {/* Tab 切换 */}
        <div className="flex-shrink-0 flex gap-1 mx-3 mt-2 mb-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--ck-hover)' }}>
          {([
            { key: 'record', label: '快速记录', Icon: PenLine },
            { key: 'chat', label: '对话', Icon: MessageCircle },
          ] as { key: AITab; label: string; Icon: typeof PenLine }[]).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setAiTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer select-none"
              style={{
                backgroundColor: aiTab === key ? 'var(--card)' : 'transparent',
                color: aiTab === key ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: aiTab === key ? '0 1px 4px rgba(0,0,0,0.09)' : 'none',
              }}
            >
              <Icon style={{ width: '12px', height: '12px', flexShrink: 0 }} />
              {label}
            </button>
          ))}
          {aiTab === 'chat' && messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="清空对话"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground transition-all cursor-pointer flex-shrink-0"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--ck-active)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <RotateCcw style={{ width: '11px', height: '11px' }} />
            </button>
          )}
        </div>

        {/* 快速记录 */}
        {aiTab === 'record' && (
          <div
            className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
          >
            <GlobalTreeholeInput
              apiKey={apiKey}
              record={record}
              isViewingToday={isViewingToday}
              onMealsUpdate={onMealsUpdate}
              onMealsReplace={onMealsReplace}
              onExercisesUpdate={onExercisesUpdate}
              onExercisesReplace={onExercisesReplace}
              onWaterUpdate={onWaterUpdate}
              onWaterReplace={onWaterReplace}
              onRecordSuccess={onRecordSuccess}
            />
          </div>
        )}

        {/* 对话 */}
        {aiTab === 'chat' && (
          <>
            <div
              className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center py-3 gap-2.5 text-center">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(163,184,153,0.2), rgba(124,185,168,0.15))' }}
                  >
                    <Sparkles style={{ width: '18px', height: '18px', color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">卡卡在线，随时为你解答</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">问问今日饮食、下一餐安排...</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {QUICK_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        disabled={isStreaming}
                        className="text-[10px] px-2.5 py-1 rounded-full cursor-pointer disabled:opacity-50 transition-all"
                        style={{
                          border: '1px solid rgba(163,184,153,0.35)',
                          backgroundColor: 'rgba(163,184,153,0.08)',
                          color: 'var(--primary)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(163,184,153,0.16)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(163,184,153,0.08)'; }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                        style={{ background: 'rgba(163,184,153,0.2)' }}
                      >
                        <Sparkles style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                      </div>
                    )}
                    {msg.role === 'user' ? (
                      <div
                        className="max-w-[78%] px-3 py-2 text-xs text-white leading-relaxed"
                        style={{ backgroundColor: 'var(--primary)', borderRadius: '14px 14px 3px 14px' }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-[82%]">
                        <MessageBlocks
                          content={msg.content}
                          isStreaming={isStreaming && i === messages.length - 1}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {messages.length > 0 && !isStreaming && (
              <div className="px-3 pb-1 flex flex-wrap gap-1">
                {QUICK_QUESTIONS.slice(0, 2).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-[10px] px-2.5 py-1 rounded-full cursor-pointer transition-all"
                    style={{
                      border: '1px solid rgba(163,184,153,0.3)',
                      backgroundColor: 'rgba(163,184,153,0.06)',
                      color: 'var(--primary)',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div
              className="px-3 pb-3 pt-2 flex gap-2 flex-shrink-0"
              style={{ borderTop: '1px solid var(--ck-border-subtle)' }}
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="随便问问卡卡..."
                disabled={isStreaming}
                className="flex-1 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50"
                style={{ border: '1px solid var(--ck-border-medium)', backgroundColor: 'var(--card)' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 active:scale-90"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Send style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
