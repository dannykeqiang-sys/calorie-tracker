import { useState, useEffect, useRef, useCallback } from 'react';

interface TutorialOverlayProps {
  name: string;
  onDone: () => void;
  onTabChange: (tab: string) => void;
}

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface BubblePos {
  above: boolean;
  top: number;
}

interface ComputedLayout {
  rect: SpotRect;
  bubble: BubblePos;
}

const STEPS = [
  {
    selectors: ['[data-tutorial="cards"]'],
    tab: 'today',
    padding: 8,
    shape: 'rect' as const,
    accent: '#F97316',
    icon: '☀️',
    label: '第一步：读懂今天的状态',
    desc: '这里汇总亮亮今天的摄入、消耗和营养缺口。演示数据已保留午餐为空，等你亲手完成一次记录。',
    btnText: '看看 AI 怎么记录',
  },
  {
    selectors: ['[data-tutorial="ai-input-btn"]'],
    tab: 'today',
    padding: 12,
    shape: 'rect' as const,
    accent: '#8B5CF6',
    icon: '💬',
    label: '第二步：一句话完成记录',
    desc: '输入“中午吃了一碗牛肉面，加一个卤蛋”，AI 会先解析为可确认的结构化结果，再写入对应餐次。',
    btnText: '继续看行动建议',
  },
  {
    selectors: ['[data-tutorial="action-advice"]'],
    tab: 'ai',
    padding: 8,
    shape: 'rect' as const,
    accent: '#A855F7',
    icon: '🧭',
    label: '第三步：从数据走向行动',
    desc: 'AI 不止计算热量，还会结合目标、当天缺口和近期习惯，告诉亮亮下一餐具体该怎么选。',
    btnText: '看看一个月的变化',
  },
  {
    selectors: ['[data-tutorial="chart"]'],
    tab: 'analytics',
    padding: 10,
    shape: 'rect' as const,
    accent: '#10B981',
    icon: '📊',
    label: '第四步：看见改变发生',
    desc: '最近 30 天里，亮亮逐渐提高蛋白质和运动频率，体重从约 63.2 kg 平稳下降到 62.0 kg。点击可查看详细趋势。',
    btnText: '开启轻盈生活',
  },
];

const BUBBLE_ESTIMATED_H = 230;
const NAVBAR_H = 68;
const CONFETTI_COLORS = ['#F97316', '#A3B899', '#7CB9E8', '#C084FC', '#F43F5E', '#FCD34D', '#34D399'];

function pickElement(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const node of Array.from(els)) {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

function computeLayout(el: HTMLElement, padding: number, shape: 'circle' | 'rect'): ComputedLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = el.getBoundingClientRect();

  const rawTop = r.top - padding;
  const rawLeft = r.left - padding;
  const rawRight = r.right + padding;
  const rawBottom = r.bottom + padding;

  const top = Math.max(2, rawTop);
  const left = Math.max(2, rawLeft);
  const right = Math.min(vw - 2, rawRight);
  const maxBottom = vh - 8;
  const bottom = Math.min(rawBottom, maxBottom);
  const height = Math.max(30, bottom - top);

  const spaceAbove = top;
  const spaceBelow = vh - (top + height);
  const above = spaceAbove > spaceBelow;

  const bubbleTop = above
    ? Math.max(NAVBAR_H + 8, top - BUBBLE_ESTIMATED_H - 12)
    : Math.min(top + height + 12, vh - BUBBLE_ESTIMATED_H - 8);

  return {
    rect: { top, left, width: right - left, height },
    bubble: { above, top: bubbleTop },
  };
}

function runConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  interface Particle {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; rot: number; rotV: number;
    shape: 'circle' | 'rect' | 'strip';
    life: number; maxLife: number;
  }

  const particles: Particle[] = [];

  const burst = (count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      particles.push({
        x: canvas.width * 0.15 + Math.random() * canvas.width * 0.7,
        y: canvas.height * 0.1 + Math.random() * canvas.height * 0.3,
        vx: Math.cos(angle) * speed,
        vy: -3 - Math.random() * 5,
        size: 5 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.14,
        shape: (['circle', 'rect', 'strip'] as const)[Math.floor(Math.random() * 3)],
        life: 0,
        maxLife: 90 + Math.random() * 90,
      });
    }
  };

  burst(120);
  const t = setTimeout(() => burst(80), 600);
  let rafId: number;

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.17;
      p.rot += p.rotV; p.life++;
      const opacity = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = opacity; ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.fillRect(-p.size, -p.size * 0.14, p.size * 2, p.size * 0.28);
      }
      ctx.restore();
    }
    if (particles.length > 0) rafId = requestAnimationFrame(animate);
  };

  rafId = requestAnimationFrame(animate);
  return () => { clearTimeout(t); cancelAnimationFrame(rafId); };
}

export default function TutorialOverlay({ name, onDone, onTabChange }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState<ComputedLayout | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const addTimer = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  };

  const measureStep = useCallback((stepIndex: number) => {
    const s = STEPS[stepIndex];
    const el = pickElement(s.selectors);
    if (!el) { setLayout(null); return; }
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    addTimer(() => {
      const el2 = pickElement(s.selectors);
      if (!el2) { setLayout(null); return; }
      setLayout(computeLayout(el2, s.padding, s.shape));
    }, 80);
  }, []);

  useEffect(() => {
    clearTimers();
    setVisible(false);
    setLayout(null);

    const s = STEPS[step];
    const prevTab = step > 0 ? STEPS[step - 1].tab : s.tab;
    const tabChanged = s.tab !== prevTab;
    onTabChange(s.tab);

    const delay = tabChanged ? 700 : 380;
    addTimer(() => {
      measureStep(step);
      addTimer(() => setVisible(true), 100);
    }, delay);

    return clearTimers;
  }, [step, measureStep, onTabChange]);

  useEffect(() => {
    if (celebrating && canvasRef.current) {
      cleanupRef.current?.();
      cleanupRef.current = runConfetti(canvasRef.current);
    }
    return () => { cleanupRef.current?.(); };
  }, [celebrating]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setVisible(false);
      setLayout(null);
      addTimer(() => setStep(s => s + 1), 200);
    } else {
      setCelebrating(true);
    }
  };

  const handleSkip = () => {
    setFadeOut(true);
    addTimer(onDone, 420);
  };

  const handleFinish = () => {
    setFadeOut(true);
    addTimer(onDone, 420);
  };

  const s = STEPS[step];

  if (celebrating) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.78)', opacity: fadeOut ? 0 : 1, transition: 'opacity 0.42s ease' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div
          className="relative z-10 mx-6 rounded-3xl px-8 py-10 text-center flex flex-col items-center gap-4 max-w-xs w-full"
          style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.22)' }}
        >
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-black text-white leading-snug" style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>
            仪式感加载完毕
          </h2>
          <p className="text-sm text-white/85 leading-relaxed">今天，也是被好好照顾的一天。❤️</p>
          <button
            onClick={handleFinish}
            className="mt-2 w-full py-3 rounded-2xl text-sm font-bold text-white cursor-pointer active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9E8)' }}
          >
            {name ? `出发吧，${name}！` : '出发吧！'}
          </button>
        </div>
      </div>
    );
  }

  if (!layout && visible) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div className="w-full max-w-xs rounded-2xl p-5 shadow-2xl" style={{ background: 'white', border: `2px solid ${s.accent}35` }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{s.icon}</span>
            <span className="text-sm font-bold text-foreground">{s.label}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
          <StepDots step={step} accent={s.accent} />
          <button onClick={handleNext} className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer active:scale-95 transition-all" style={{ background: s.accent }}>
            {s.btnText}
          </button>
          <button onClick={handleSkip} className="mt-2 w-full py-2 text-xs text-muted-foreground/60 cursor-pointer">跳过引导</button>
        </div>
      </div>
    );
  }

  if (!layout) {
    return <div className="fixed inset-0 z-[100]" style={{ opacity: 0 }} />;
  }

  const { rect, bubble } = layout;
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  return (
    <div className="fixed inset-0 z-[100]" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: visible ? 'auto' : 'none' }}>
      <div className="absolute" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top), background: 'rgba(0,0,0,0.75)' }} />
      <div className="absolute" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)' }} />
      <div className="absolute" style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height, background: 'rgba(0,0,0,0.75)' }} />
      <div className="absolute" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height, background: 'rgba(0,0,0,0.75)' }} />

      <div
        className="absolute pointer-events-none"
        style={{
          top: rect.top, left: rect.left,
          width: rect.width, height: rect.height,
          borderRadius: '14px',
          border: `3px solid ${s.accent}`,
          boxShadow: `0 0 0 4px ${s.accent}30, 0 0 20px ${s.accent}50`,
          animation: 'tutPulse 1.8s ease-in-out infinite',
        }}
      />

      <div
        className="absolute"
        style={{
          top: bubble.top,
          left: Math.max(12, (vw - 320) / 2),
          width: Math.min(320, vw - 24),
        }}
      >
        <div
          className="relative rounded-2xl p-4 shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.98)', border: `2px solid ${s.accent}30`, boxShadow: `0 16px 48px rgba(0,0,0,0.32), 0 0 0 1px ${s.accent}20` }}
        >
          {!bubble.above && (
            <div className="absolute" style={{ top: -9, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: `9px solid rgba(255,255,255,0.98)` }} />
          )}
          {bubble.above && (
            <div className="absolute" style={{ bottom: -9, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: `9px solid rgba(255,255,255,0.98)` }} />
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{s.icon}</span>
            <span className="text-sm font-bold text-foreground leading-tight">{s.label}</span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3" style={{ minHeight: 0 }}>
            {s.desc}
          </p>

          <StepDots step={step} accent={s.accent} />

          <button
            onClick={handleNext}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer active:scale-95 transition-all"
            style={{ background: `linear-gradient(135deg, ${s.accent}, ${s.accent}cc)`, boxShadow: `0 4px 14px ${s.accent}45` }}
          >
            {s.btnText}
          </button>

          <button onClick={handleSkip} className="mt-2 w-full py-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer">
            跳过引导
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tutPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

function StepDots({ step, accent }: { step: number; accent: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: i === step ? '20px' : '6px', backgroundColor: i === step ? accent : '#D1D5DB' }}
        />
      ))}
    </div>
  );
}
