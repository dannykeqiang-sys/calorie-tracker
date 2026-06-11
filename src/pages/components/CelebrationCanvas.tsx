import { useEffect, useRef, useState } from 'react';

interface CelebrationCanvasProps {
  name: string;
  onDone: () => void;
}

const COLORS = ['#F97316', '#A3B899', '#7CB9E8', '#C084FC', '#F43F5E', '#FCD34D', '#34D399'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  shape: 'circle' | 'rect' | 'strip';
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  life: number;
  maxLife: number;
}

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function createParticles(w: number, h: number): Particle[] {
  return Array.from({ length: 160 }, () => {
    const maxLife = randomBetween(90, 180);
    return {
      x: randomBetween(w * 0.2, w * 0.8),
      y: randomBetween(-20, h * 0.3),
      vx: randomBetween(-3, 3),
      vy: randomBetween(-8, -2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: (['circle', 'rect', 'strip'] as const)[Math.floor(Math.random() * 3)],
      size: randomBetween(5, 12),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.12, 0.12),
      opacity: 1,
      life: maxLife,
      maxLife,
    };
  });
}

export default function CelebrationCanvas({ name, onDone }: CelebrationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [cardVisible, setCardVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles = createParticles(canvas.width, canvas.height);
    let secondBurst = false;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!secondBurst && particles.every(p => p.vy > 0)) {
        secondBurst = true;
        particles = [...particles, ...createParticles(canvas.width, canvas.height)];
      }

      particles.forEach(p => {
        p.vy += 0.18;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.life -= 1;
        p.opacity = Math.max(0, p.life / p.maxLife);

        if (p.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }

        ctx.restore();
      });

      particles = particles.filter(p => p.opacity > 0 && p.y < canvas.height + 20);

      if (particles.length > 0) {
        frameRef.current = requestAnimationFrame(draw);
      }
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const handleDone = () => {
    setLeaving(true);
    setTimeout(onDone, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'linear-gradient(160deg, #FFF9F5 0%, #F5F2FF 50%, #F0FDF8 100%)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      <div
        className="relative z-10 w-full max-w-xs mx-4 flex flex-col items-center"
        style={{
          opacity: cardVisible ? 1 : 0,
          transform: cardVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          transition: 'opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 text-5xl shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #FDE68A, #FCA5A5, #C4B5FD)',
            boxShadow: '0 20px 60px rgba(196,181,253,0.4)',
          }}
        >
          🎉
        </div>

        <div
          className="w-full rounded-3xl p-6 text-center shadow-xl"
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(255,255,255,0.9)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          }}
        >
          <h2
            className="text-xl font-black text-foreground mb-2"
            style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
          >
            太棒了，{name}！
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            一切准备就绪。<br />
            从今天起，每一餐都是爱自己的选择。
          </p>

          <button
            onClick={handleDone}
            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97] cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #A3B899, #7CB9E8, #C084FC)',
              boxShadow: '0 6px 24px rgba(163,184,153,0.5)',
            }}
          >
            开始使用
          </button>
        </div>
      </div>
    </div>
  );
}
