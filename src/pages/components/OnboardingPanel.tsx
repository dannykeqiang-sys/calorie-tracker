import { useState, useMemo } from 'react';
import { Activity, ChevronRight, Check } from 'lucide-react';
import { saveProfile } from '../../utils/storage';
import type { UserProfile, Gender, GoalType, ActivityLevel } from '../../types';

interface OnboardingPanelProps {
  onComplete: (profile: UserProfile, apiKey: string) => void;
}

const GOAL_OPTIONS: { value: GoalType; label: string; desc: string; emoji: string }[] = [
  { value: 'lose', label: '减脂塑形', desc: '控制热量，打造好身材', emoji: '🔥' },
  { value: 'maintain', label: '维持体重', desc: '保持现有状态，健康生活', emoji: '⚖️' },
  { value: 'gain', label: '增肌增重', desc: '增加热量摄入，强化体魄', emoji: '💪' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: '久坐不动', desc: '几乎不运动' },
  { value: 'light', label: '轻度活跃', desc: '每周1-3次运动' },
  { value: 'moderate', label: '中度活跃', desc: '每周3-5次运动' },
  { value: 'active', label: '高度活跃', desc: '每周6-7次运动' },
  { value: 'very_active', label: '超高强度', desc: '每天高强度运动' },
];

const STEP_BG = [
  'linear-gradient(160deg, #FFF8F5 0%, #FFF0FA 100%)',
  'linear-gradient(160deg, #F0F8FF 0%, #F5F2FF 100%)',
  'linear-gradient(160deg, #F0FDF8 0%, #F5FAF0 100%)',
];

const STEP_COLOR = ['#F97316', '#7CB9E8', '#A3B899'];

const STEP_HERO = [
  { emoji: '👋', title: '嗨，先告诉我你的名字吧', sub: '我会用它来叫你，让一切更亲切' },
  { emoji: '📐', title: '每个身体都值得被好好了解', sub: '这些数据帮我为你计算专属目标' },
  { emoji: '🎯', title: '你想达成什么目标？', sub: '我会为你量身定制每日热量计划' },
];

const AF: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

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

function calcBMI(w: number, h: number): number {
  return Math.round((w / ((h / 100) ** 2)) * 10) / 10;
}

function GlowInput({
  type = 'text', value, onChange, placeholder, unit, accent,
}: {
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; unit?: string; accent: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.trim().length > 0;
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-4 py-3.5 rounded-2xl border bg-white/80 text-foreground text-sm transition-all outline-none"
        style={{
          borderColor: focused ? accent : '#E5E7EB',
          boxShadow: focused ? `0 0 0 3px ${accent}22, 0 2px 8px ${accent}18` : '0 1px 3px rgba(0,0,0,0.06)',
          paddingRight: unit ? '3rem' : undefined,
        }}
      />
      {unit && <span className="absolute right-3 top-3.5 text-xs text-muted-foreground">{unit}</span>}
      {filled && !focused && (
        <span
          className="absolute right-3 top-3.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accent}20` }}
        >
          <Check className="w-3 h-3" style={{ color: accent }} />
        </span>
      )}
    </div>
  );
}

const PARTICLE_COLORS = ['#F97316', '#7CB9E8', '#A3B899', '#C084FC', '#F9A8D4', '#FCD34D'];

export default function OnboardingPanel({ onComplete }: OnboardingPanelProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [flash, setFlash] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');

  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    size: 5 + (i * 7 % 11),
    x: (i * 13 + 7) % 100,
    delay: (i * 0.43) % 5,
    duration: 4 + (i * 0.37) % 4,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  })), []);

  const partial: Partial<UserProfile> = {
    gender, age: Number(age) || 0, height: Number(height) || 0,
    weight: Number(weight) || 0, goal, activityLevel,
  };
  const targetCalories = calcTarget(partial);
  const bmi = height && weight ? calcBMI(Number(weight), Number(height)) : 0;
  const canNext0 = name.trim().length > 0;
  const canNext1 = Number(age) >= 10 && Number(age) <= 120 && Number(height) >= 100 && Number(height) <= 250 && Number(weight) >= 20 && Number(weight) <= 300;
  const canFinish = canNext0 && canNext1;

  const accent = STEP_COLOR[step];
  const hero = STEP_HERO[step];

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 450);
  };

  const goNext = () => {
    triggerFlash();
    setDirection(1);
    setStep(s => s + 1);
  };

  const goPrev = () => {
    triggerFlash();
    setDirection(-1);
    setStep(s => s - 1);
  };

  const handleComplete = () => {
    if (!canFinish) return;
    const profile: UserProfile = {
      name: name.trim(), gender, age: Number(age), height: Number(height),
      weight: Number(weight), goal, activityLevel,
    };
    saveProfile(profile);
    onComplete(profile, '');
  };

  const slideAnim = direction === 1 ? 'onboardSlideInRight' : 'onboardSlideInLeft';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto transition-all duration-500"
      style={{ background: STEP_BG[step] }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              bottom: '-30px',
              backgroundColor: p.color + '55',
              animation: `particleFloat ${p.duration}s ease-in ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative min-h-full flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-sm">
          <div
            key={`hero-${step}`}
            className="text-center mb-6"
            style={{ animation: `heroPopIn 0.55s cubic-bezier(0.34,1.56,0.64,1)` }}
          >
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}44)` }}
            >
              {hero.emoji}
            </div>
            <h1
              className="text-xl font-black text-foreground mb-1"
              style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
            >
              {hero.title}
            </h1>
            <p className="text-xs text-muted-foreground">{hero.sub}</p>
          </div>

          <div className="flex items-center justify-center gap-1.5 mb-5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: i === step ? '28px' : '8px',
                  backgroundColor: i <= step ? accent : '#E5E7EB',
                }}
              />
            ))}
          </div>

          <div
            className="rounded-3xl shadow-sm border border-white/60 relative overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)' }}
          >
            {flash && (
              <div
                className="absolute inset-0 z-10 pointer-events-none rounded-3xl"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${accent}50, transparent 70%)`,
                  animation: 'onboardFlash 0.45s ease-out forwards',
                }}
              />
            )}

            <div
              key={`step-${step}`}
              style={{ animation: `${slideAnim} 0.38s cubic-bezier(0.4,0,0.2,1)` }}
            >
              {step === 0 && (
                <div className="p-6 space-y-4">
                  <GlowInput
                    value={name}
                    onChange={setName}
                    placeholder="输入你的昵称，比如：小梅"
                    accent={accent}
                  />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 pl-1">你的性别</p>
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
                          {g === 'female' ? '女生 ♀' : '男生 ♂'}
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
                      <span className="text-xs text-muted-foreground">你的 BMI 指数</span>
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
                      <span className="text-xl">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
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

                  <div className="pt-1">
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
                      <span className="text-xs text-muted-foreground">你的每日目标热量</span>
                      <span className="text-lg font-black" style={{ color: accent }}>{targetCalories} <span className="text-xs font-normal">kcal</span></span>
                    </div>
                  )}
                </div>
              )}

              <div className="px-6 pb-6 flex gap-2.5">
                {step > 0 && (
                  <button
                    onClick={goPrev}
                    className="px-5 py-3.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-border/30 transition-all cursor-pointer active:scale-95"
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
                    disabled={!canFinish}
                    className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96]"
                    style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9E8)', boxShadow: '0 6px 20px rgba(163,184,153,0.5)' }}
                  >
                    立即加入，遇见更好的自己
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes particleFloat {
          0% { transform: translateY(0) scale(0.8); opacity: 0.7; }
          70% { opacity: 0.5; }
          100% { transform: translateY(-105vh) scale(1.3); opacity: 0; }
        }
        @keyframes heroPopIn {
          from { opacity: 0; transform: translateY(-18px) scale(0.88); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes onboardSlideInRight {
          from { opacity: 0; transform: translateX(36px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes onboardSlideInLeft {
          from { opacity: 0; transform: translateX(-36px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes onboardFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
