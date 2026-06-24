import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

interface SparkData {
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
}

interface AIRecognitionCelebrationProps {
  foodName: string;
  calories: number;
  onDismiss: () => void;
}

const SPARK_COLORS = ['#A3B899', '#7CB9E8', '#C084FC', '#FCD34D', '#F97316', '#86EFAC', '#F9A8D4'];

const AI_PRAISES = [
  '已精准识别，记录很重要',
  '科学饮食从每一口开始',
  '每次记录都在靠近目标',
  '你比大多数人更了解自己',
];

export default function AIRecognitionCelebration({ foodName, calories, onDismiss }: AIRecognitionCelebrationProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'leave'>('enter');
  const [praise] = useState(() => AI_PRAISES[Math.floor(Math.random() * AI_PRAISES.length)]);

  const sparks = useMemo<SparkData[]>(() => Array.from({ length: 16 }, (_, i) => ({
    angle: (360 / 16) * i + (Math.random() * 14 - 7),
    distance: 52 + Math.random() * 36,
    size: 5 + Math.random() * 8,
    color: SPARK_COLORS[i % SPARK_COLORS.length],
    delay: Math.random() * 0.22,
  })), []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 20);
    const t2 = setTimeout(() => setPhase('leave'), 2400);
    const t3 = setTimeout(onDismiss, 2850);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDismiss]);

  const isVisible = phase === 'show';

  const sparkKeyframes = sparks.map((spark, i) => {
    const rad = (spark.angle * Math.PI) / 180;
    const tx = Math.cos(rad) * spark.distance;
    const ty = Math.sin(rad) * spark.distance;
    return `@keyframes aiSpark_${i} { 0% { transform: translate(-50%,-50%) scale(0.1); opacity:1; } 55% { transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1); opacity:0.9; } 100% { transform: translate(calc(-50% + ${tx * 1.45}px), calc(-50% + ${ty * 1.45}px)) scale(0.15); opacity:0; } }`;
  }).join('');

  const content = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
      style={{
        opacity: phase === 'leave' ? 0 : phase === 'enter' ? 0 : 1,
        transition: 'opacity 0.38s ease',
      }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
        {sparks.map((spark, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: spark.size,
              height: spark.size,
              left: '50%',
              top: '50%',
              background: `radial-gradient(circle at 35% 35%, ${spark.color}, ${spark.color}66)`,
              boxShadow: `0 0 ${spark.size}px ${spark.color}88`,
              animation: isVisible
                ? `aiSpark_${i} 0.95s ${spark.delay}s cubic-bezier(0.22,1,0.36,1) both`
                : 'none',
            }}
          />
        ))}

        <div
          className="relative rounded-2xl px-6 py-5 flex flex-col items-center pointer-events-auto cursor-pointer"
          style={{
            background: 'var(--card)',
            boxShadow: '0 20px 52px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.09)',
            backdropFilter: 'blur(18px)',
            minWidth: '196px',
            maxWidth: '240px',
            transform: isVisible ? 'scale(1)' : 'scale(0.82)',
            transition: 'transform 0.42s cubic-bezier(0.34,1.52,0.64,1)',
          }}
          onClick={() => { setPhase('leave'); setTimeout(onDismiss, 400); }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-[11px] font-semibold text-muted-foreground">AI 识别成功</p>
          </div>

          <p
            className="text-base font-bold text-center mb-1.5 leading-snug text-foreground"
            style={{ maxWidth: '180px', wordBreak: 'break-all' }}
          >
            {foodName}
          </p>

          <p className="text-3xl font-black tabular-nums" style={{ color: '#F97316' }}>
            {calories}
            <span className="text-sm font-bold ml-1 text-muted-foreground">kcal</span>
          </p>

          <p className="text-[10px] mt-2 text-center leading-snug text-muted-foreground">
            {praise}
          </p>
        </div>
      </div>

      <style>{sparkKeyframes}</style>
    </div>
  );

  return createPortal(content, document.body);
}
