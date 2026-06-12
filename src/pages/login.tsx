import { useState, useRef, forwardRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowRight, Loader2, UserX, RefreshCw, Key } from 'lucide-react';
import { findProfileByName, hasGithubToken, setGithubToken } from '../utils/githubDB';
import { setSession } from '../utils/auth';
import { saveProfile } from '../utils/storage';
import VideoIntro, { VIDEO_URL } from './components/VideoIntro';

type PageState = 'idle' | 'loading' | 'not-found' | 'error';

const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

export default function LoginPage() {
  const navigate = useNavigate();
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenSetup, setShowTokenSetup] = useState(!hasGithubToken());
  const [name, setName] = useState('');
  const [state, setState] = useState<PageState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showOutro, setShowOutro] = useState(false);
  const [outroLeaving, setOutroLeaving] = useState(false);

  const handleTokenSave = () => {
    const t = tokenInput.trim();
    if (!t) return;
    setGithubToken(t);
    setShowTokenSetup(false);
  };

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && state !== 'loading';

  const handleLogin = async () => {
    if (!canSubmit) return;
    setState('loading');
    setErrorMsg('');
    try {
      const result = await findProfileByName(trimmed);
      if (result) {
        setSession(result.workid, trimmed);
        localStorage.setItem('calorie_workid', result.workid);
        saveProfile(result.profile);
        if (isDesktop) {
          setShowOutro(true);
        } else {
          navigate('/');
        }
      } else {
        setState('not-found');
      }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleRegister = () => {
    navigate(`/register?name=${encodeURIComponent(trimmed)}`);
  };

  const handleReset = () => {
    setName('');
    setState('idle');
    setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <>
      <video src={VIDEO_URL} preload="auto" muted playsInline style={{ display: 'none' }} />

      {showTokenSetup && (
        <div
          className="fixed inset-0 overflow-auto flex items-center justify-center p-4"
          style={{ background: 'linear-gradient(160deg, #F0F4FF 0%, #F5F2FF 60%, #FFF8F5 100%)' }}
        >
          <div className="relative w-full max-w-sm">
            <div className="text-center mb-8" style={{ animation: 'loginPopIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              >
                <Key className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-black text-foreground mb-1" style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>
                配置 GitHub Token
              </h1>
              <p className="text-sm text-muted-foreground">数据将存储在你的 GitHub 仓库中</p>
            </div>
            <div
              className="rounded-3xl p-6 shadow-sm"
              style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.7)', animation: 'loginSlideUp 0.5s cubic-bezier(0.4,0,0.2,1) 0.1s both' }}
            >
              <p className="text-xs font-semibold text-muted-foreground mb-2 pl-1">Personal Access Token</p>
              <input
                autoFocus
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="ghp_..."
                onKeyDown={e => { if (e.key === 'Enter') handleTokenSave(); }}
                className="w-full px-4 py-3.5 rounded-2xl border bg-white/80 text-foreground text-sm outline-none transition-all"
                style={{
                  borderColor: tokenInput ? '#6366F1' : '#E5E7EB',
                  boxShadow: tokenInput ? '0 0 0 3px rgba(99,102,241,0.15), 0 2px 8px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                需要 <b>public_repo</b> 权限，Token 仅保存在你的浏览器本地。
              </p>
              <button
                onClick={handleTokenSave}
                disabled={!tokenInput.trim()}
                className="mt-4 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: tokenInput.trim() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#E5E7EB',
                  boxShadow: tokenInput.trim() ? '0 8px 24px rgba(99,102,241,0.35)' : 'none',
                }}
              >
                确认配置
                <ArrowRight className="w-4 h-4" />
              </button>
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
          `}</style>
        </div>
      )}

      {showOutro && (
        <VideoIntro onEnd={handleOutroEnd} leaving={outroLeaving} />
      )}

      {!showTokenSetup && (
      <div
        className="fixed inset-0 overflow-auto flex items-center justify-center p-4"
        style={{
          background: 'linear-gradient(160deg, #FFF8F5 0%, #FFF0FA 60%, #F0F4FF 100%)',
          opacity: showOutro ? 0 : 1,
          transform: showOutro ? 'scale(1.04)' : 'scale(1)',
          transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: showOutro ? 'none' : 'auto',
        }}
      >
        <FloatingParticles />

        <div className="relative w-full max-w-sm">
          <div
            className="text-center mb-8"
            style={{ animation: 'loginPopIn 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F97316, #EC4899)' }}
            >
              <Flame className="w-10 h-10 text-white" />
            </div>
            <h1
              className="text-2xl font-black text-foreground mb-1"
              style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
            >
              燃烧我的卡路里
            </h1>
            <p className="text-sm text-muted-foreground">科学记录，遇见更好的自己</p>
          </div>

          <div
            className="rounded-3xl p-6 shadow-sm"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.7)',
              animation: 'loginSlideUp 0.5s cubic-bezier(0.4,0,0.2,1) 0.1s both',
            }}
          >
            {state !== 'not-found' ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground mb-2 pl-1">你的昵称</p>
                <NameInput
                  ref={inputRef}
                  value={name}
                  onChange={v => { setName(v); if (state === 'error') setState('idle'); }}
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
                      查找中...
                    </>
                  ) : (
                    <>
                      开始记录
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  第一次来？
                  <button
                    onClick={() => trimmed ? handleRegister() : inputRef.current?.focus()}
                    className="ml-1 font-semibold cursor-pointer"
                    style={{ color: '#F97316' }}
                  >
                    创建健康档案
                  </button>
                </p>
              </>
            ) : (
              <NotFoundView name={trimmed} onRegister={handleRegister} onReset={handleReset} />
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
        `}</style>
      </div>
      )}
    </>
  );
}

interface NameInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

const NameInput = forwardRef<HTMLInputElement, NameInputProps>(
  ({ value, onChange, onKeyDown, disabled }, ref) => {
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
        placeholder="输入你的昵称，比如：小梅"
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
        重新输入昵称
      </button>
    </div>
  );
}

const COLORS = ['#F97316', '#EC4899', '#7C3AED', '#0EA5E9', '#22C55E', '#F59E0B'];

function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 5 + (i * 7 % 12),
    x: (i * 17 + 5) % 100,
    delay: (i * 0.51) % 6,
    duration: 5 + (i * 0.41) % 4,
    color: COLORS[i % COLORS.length],
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
