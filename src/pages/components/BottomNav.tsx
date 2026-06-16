import { BookOpen, TrendingUp, Camera } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCameraOpen: () => void;
}

const LEFT_TABS = [
  { value: 'today', label: '今日手帐', icon: BookOpen },
];

const RIGHT_TABS = [
  { value: 'analytics', label: '时光机', icon: TrendingUp },
];

export default function BottomNav({ activeTab, onTabChange, onCameraOpen }: BottomNavProps) {
  const isCameraActive = activeTab === 'camera';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-border sm:hidden">
      <div className="relative flex items-stretch h-16 safe-area-inset-bottom">
        {LEFT_TABS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onTabChange(item.value)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer transition-all"
              style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--primary)' }}
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}

        <div className="w-20 flex-shrink-0" />

        {RIGHT_TABS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onTabChange(item.value)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer transition-all"
              style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--primary)' }}
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}

        {/* Center Camera Button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-7 z-10">
          <button
            data-tutorial="camera-btn"
            onClick={onCameraOpen}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all"
            style={{
              background: 'linear-gradient(145deg, #8b5cf6, #6366f1)',
              boxShadow: isCameraActive
                ? '0 -4px 24px rgba(139,92,246,0.7), 0 4px 16px rgba(99,102,241,0.5), 0 0 0 3px rgba(139,92,246,0.3)'
                : '0 -4px 20px rgba(139,92,246,0.5), 0 4px 16px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.14)',
              animation: 'shutter-pulse 2.5s ease-in-out infinite',
            }}
          >
            <Camera className="w-6 h-6" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shutter-pulse {
          0%, 100% { box-shadow: 0 -4px 20px rgba(139,92,246,0.5), 0 4px 16px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.14); }
          50% { box-shadow: 0 -4px 28px rgba(139,92,246,0.72), 0 4px 22px rgba(99,102,241,0.58), 0 0 0 6px rgba(139,92,246,0.18); }
        }
      `}</style>
    </nav>
  );
}
