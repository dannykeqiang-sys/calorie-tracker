import { useState, useEffect } from 'react';
import { ChevronRight, Sparkles, Camera, TrendingUp } from 'lucide-react';

interface FeatureGuideProps {
  name: string;
  onDone: () => void;
}

const SLIDES = [
  {
    icon: Camera,
    emoji: '📸',
    tag: '核心功能',
    title: '拍一下，全识别',
    desc: '拍食物照片或直接说出菜名，AI 秒速匹配营养数据——热量、蛋白质、碳水、脂肪一键到位，再也不用手动查表。',
    highlight: '一键智能识别',
    bg: 'linear-gradient(160deg, #FFF8F5 0%, #FEF0E8 100%)',
    accent: '#F97316',
    tagBg: '#FFF0E4',
    tagColor: '#EA580C',
    iconBg: 'linear-gradient(135deg, #FDBA74, #FB923C)',
  },
  {
    icon: Sparkles,
    emoji: '✨',
    tag: 'AI 推荐',
    title: 'AI 帮你做最优选择',
    desc: '基于你的目标和今日摄入，AI 实时给出下一餐建议、抗炎食材搭配和运动方案——不是千篇一律，是专属于你的。',
    highlight: 'AI 智能推荐',
    bg: 'linear-gradient(160deg, #FAF5FF 0%, #F5F2FF 100%)',
    accent: '#8B5CF6',
    tagBg: '#F3EEFF',
    tagColor: '#7C3AED',
    iconBg: 'linear-gradient(135deg, #C4B5FD, #A78BFA)',
  },
  {
    icon: TrendingUp,
    emoji: '📊',
    tag: '数据洞察',
    title: '看见你的每一点进步',
    desc: '时光机记录你过去 7 天的热量、营养和运动轨迹，AI 自动生成周报和改进建议，让坚持变得有意义。',
    highlight: '智能周报分析',
    bg: 'linear-gradient(160deg, #F0FDF8 0%, #ECFDF5 100%)',
    accent: '#10B981',
    tagBg: '#ECFDF5',
    tagColor: '#059669',
    iconBg: 'linear-gradient(135deg, #6EE7B7, #34D399)',
  },
];

export default function FeatureGuide({ name, onDone }: FeatureGuideProps) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const goNext = () => {
    if (animating) return;
    if (isLast) {
      setVisible(false);
      setTimeout(onDone, 350);
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setCurrent(c => c + 1);
      setAnimating(false);
    }, 220);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500"
      style={{
        background: slide.bg,
        opacity: visible ? 1 : 0,
        transition: 'background 0.6s ease, opacity 0.35s ease',
      }}
    >
      <div
        className="w-full max-w-sm flex flex-col items-center"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}
      >
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center mb-6 text-6xl shadow-xl"
          style={{
            background: slide.iconBg,
            boxShadow: `0 20px 60px ${slide.accent}30`,
          }}
        >
          {slide.emoji}
        </div>

        <div
          className="px-3 py-1 rounded-full text-xs font-bold mb-3"
          style={{ backgroundColor: slide.tagBg, color: slide.tagColor }}
        >
          {slide.tag}
        </div>

        <h2
          className="text-2xl font-black text-center text-foreground mb-3 leading-snug"
          style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
        >
          {slide.title}
        </h2>

        <div
          className="w-full rounded-2xl px-4 py-3 mb-4 text-center"
          style={{ backgroundColor: `${slide.accent}12`, border: `1.5px solid ${slide.accent}25` }}
        >
          <p className="text-xs font-bold" style={{ color: slide.accent }}>{slide.highlight}</p>
        </div>

        <p className="text-sm text-center text-muted-foreground leading-relaxed px-2 mb-8">
          {slide.desc}
        </p>

        <div className="flex items-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-2 rounded-full transition-all duration-400"
              style={{
                width: i === current ? '28px' : '8px',
                backgroundColor: i === current ? slide.accent : '#D1D5DB',
              }}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97] cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}bb)`,
            boxShadow: `0 8px 24px ${slide.accent}45`,
          }}
        >
          {isLast ? `我准备好了，${name}！` : '下一步'}
          {!isLast && <ChevronRight className="w-4 h-4" />}
        </button>

        {!isLast && (
          <button
            onClick={() => { setVisible(false); setTimeout(onDone, 350); }}
            className="mt-3 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer py-2"
          >
            跳过引导
          </button>
        )}
      </div>
    </div>
  );
}
