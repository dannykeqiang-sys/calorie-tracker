import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ChevronRight, Check, Loader2 } from 'lucide-react';
import { setSession } from '../utils/auth';
import { saveProfile } from '../utils/storage';
import { syncProfileToCloud } from '../utils/githubDB';
import type { UserProfile, Gender, GoalType, ActivityLevel } from '../types';

const GOAL_OPTIONS: { value: GoalType; label: string; desc: string; icon: string }[] = [
  { value: 'lose', label: '减脂塑形', desc: '控制热量，打造好身材', icon: 'lose' },
  { value: 'maintain', label: '维持体重', desc: '保持现有状态，健康生活', icon: 'maintain' },
  { value: 'gain', label: '增肌增重', desc: '增加热量摄入，强化体魄', icon: 'gain' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: '久坐不动', desc: '几乎不运动' },
  { value: 'light', label: '轻度活跃', desc: '每周 1-3 次' },
  { value: 'moderate', label: '中度活跃', desc: '每周 3-5 次' },
  { value: 'active', label: '高度活跃', desc: '每周 6-7 次' },
  { value: 'very_active', label: '超高强度', desc: '每天高强度' },
];

const AF: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

const STEP_ACCENT = ['#F97316', '#6366F1', '#10B981'];
const STEP_BG = [
  'linear-gradient(160deg, #FFF8F5 0%, #FFF0FA 100%)',
  'linear-gradient(160deg, #F0F4FF 0%, #F5F2FF 100%)',
  'linear-gradient(160deg, #F0FDF8 0%, #F0F9FF 100%)',
];
const STEP_HERO = [
  { title: '你好，欢迎加入', sub: '告诉我你的昵称和性别' },
  { title: '了解你的身体', sub: '精准计算专属热量目标' },
  { title: '设定你的目标', sub: '量身制定每日计划' },
];
const GOAL_ICON: Record<string, string> = { lose: '🔥', maintain: '⚖️', gain: '💪' };

function calcBMR(p: Partial<UserProfile>): number {
  if (!p.weight || !p.height || !p.age || !p.gender) return 0;
  return p.gender === 'male'
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
}

function calcTarget(p: Partial<UserProfile>): number {
  const bmr = calcBMR(p);
  if (!bmr || !p.activityLevel || !p.goal) return 0;
  const tdee = bmr * AF[p.activityLevel];
  return Math.round(p.goal === 'lose' ? tdee - 500 : p.goal === 'gain' ? tdee + 300 : tdee);
}

function GlowInput({ type = 'text', value, onChange, placeholder, unit, accent, disabled }: {
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; unit?: string; accent: string; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className="w-full px-4 py-3.5 rounded-2xl border bg-white/80 text-foreground text-sm outline-none transition-all disabled:opacity-50"
        style={{
          borderColor: focused ? accent : '#E5E7EB',
          boxShadow: focused ? `0 0 0 3px ${accent}22, 0 2px 8px ${accent}18` : '0 1px 3px rgba(0,0,0,0.06)',
          paddingRight: unit ? '3.5rem' : undefined,
        }}
      />
      {unit && <span className="absolute right-3 top-3.5 text-xs text-muted-foreground">{unit}</span>}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const nameFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('name') ?? '';
  }, []);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [flash, setFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(nameFromUrl);
  const [gender, setGender] = useState<Gender>('female');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');

  const accent = STEP_ACCENT[step];
  const hero = STEP_HERO[step];

  const partial: Partial<UserProfile> = {
    gender, age: Number(age) || 0, height: Number(height) || 0,
    weight: Number(weight) || 0, goal, activityLevel,
  };
  const targetCalories = calcTarget(partial);
  const bmi = height && weight ? Math.round((Number(weight) / ((Number(height) / 100) ** 2)) * 10) / 10 : 0;

  const canNext0 = name.trim().length > 0;
  const canNext1 = Number(age) >= 10 && Number(age) <= 120
    && Number(height) >= 100 && Number(height) <= 250
    && Number(weight) >= 20 && Number(weight) <= 300;

  const triggerFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 450); };
  const goNext = () => { triggerFlash(); setDirection(1); setStep(s => s + 1); };
  const goPrev = () => { triggerFlash(); setDirection(-1); setStep(s => s - 1); };

  const handleComplete = async () => {
    if (!canNext0 || !canNext1 || submitting) return;
    setSubmitting(true);
    try {
      const workid = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('calorie_workid', workid);
      const profile: UserProfile = {
        name: name.trim(), gender,
        age: Number(age), height: Number(height), weight: Number(weight),
        goal, activityLevel,
      };
      setSession(workid, name.trim());
      saveProfile(profile);
      await syncProfileToCloud(profile).catch(() => {});
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  const slideAnim = direction === 1 ? 'registerSlideInRight' : 'registerSlideInLeft';

  return (
    <div
      className="fixed inset-0 overflow-auto flex items-center justify-center p-4 py-8 transition-all duration-500"
      style={{ background: STEP_BG[step] }}
    >
      <FloatingDots accent={accent} />

      <div className="relative w-full max-w-sm">
        <div
          key={`hero-${step}`}
          className="text-center mb-6"
          style={{ animation: 'registerHeroIn 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md"
            style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}66)` }}
          >
            <span className="text-3xl">{step === 0 ? '👋' : step === 1 ? '📐' : '🎯'}</span>
          </div>
          <h2
            className="text-xl font-black text-foreground mb-1"
            style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
          >
            {hero.title}
          </h2>
          <p className="text-xs text-muted-foreground">{hero.sub}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: i === step ? '28px' : '8px', backgroundColor: i <= step ? accent : '#E5E7EB' }}
            />
          ))}
        </div>

        <div
          className="rounded-3xl shadow-sm relative overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.7)' }}
        >
          {flash && (
            <div
              className="absolute inset-0 z-10 pointer-events-none rounded-3xl"
              style={{ background: `radial-gradient(circle at 50% 20%, ${accent}44, transparent 70%)`, animation: 'registerFlash 0.45s ease-out forwards' }}
            />
          )}

          <div key={`step-${step}`} style={{ animation: `${slideAnim} 0.35s cubic-bezier(0.4,0,0.2,1)` }}>
            {step === 0 && (
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 pl-1">你的昵称</p>
                  <GlowInput value={name} onChange={setName} placeholder="输入你的昵称" accent={accent} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 pl-1">性别</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['female', 'male'] as Gender[]).map(g => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        className="py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
                        style={{
                          border: `2px solid ${gender === g ? accent : '#E5E7EB'}`,
                          background: gender === g ? `${accent}15` : 'transparent',
                          color: gender === g ? accent : 'var(--muted-foreground)',
                        }}
                      >
                        {g === 'female' ? '女生' : '男生'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: '年龄', value: age, onChange: setAge, placeholder: '25', unit: '岁' },
                    { label: '身高', value: height, onChange: setHeight, placeholder: '165', unit: 'cm' },
                    { label: '体重', value: weight, onChange: setWeight, placeholder: '55', unit: 'kg' },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs text-muted-foreground mb-1.5 pl-1">{f.label}</p>
                      <GlowInput type="number" value={f.value} onChange={f.onChange} placeholder={f.placeholder} unit={f.unit} accent={accent} />
                    </div>
                  ))}
                </div>
                {bmi > 0 && (
                  <div
                    className="rounded-2xl px-4 py-3 flex items-center justify-between"
                    style={{ background: `${accent}12`, border: `1.5px solid ${accent}30` }}
                  >
                    <span className="text-xs text-muted-foreground">BMI 指数</span>
                    <span className="text-lg font-black" style={{ color: accent }}>{bmi}</span>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="p-6 space-y-3">
                {GOAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGoal(opt.value)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer"
                    style={{
                      border: `2px solid ${goal === opt.value ? accent : '#E5E7EB'}`,
                      background: goal === opt.value ? `${accent}10` : 'transparent',
                    }}
                  >
                    <span className="text-xl">{GOAL_ICON[opt.icon]}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    {goal === opt.value && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent }}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 pl-1 flex items-center gap-1.5">
                    <Activity className="w-3 h-3" /> 活动水平
                  </p>
                  <div className="space-y-1.5">
                    {ACTIVITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setActivityLevel(opt.value)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer"
                        style={{
                          border: `1.5px solid ${activityLevel === opt.value ? accent : '#E5E7EB'}`,
                          background: activityLevel === opt.value ? `${accent}10` : 'transparent',
                        }}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all"
                          style={{
                            borderColor: activityLevel === opt.value ? accent : '#D1D5DB',
                            backgroundColor: activityLevel === opt.value ? accent : 'transparent',
                          }}
                        />
                        <span className="text-sm font-medium text-foreground">{opt.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {targetCalories > 0 && (
                  <div
                    className="rounded-2xl px-4 py-3 flex items-center justify-between"
                    style={{ background: `${accent}12`, border: `1.5px solid ${accent}30` }}
                  >
                    <span className="text-xs text-muted-foreground">每日目标热量</span>
                    <span className="text-lg font-black" style={{ color: accent }}>
                      {targetCalories} <span className="text-xs font-normal">kcal</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="px-6 pb-6 flex gap-2.5">
              {step > 0 && (
                <button
                  onClick={goPrev}
                  disabled={submitting}
                  className="px-5 py-3.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-border/30 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                >
                  返回
                </button>
              )}
              {step < 2 ? (
                <button
                  onClick={goNext}
                  disabled={step === 0 ? !canNext0 : !canNext1}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96]"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 6px 20px ${accent}40` }}
                >
                  下一步
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={!canNext0 || !canNext1 || submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96]"
                  style={{ background: 'linear-gradient(135deg, #F97316, #EC4899)', boxShadow: '0 6px 20px rgba(249,115,22,0.4)' }}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 创建中...</>
                  ) : '立即开启健康记录'}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          已有账号？
          <button onClick={() => navigate('/login')} className="ml-1 font-semibold cursor-pointer" style={{ color: '#F97316' }}>
            返回登录
          </button>
        </p>
      </div>

      <style>{`
        @keyframes registerHeroIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes registerSlideInRight {
          from { opacity: 0; transform: translateX(32px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes registerSlideInLeft {
          from { opacity: 0; transform: translateX(-32px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes registerFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes dotFloat {
          0% { transform: translateY(0) scale(0.8); opacity: 0.5; }
          100% { transform: translateY(-110vh) scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function FloatingDots({ accent }: { accent: string }) {
  const dots = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    size: 4 + (i * 5 % 10),
    x: (i * 19 + 3) % 100,
    delay: (i * 0.47) % 5,
    duration: 5 + (i * 0.39) % 4,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {dots.map(d => (
        <div
          key={d.id}
          className="absolute rounded-full"
          style={{
            width: d.size,
            height: d.size,
            left: `${d.x}%`,
            bottom: '-20px',
            backgroundColor: accent + '55',
            animation: `dotFloat ${d.duration}s ease-in ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
