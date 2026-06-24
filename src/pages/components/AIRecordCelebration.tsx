import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

interface OrbData {
  size: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

const ENCOURAGEMENTS = [
  { title: '已记录，继续加油！', sub: '每一次记录都是对自己的温柔', color: '#A3B899' },
  { title: '太棒了，坚持就是胜利！', sub: '科学管理，让生活更有能量', color: '#7CB9E8' },
  { title: '打卡成功！', sub: '你比昨天更了解自己的身体了', color: '#C084FC' },
  { title: '记录很重要！', sub: '习惯需要21天，你每次都在进步', color: '#F97316' },
  { title: '认真生活的你最美！', sub: '这份坚持，身体都记得', color: '#22C55E' },
  { title: '每一口都被认真对待！', sub: '数字背后，是你对健康的承诺', color: '#0EA5E9' },
];

const ORB_COLORS = ['#A3B899', '#7CB9E8', '#C084FC', '#86EFAC', '#FCD34D', '#F9A8D4', '#F97316'];

interface AIRecordCelebrationProps {
  onDismiss: () => void;
}

export default function AIRecordCelebration({ onDismiss }: AIRecordCelebrationProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'leave'>('enter');
  const [msg] = useState(() => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);

  const orbs = useMemo<OrbData[]>(() => Array.from({ length: 20 }, (_, i) => ({
    size: 6 + Math.random() * 18,
    left: 3 + Math.random() * 94,
    delay: Math.random() * 1.8,
    duration: 1.8 + Math.random() * 2.4,
    color: ORB_COLORS[i % ORB_COLORS.length],
  })), []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 20);
    const t2 = setTimeout(() => setPhase('leave'), 2600);
    const t3 = setTimeout(onDismiss, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDismiss]);

  const isVisible = phase === 'show';

  const overlay = (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center pointer-events-none"
      style={{
        opacity: phase === 'leave' ? 0 : phase === 'enter' ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {orbs.map((orb, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: orb.size,
              height: orb.size,
              left: `${orb.left}%`,
              bottom: '-30px',
              background: `radial-gradient(circle at 35% 35%, ${orb.color}cc, ${orb.color}44)`,
              animation: isVisible
                ? `arcRecOrbFloat ${orb.duration}s ${orb.delay}s ease-out forwards`
                : 'none',
            }}
          />
        ))}
      </div>

      <div
        className="relative rounded-2xl px-7 py-6 flex flex-col items-center text-center pointer-events-auto cursor-pointer mx-8"
        style={{
          background: 'var(--card)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.20), 0 6px 20px rgba(0,0,0,0.10)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          maxWidth: '280px',
          width: '100%',
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(20px)',
          transition: 'transform 0.45s cubic-bezier(0.34,1.52,0.64,1)',
        }}
        onClick={() => { setPhase('leave'); setTimeout(onDismiss, 450); }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: `linear-gradient(135deg, ${msg.color}30, ${msg.color}18)`,
            border: `1.5px solid ${msg.color}40`,
          }}
        >
          <Sparkles className="w-6 h-6" style={{ color: msg.color }} />
        </div>

        <p className="text-sm font-bold mb-1.5 text-foreground">{msg.title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground" style={{ maxWidth: '200px' }}>{msg.sub}</p>
        <p className="text-[10px] mt-4 text-muted-foreground/60">轻触关闭</p>
      </div>

      <style>{`
        @keyframes arcRecOrbFloat {
          0% { transform: translateY(0) scale(0.8); opacity: 0.85; }
          70% { opacity: 0.2; }
          100% { transform: translateY(-105vh) scale(0.35); opacity: 0; }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
}
