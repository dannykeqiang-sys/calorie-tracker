import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageCircle, X, ChevronDown } from 'lucide-react';
import { streamChatWithContext } from '../../utils/deepseek';
import type { ChatMessage } from '../../utils/deepseek';
import type { UserProfile, DailyRecord } from '../../types';
import { calcTargetCalories, calcBMI } from '../../utils/calculations';

interface AIChatPanelProps {
  profile: UserProfile | null;
  record: DailyRecord;
  apiKey: string;
}

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
        <div className="space-y-1.5">
          {lines.map((line, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>
          ))}
        </div>
      );
    }
    return <p className="text-sm text-foreground leading-relaxed">{content}</p>;
  }

  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => (
        <div
          key={i}
          className="rounded-xl px-3 py-2 text-sm text-foreground leading-relaxed"
          style={{
            backgroundColor: i % 2 === 0 ? 'rgba(163,184,153,0.08)' : 'rgba(235,177,147,0.08)',
            borderLeft: `2px solid ${i % 2 === 0 ? 'rgba(163,184,153,0.4)' : 'rgba(235,177,147,0.4)'}`,
          }}
        >
          {para}
        </div>
      ))}
    </div>
  );
}

export default function AIChatPanel({ profile, record, apiKey }: AIChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

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
      onChunk: (chunk) => {
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

  const unreadCount = messages.filter(m => m.role === 'assistant' && m.content).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-24 sm:bottom-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl text-white shadow-lg cursor-pointer active:scale-95 transition-all"
        style={{
          background: 'linear-gradient(135deg, #A3B899, #7CB9A8)',
          boxShadow: '0 8px 24px rgba(163,184,153,0.45), 0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-semibold">和卡卡聊聊</span>
        {unreadCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center">
            {Math.min(unreadCount, 9)}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl bg-white overflow-hidden"
            style={{
              maxHeight: '90vh',
              animation: 'chat-slide-up 0.3s cubic-bezier(0.4,0,0.2,1) both',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 px-5 py-4 border-b border-border/40 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(163,184,153,0.1), rgba(163,184,153,0.04))' }}
            >
              <div className="w-9 h-9 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">卡卡健康顾问</p>
                <p className="text-xs text-muted-foreground">智能分析你的饮食与运动，随时为你解答</p>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-border/30"
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-border/40 transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0" style={{ maxHeight: '55vh', scrollbarWidth: 'thin' }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">卡卡在线，随时为你解答</p>
                    <p className="text-xs text-muted-foreground mt-1">试试问问今日饮食、下一餐安排...</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mb-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    {msg.role === 'user' ? (
                      <div
                        className="max-w-[78%] px-4 py-2.5 text-sm text-white leading-relaxed"
                        style={{
                          backgroundColor: 'var(--primary)',
                          borderRadius: '18px 18px 4px 18px',
                        }}
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

            <div className="px-4 pb-5 pt-3 space-y-2.5 border-t border-border/30 flex-shrink-0">
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      disabled={isStreaming}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
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
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-border/70 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 active:scale-90"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chat-slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
