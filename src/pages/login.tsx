import { useState, useRef, forwardRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, UserX, RefreshCw, KeyRound, Activity, ChevronRight, Check, X, FileText, Sparkles } from 'lucide-react';
import { loginViaApi, findProfileViaGithub, syncProfileToCloud } from '../utils/apiDB';
import { setSession, setApiToken } from '../utils/auth';
import { saveProfile } from '../utils/storage';
import VideoIntro, { VIDEO_URL } from './components/VideoIntro';
import { installDemoData, leaveDemoMode } from '../utils/demoData';
import type { UserProfile, Gender, GoalType, ActivityLevel } from '../types';
import { AppMark } from '@/components/AppIcon';

// ─── 常量 ────────────────────────────────────────────────

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

const GOAL_ICON: Record<string, string> = { lose: '🔥', maintain: '⚖️', gain: '💪' };

const REG_ACCENT = ['#6366F1', '#10B981'];
const REG_BG = [
  'linear-gradient(160deg, #F0F4FF 0%, #F5F2FF 100%)',
  'linear-gradient(160deg, #F0FDF8 0%, #F0F9FF 100%)',
];

// ─── 工具函数 ──────────────────────────────────────────────

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

// ─── 类型 ────────────────────────────────────────────────

type PageMode = 'login' | 'register';
type PageState = 'idle' | 'loading' | 'not-found' | 'error';

// ─── 主组件 ──────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [state, setState] = useState<PageState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [showOutro, setShowOutro] = useState(false);
  const [outroLeaving, setOutroLeaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // 注册相关 state
  const [mode, setMode] = useState<PageMode>('login');
  const [regStep, setRegStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [flash, setFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gender, setGender] = useState<Gender>('female');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<GoalType>('maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const trimmed = name.trim();
  const trimmedCode = inviteCode.trim();
  const canSubmit = trimmed.length > 0 && trimmedCode.length > 0 && state !== 'loading';

  // 注册表单计算
  const partial: Partial<UserProfile> = useMemo(() => ({
    gender, age: Number(age) || 0, height: Number(height) || 0,
    weight: Number(weight) || 0, goal, activityLevel,
  }), [gender, age, height, weight, goal, activityLevel]);

  const targetCalories = calcTarget(partial);
  const bmi = height && weight ? Math.round((Number(weight) / ((Number(height) / 100) ** 2)) * 10) / 10 : 0;

  const canNext0 = Number(age) >= 10 && Number(age) <= 120
    && Number(height) >= 100 && Number(height) <= 250
    && Number(weight) >= 20 && Number(weight) <= 300;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setState('loading');
    setErrorMsg('');

    try {
      // 通道 1：后端 API 登录（昵称 + 邀请码）
      const apiResult = await loginViaApi(trimmed, trimmedCode);
      if (apiResult) {
        leaveDemoMode();
        setApiToken(apiResult.token);
        // 保留已有的 workid（兼容 GitHub 通道数据），没有才用 api_ 前缀
        const existingWorkid = localStorage.getItem('calorie_workid');
        const workid = existingWorkid || `api_${apiResult.user.id}`;
        setSession(workid, trimmed);
        localStorage.setItem('calorie_workid', workid);
        setShowOutro(true);
        return;
      }

      // 通道 2：API 失败，尝试 GitHub 降级（仅用昵称查找已有用户）
      const ghResult = await findProfileViaGithub(trimmed);
      if (ghResult) {
        leaveDemoMode();
        setSession(ghResult.workid, trimmed);
        localStorage.setItem('calorie_workid', ghResult.workid);
        saveProfile(ghResult.profile);
        setShowOutro(true);
        return;
      }

      // 两个通道都没找到 → 提示未注册
      setState('not-found');
    } catch {
      setState('error');
      setErrorMsg('网络异常，请稍后重试');
    }
  };

  const handleOutroEnd = useCallback(() => {
    setOutroLeaving(true);
    setTimeout(() => {
      navigate('/');
    }, 800);
  }, [navigate]);

  const handleDemoEntry = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      await installDemoData({ replayTutorial: true });
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setShowOutro(true);
      } else {
        navigate('/');
      }
    } finally {
      setDemoLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleSwitchToRegister = () => {
    setMode('register');
    setRegStep(0);
    setDirection(1);
  };

  const handleSwitchToLogin = () => {
    setMode('login');
    setState('idle');
    setErrorMsg('');
  };

  const handleReset = () => {
    setName('');
    setInviteCode('');
    setState('idle');
    setErrorMsg('');
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const triggerFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 450); };
  const goNext = () => { triggerFlash(); setDirection(1); setRegStep(s => s + 1); };
  const goPrev = () => { triggerFlash(); setDirection(-1); setRegStep(s => s - 1); };

  const handleRegisterComplete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 调用 login API 创建用户（服务端自动创建）
      const apiResult = await loginViaApi(trimmed, trimmedCode);
      if (apiResult) {
        leaveDemoMode();
        setApiToken(apiResult.token);
        const workid = `api_${apiResult.user.id}`;
        localStorage.setItem('calorie_workid', workid);
        setSession(workid, trimmed);
      } else {
        leaveDemoMode();
        // API 失败，降级到本地存储
        const workid = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('calorie_workid', workid);
        setSession(workid, trimmed);
      }

      // 保存 profile
      const profile: UserProfile = {
        name: trimmed, gender,
        age: Number(age), height: Number(height), weight: Number(weight),
        goal, activityLevel,
      };
      saveProfile(profile);
      await syncProfileToCloud(profile).catch(() => {});

      // 播放 outro → 跳转首页
      setShowOutro(true);
    } catch {
      setState('error');
      setErrorMsg('注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 背景样式
  const bgStyle = mode === 'register'
    ? REG_BG[regStep]
    : 'linear-gradient(160deg, #FFF8F5 0%, #FFF0FA 60%, #F0F4FF 100%)';

  const slideAnim = direction === 1 ? 'registerSlideInRight' : 'registerSlideInLeft';

  return (
    <>
      <video src={VIDEO_URL} preload="auto" muted playsInline style={{ display: 'none' }} />

      {showOutro && (
        <VideoIntro onEnd={handleOutroEnd} leaving={outroLeaving} />
      )}

      <div
        className="fixed inset-0 overflow-auto flex items-center justify-center p-4 transition-all duration-500"
        style={{
          background: bgStyle,
          opacity: showOutro ? 0 : 1,
          transform: showOutro ? 'scale(1.04)' : 'scale(1)',
          transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1), background 0.5s ease',
          pointerEvents: showOutro ? 'none' : 'auto',
        }}
      >
        {mode === 'login' ? <FloatingParticles /> : <FloatingDots accent={REG_ACCENT[regStep]} />}

        <div className="relative w-full max-w-sm">
          {/* Logo + 标题 */}
          <div
            className="text-center mb-8"
            style={{ animation: 'loginPopIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <AppMark size={80} className="mx-auto mb-5" />
            <h1
              className="text-2xl font-black text-foreground mb-1"
              style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
            >
              燃烧我的卡路里
            </h1>
            <p className="text-sm text-muted-foreground">科学记录，遇见更好的自己</p>
          </div>

          {/* 步骤指示器（仅注册模式） */}
          {mode === 'register' && (
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: i === regStep ? '28px' : '8px',
                    backgroundColor: i <= regStep ? REG_ACCENT[regStep] : '#E5E7EB',
                  }}
                />
              ))}
            </div>
          )}

          {/* 主卡片 */}
          <div
            className="rounded-3xl p-6 shadow-sm relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.7)',
              animation: 'loginSlideUp 0.5s cubic-bezier(0.4,0,0.2,1) 0.1s both',
            }}
          >
            {/* 注册模式下的用户信息摘要 */}
            {mode === 'register' && (
              <div
                className="mb-4 pb-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div>
                  <p className="text-xs text-muted-foreground">昵称</p>
                  <p className="text-sm font-semibold text-foreground">{trimmed}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">邀请码</p>
                  <p className="text-sm font-semibold text-foreground">
                    {trimmedCode.length > 8 ? trimmedCode.slice(0, 8) + '...' : trimmedCode}
                  </p>
                </div>
              </div>
            )}

            {/* 登录模式 */}
            {mode === 'login' && (
              <>
                {state !== 'not-found' ? (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 pl-1">你的昵称</p>
                    <NameInput
                      ref={nameRef}
                      value={name}
                      onChange={v => { setName(v); if (state === 'error') setState('idle'); }}
                      onKeyDown={handleKeyDown}
                      disabled={state === 'loading'}
                      placeholder="输入你的昵称，比如：小梅"
                    />

                    <div className="flex items-center justify-between mb-2 pl-1 mt-3">
                      <p className="text-xs font-semibold text-muted-foreground">邀请码</p>
                      <button
                        onClick={() => { setInviteCode('5583F66676AABD5A'); codeRef.current?.focus(); }}
                        disabled={state === 'loading'}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                        style={{
                          background: 'rgba(249,115,22,0.1)',
                          color: '#F97316',
                          border: '1px solid rgba(249,115,22,0.2)',
                        }}
                      >
                        🔑 一键填写测试码
                      </button>
                    </div>
                    <CodeInput
                      ref={codeRef}
                      value={inviteCode}
                      onChange={v => { setInviteCode(v); if (state === 'error') setState('idle'); }}
                      onKeyDown={handleKeyDown}
                      disabled={state === 'loading'}
                    />

                    {state === 'error' && (
                      <p className="mt-2 text-xs text-red-500 pl-1">{errorMsg}</p>
                    )}

                    <button
                      onClick={handleLogin}
                      disabled={!canSubmit}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        background: canSubmit ? 'linear-gradient(135deg, #F97316, #EC4899)' : '#E5E7EB',
                        boxShadow: canSubmit ? '0 8px 24px rgba(249,115,22,0.35)' : 'none',
                      }}
                    >
                      {state === 'loading' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          登录中...
                        </>
                      ) : (
                        <>
                          开始记录
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-3 my-4">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[11px] text-muted-foreground/50">或者</span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>

                    <button
                      onClick={handleDemoEntry}
                      disabled={demoLoading || state === 'loading'}
                      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(249,115,22,0.13))',
                        border: '1.5px solid rgba(139,92,246,0.22)',
                        boxShadow: '0 8px 28px rgba(139,92,246,0.10)',
                      }}
                    >
                      {demoLoading ? <Loader2 className="w-5 h-5 animate-spin text-violet-500" /> : <Sparkles className="w-5 h-5 text-violet-500" />}
                      <span className="text-left leading-tight">
                        <span className="block text-sm font-bold text-foreground">体验演示</span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">无需注册</span>
                      </span>
                    </button>

                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      第一次来？
                      <button
                        onClick={() => trimmed ? handleSwitchToRegister() : nameRef.current?.focus()}
                        className="ml-1 font-semibold cursor-pointer"
                        style={{ color: '#F97316' }}
                      >
                        创建健康档案
                      </button>
                    </p>

                    <p className="mt-3 text-center text-xs text-muted-foreground/70">
                      登录即代表同意
                      <button
                        onClick={() => setShowAgreement(true)}
                        className="ml-1 font-semibold cursor-pointer hover:underline"
                        style={{ color: '#F97316' }}
                      >
                        《用户协议》
                      </button>
                    </p>
                  </>
                ) : (
                  <NotFoundView
                    name={trimmed}
                    onRegister={handleSwitchToRegister}
                    onReset={handleReset}
                  />
                )}
              </>
            )}

            {/* 注册模式 */}
            {mode === 'register' && (
              <>
                {flash && (
                  <div
                    className="absolute inset-0 z-10 pointer-events-none rounded-3xl"
                    style={{
                      background: `radial-gradient(circle at 50% 20%, ${REG_ACCENT[regStep]}44, transparent 70%)`,
                      animation: 'registerFlash 0.45s ease-out forwards',
                    }}
                  />
                )}

                <div key={`step-${regStep}`} style={{ animation: `${slideAnim} 0.35s cubic-bezier(0.4,0,0.2,1)` }}>
                  {/* 步骤 0：基本信息 */}
                  {regStep === 0 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2 pl-1">性别</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          {(['female', 'male'] as Gender[]).map(g => (
                            <button
                              key={g}
                              onClick={() => setGender(g)}
                              className="py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
                              style={{
                                border: `2px solid ${gender === g ? REG_ACCENT[0] : '#E5E7EB'}`,
                                background: gender === g ? `${REG_ACCENT[0]}15` : 'transparent',
                                color: gender === g ? REG_ACCENT[0] : 'var(--muted-foreground)',
                              }}
                            >
                              {g === 'female' ? '女生' : '男生'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { label: '年龄', value: age, onChange: setAge, placeholder: '25', unit: '岁' },
                          { label: '身高', value: height, onChange: setHeight, placeholder: '165', unit: 'cm' },
                          { label: '体重', value: weight, onChange: setWeight, placeholder: '55', unit: 'kg' },
                        ].map(f => (
                          <div key={f.label}>
                            <p className="text-xs text-muted-foreground mb-1.5 pl-1">{f.label}</p>
                            <GlowInput
                              type="number"
                              value={f.value}
                              onChange={f.onChange}
                              placeholder={f.placeholder}
                              unit={f.unit}
                              accent={REG_ACCENT[0]}
                            />
                          </div>
                        ))}
                      </div>

                      {bmi > 0 && (
                        <div
                          className="rounded-2xl px-4 py-3 flex items-center justify-between"
                          style={{ background: `${REG_ACCENT[0]}12`, border: `1.5px solid ${REG_ACCENT[0]}30` }}
                        >
                          <span className="text-xs text-muted-foreground">BMI 指数</span>
                          <span className="text-lg font-black" style={{ color: REG_ACCENT[0] }}>{bmi}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 步骤 1：目标 + 运动频率 */}
                  {regStep === 1 && (
                    <div className="space-y-3">
                      {GOAL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setGoal(opt.value)}
                          className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer"
                          style={{
                            border: `2px solid ${goal === opt.value ? REG_ACCENT[1] : '#E5E7EB'}`,
                            background: goal === opt.value ? `${REG_ACCENT[1]}10` : 'transparent',
                          }}
                        >
                          <span className="text-xl">{GOAL_ICON[opt.icon]}</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                          {goal === opt.value && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: REG_ACCENT[1] }}
                            >
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
                                border: `1.5px solid ${activityLevel === opt.value ? REG_ACCENT[1] : '#E5E7EB'}`,
                                background: activityLevel === opt.value ? `${REG_ACCENT[1]}10` : 'transparent',
                              }}
                            >
                              <div
                                className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all"
                                style={{
                                  borderColor: activityLevel === opt.value ? REG_ACCENT[1] : '#D1D5DB',
                                  backgroundColor: activityLevel === opt.value ? REG_ACCENT[1] : 'transparent',
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
                          style={{ background: `${REG_ACCENT[1]}12`, border: `1.5px solid ${REG_ACCENT[1]}30` }}
                        >
                          <span className="text-xs text-muted-foreground">每日目标热量</span>
                          <span className="text-lg font-black" style={{ color: REG_ACCENT[1] }}>
                            {targetCalories} <span className="text-xs font-normal">kcal</span>
                          </span>
                        </div>
                      )}

                      {/* 用户协议勾选 */}
                      <div className="flex items-start gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setAgreedToTerms(!agreedToTerms)}
                          className="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer"
                          style={{
                            borderColor: agreedToTerms ? REG_ACCENT[1] : '#D1D5DB',
                            backgroundColor: agreedToTerms ? REG_ACCENT[1] : 'transparent',
                          }}
                        >
                          {agreedToTerms && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          我已阅读并同意
                          <button
                            type="button"
                            onClick={() => setShowAgreement(true)}
                            className="mx-1 font-semibold cursor-pointer hover:underline"
                            style={{ color: REG_ACCENT[1] }}
                          >
                            《用户协议》
                          </button>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 注册模式底部按钮 */}
                <div className="flex gap-2.5 mt-4">
                  {regStep > 0 && (
                    <button
                      onClick={goPrev}
                      disabled={submitting}
                      className="px-5 py-3.5 rounded-2xl border border-border text-sm text-muted-foreground hover:bg-border/30 transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                    >
                      返回
                    </button>
                  )}
                  {regStep < 1 ? (
                    <button
                      onClick={goNext}
                      disabled={!canNext0}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96]"
                      style={{
                        background: `linear-gradient(135deg, ${REG_ACCENT[0]}, ${REG_ACCENT[0]}cc)`,
                        boxShadow: `0 6px 20px ${REG_ACCENT[0]}40`,
                      }}
                    >
                      下一步
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleRegisterComplete}
                      disabled={!canNext0 || submitting || !agreedToTerms}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.96]"
                      style={{
                        background: (!canNext0 || submitting || !agreedToTerms) ? '#E5E7EB' : 'linear-gradient(135deg, #F97316, #EC4899)',
                        boxShadow: (!canNext0 || submitting || !agreedToTerms) ? 'none' : '0 6px 20px rgba(249,115,22,0.4)',
                      }}
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> 创建中...</>
                      ) : '立即开启健康记录'}
                    </button>
                  )}
                </div>

                {/* 返回登录 */}
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  已有账号？
                  <button
                    onClick={handleSwitchToLogin}
                    className="ml-1 font-semibold cursor-pointer"
                    style={{ color: '#F97316' }}
                  >
                    返回登录
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        <style>{`
          @keyframes loginPopIn {
            from { opacity: 0; transform: translateY(-20px) scale(0.88); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes loginSlideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes particleFloat {
            0% { transform: translateY(0) scale(0.8); opacity: 0.6; }
            100% { transform: translateY(-110vh) scale(1.4); opacity: 0; }
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

        {/* 用户协议弹窗 */}
        {showAgreement && (
          <UserAgreementModal onClose={() => setShowAgreement(false)} />
        )}
      </div>
    </>
  );
}

// ─── 用户协议弹窗 ──────────────────────────────────────────────

function UserAgreementModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md max-h-[85vh] rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(20px)',
          animation: 'loginSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: '#F97316' }} />
            <h2 className="text-lg font-bold text-foreground">用户协议</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm text-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">最后更新：2026年6月30日</p>

          <section>
            <h3 className="font-bold text-base mb-2">一、服务说明</h3>
            <p className="text-muted-foreground">
              欢迎使用"燃烧我的卡路里"（以下简称"本应用"）。本应用是一款个人健康记录工具，帮助您记录饮食、运动和身体数据，以便更好地管理健康。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">二、数据隐私</h3>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>您的健康数据（饮食记录、运动记录、身体指标等）仅存储在您的浏览器本地存储中</li>
              <li>API Key 仅保存在您的浏览器中，不会上传到云端服务器</li>
              <li>我们不会收集、出售或共享您的个人健康数据</li>
              <li>您可以随时导出或删除您的所有数据</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">三、AI 功能说明</h3>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>本应用使用第三方 AI 服务（如 DeepSeek）提供智能分析和建议</li>
              <li>AI 生成的内容仅供参考，不构成医疗建议</li>
              <li>如有健康问题，请咨询专业医疗机构或医生</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">四、用户责任</h3>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>请确保输入的数据真实准确</li>
              <li>妥善保管您的邀请码，不要分享给他人</li>
              <li>定期备份您的数据，防止意外丢失</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">五、免责声明</h3>
            <p className="text-muted-foreground">
              本应用提供的健康建议和分析仅供参考，不能替代专业医疗建议。使用本应用前，请咨询医生或其他医疗专业人员。对于因使用本应用而产生的任何直接或间接损失，我们不承担责任。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">六、协议变更</h3>
            <p className="text-muted-foreground">
              我们保留随时修改本协议的权利。协议变更后，继续使用本应用即表示您同意新的协议条款。
            </p>
          </section>

          <section className="pt-4 border-t border-gray-100">
            <p className="text-xs text-muted-foreground text-center">
              如有疑问，请联系应用开发者
            </p>
          </section>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white cursor-pointer active:scale-[0.97] transition-all"
            style={{
              background: 'linear-gradient(135deg, #F97316, #EC4899)',
              boxShadow: '0 6px 20px rgba(249,115,22,0.35)',
            }}
          >
            我已阅读
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 子组件 ──────────────────────────────────────────────

interface NameInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
}

const NameInput = forwardRef<HTMLInputElement, NameInputProps>(
  ({ value, onChange, onKeyDown, disabled, placeholder }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <input
        ref={ref}
        autoFocus
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={20}
        className="w-full px-4 py-3.5 rounded-2xl border bg-white/80 text-foreground text-sm outline-none transition-all disabled:opacity-50"
        style={{
          borderColor: focused ? '#F97316' : '#E5E7EB',
          boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.15), 0 2px 8px rgba(249,115,22,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      />
    );
  }
);

interface CodeInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(
  ({ value, onChange, onKeyDown, disabled }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <div className="relative">
        <KeyRound
          className="absolute left-3 top-3.5 w-4 h-4 pointer-events-none"
          style={{ color: focused ? '#F97316' : '#9CA3AF' }}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="输入邀请码"
          disabled={disabled}
          maxLength={32}
          className="w-full pl-9 pr-4 py-3.5 rounded-2xl border bg-white/80 text-foreground text-sm outline-none transition-all disabled:opacity-50"
          style={{
            borderColor: focused ? '#F97316' : '#E5E7EB',
            boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.15), 0 2px 8px rgba(249,115,22,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        />
      </div>
    );
  }
);

function NotFoundView({ name, onRegister, onReset }: { name: string; onRegister: () => void; onReset: () => void }) {
  return (
    <div className="text-center space-y-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
        style={{ background: '#FFF3E0' }}
      >
        <UserX className="w-7 h-7" style={{ color: '#F97316' }} />
      </div>
      <div>
        <p className="font-bold text-foreground text-base">「{name}」还未注册</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          这个昵称还没有健康档案<br />创建一个，开始你的健康记录
        </p>
      </div>
      <button
        onClick={onRegister}
        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white cursor-pointer active:scale-[0.97] transition-all"
        style={{
          background: 'linear-gradient(135deg, #F97316, #EC4899)',
          boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
        }}
      >
        创建健康档案
      </button>
      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm text-muted-foreground cursor-pointer hover:bg-gray-50 transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        重新输入
      </button>
    </div>
  );
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

const PARTICLE_COLORS = ['#F97316', '#EC4899', '#7C3AED', '#0EA5E9', '#22C55E', '#F59E0B'];

function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 5 + (i * 7 % 12),
    x: (i * 17 + 5) % 100,
    delay: (i * 0.51) % 6,
    duration: 5 + (i * 0.41) % 4,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            bottom: '-20px',
            backgroundColor: p.color + '44',
            animation: `particleFloat ${p.duration}s ease-in ${p.delay}s infinite`,
          }}
        />
      ))}
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
