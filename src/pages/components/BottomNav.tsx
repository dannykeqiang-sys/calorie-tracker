import { BookOpen, TrendingUp, Wand2 } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAIOpen: () => void;
}

const LEFT_TABS = [
  { value: 'today', label: '今日手帐', icon: BookOpen },
];

const RIGHT_TABS = [
  { value: 'analytics', label: '时光机', icon: TrendingUp },
];

export default function BottomNav({ activeTab, onTabChange, onAIOpen }: BottomNavProps) {
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

        <div className="absolute left-1/2 -translate-x-1/2 -top-7 z-10">
          <button
            data-tutorial="ai-btn"
            onClick={onAIOpen}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all"
            style={{
              background: activeTab === 'ai'
                ? 'linear-gradient(145deg, #7CB9A8, #4DA898)'
                : 'linear-gradient(145deg, #A3B899, #7CB9A8)',
              boxShadow: activeTab === 'ai'
                ? '0 -4px 24px rgba(77,168,152,0.7), 0 4px 16px rgba(77,168,152,0.5), 0 0 0 3px rgba(124,185,168,0.3)'
                : '0 -4px 20px rgba(163,184,153,0.55), 0 4px 16px rgba(124,185,168,0.45), 0 2px 8px rgba(0,0,0,0.14)',
            }}
          >
            <Wand2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
}
