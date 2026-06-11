import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Scale, TrendingDown, TrendingUp, Minus, Heart } from 'lucide-react';

interface OrbData {
  size: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

interface WeightRecordCelebrationProps {
  weight: number;
  previousWeight?: number;
  onDismiss: () => void;
}

const ORB_COLORS = ['#A3B899', '#7CB9E8', '#C084FC', '#86EFAC', '#BAE6FD', '#FCD34D', '#F9A8D4'];

type MsgIcon = typeof Scale;

interface MsgData {
  title: string;
  sub: string;
  icon: MsgIcon;
  color: string;
}

function getMsg(weight: number, diff?: number): MsgData {
  if (diff === undefined) {
    return {
      title: '第一次记录体重！',
      sub: '迈出第一步，就已经赢了一半。你开始关注自己了',
      icon: Heart as MsgIcon,
      color: '#C084FC',
    };
  }
  const abs = Math.abs(diff).toFixed(1);
  if (diff < -0.3) {
    return {
      title: `下降了 ${abs} kg`,
      sub: '你的坚持正在悄悄生效，身体记住了你每一次的努力',
      icon: TrendingDown as MsgIcon,
      color: '#22C55E',
    };
  }
  if (diff > 0.3) {
    return {
      title: `上升了 ${abs} kg`,
      sub: '小小波动很正常，保持节奏，今天继续就好',
      icon: TrendingUp as MsgIcon,
      color: '#F97316',
    };
  }
  return {
    title: '体重保持稳定',
    sub: '稳住本身就是一种胜利，你在做得很好',
    icon: Minus as MsgIcon,
    color: '#7CB9E8',
  };
}

export default function WeightRecordCelebration({ weight, previousWeight, onDismiss }: WeightRecordCelebrationProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'leave'>('enter');

  const diff = previousWeight !== undefined ? +(weight - previousWeight).toFixed(1) : undefined;
  const { title, sub, icon: MsgIcon, color } = getMsg(weight, diff);

  const orbs = useMemo<OrbData[]>(() => Array.from({ length: 22 }, (_, i) => ({
    size: 8 + Math.random() * 24,
    left: 3 + Math.random() * 94,
    delay: Math.random() * 2.2,
    duration: 2.2 + Math.random() * 2.8,
    color: ORB_COLORS[i % ORB_COLORS.length],
  })), []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 30);
    const t2 = setTimeout(() => setPhase('leave'), 3300);
    const t3 = setTimeout(onDismiss, 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDismiss]);

  const isVisible = phase === 'show';

  const overlay = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      onClick={() => { setPhase('leave'); setTimeout(onDismiss, 500); }}
      style={{
        background: isVisible ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0)',
        backdropFilter: isVisible ? 'blur(8px)' : 'none',
        opacity: phase === 'leave' ? 0 : 1,
        transition: 'background 0.45s ease, backdrop-filter 0.45s ease, opacity 0.5s ease',
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {orbs.map((orb, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: orb.size,
              height: orb.size,
              left: `${orb.left}%`,
              bottom: '-40px',
              background: `radial-gradient(circle at 32% 28%, ${orb.color}cc, ${orb.color}44)`,
              animation: `wrcOrbFloat ${orb.duration}s ${orb.delay}s ease-out infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative z-10 rounded-3xl p-8 flex flex-col items-center text-center mx-6 pointer-events-auto"
        style={{
          background: 'rgba(255,255,255,0.86)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          maxWidth: '300px',
          width: '100%',
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.86) translateY(22px)',
          transition: 'transform 0.52s cubic-bezier(0.34,1.48,0.64,1)',
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: `linear-gradient(135deg, ${color}28, ${color}12)`,
            border: `1.5px solid ${color}35`,
          }}
        >
          <Scale className="w-7 h-7" style={{ color }} />
        </div>

        <p className="text-5xl font-black tabular-nums mb-1" style={{ color: '#1F2937' }}>
          {weight}
        </p>
        <p className="text-lg font-bold mb-4" style={{ color: '#9CA3AF' }}>kg</p>

        <div className="flex items-center gap-1.5 mb-2.5">
          <MsgIcon className="w-4 h-4" style={{ color }} />
          <p className="text-sm font-bold" style={{ color }}>{title}</p>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{sub}</p>

        <p className="text-[10px] mt-5" style={{ color: '#D1D5DB' }}>轻触任意处关闭</p>
      </div>

      <style>{`
        @keyframes wrcOrbFloat {
          0% { transform: translateY(0) scale(1); opacity: 0.75; }
          75% { opacity: 0.15; }
          100% { transform: translateY(-108vh) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
}
