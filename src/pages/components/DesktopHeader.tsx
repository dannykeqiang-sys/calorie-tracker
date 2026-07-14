import { useState } from 'react';
import type { UserProfile } from '../../types';
import AppIcon, { AppMark, type AppIconName } from '@/components/AppIcon';

const TABS = [
  {
    value: 'today',
    label: '今日手帐',
    icon: 'journal' as AppIconName,
    color: '#5A9E6F',
    gradient: 'linear-gradient(135deg, #A3B899 0%, #7CB9A8 100%)',
    shadowColor: 'rgba(163,184,153,0.45)',
    desc: '饮食 · 运动 · 饮水',
  },
  {
    value: 'analytics',
    label: '时光机',
    icon: 'trend' as AppIconName,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 100%)',
    shadowColor: 'rgba(96,165,250,0.4)',
    desc: '趋势 · 数据 · 历史',
  },
  {
    value: 'ai',
    label: 'AI 分析',
    icon: 'ai' as AppIconName,
    color: '#A855F7',
    gradient: 'linear-gradient(135deg, #C084FC 0%, #E879F9 100%)',
    shadowColor: 'rgba(192,132,252,0.4)',
    desc: '炎症 · 建议 · 洞察',
  },
];

interface DesktopHeaderProps {
  profile: UserProfile | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  onBatchImport: () => void;
}

export default function DesktopHeader({
  profile,
  activeTab,
  onTabChange,
  onEditProfile,
  onOpenSettings,
  onBatchImport,
}: DesktopHeaderProps) {
  const [shimmerTab, setShimmerTab] = useState<string | null>(null);
  const [shimmerKey, setShimmerKey] = useState(0);

  return (
    <header
      className="flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'url(#liquid-distort) blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.55)',
        boxShadow: 'inset 0 10px 20px rgba(255,255,255,0.4), 0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="h-12 px-6 flex items-center gap-4"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-2.5 select-none flex-shrink-0">
          <AppMark size={28} />
          <span className="text-sm font-bold tracking-tight text-foreground whitespace-nowrap">
            燃烧我的卡路里
          </span>
        </div>

        <div className="flex-1" />

        <button
          onClick={onBatchImport}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all select-none border"
          style={{
            color: 'var(--muted-foreground)',
            borderColor: 'rgba(0,0,0,0.09)',
            backgroundColor: '#fff',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.025)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)';
            (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
          }}
        >
          <AppIcon name="upload" size={13} />
          批量导入
        </button>

        <button
          onClick={onOpenSettings}
          title="设置"
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)';
            (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)';
          }}
        >
          <AppIcon name="settings" size={15} />
        </button>

        <button
          onClick={onEditProfile}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border cursor-pointer transition-all text-xs font-medium text-foreground"
          style={{
            backgroundColor: '#fff',
            borderColor: 'rgba(0,0,0,0.09)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.025)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
          }}
        >
          <div
            className="w-4.5 h-4.5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #A3B899, #7CB9A8)', width: '18px', height: '18px' }}
          >
            <AppIcon name="user" size={11} className="text-white" />
          </div>
          <span className="max-w-[80px] truncate">{profile?.name || '设置信息'}</span>
        </button>
      </div>

      <div className="h-[72px] px-6 flex items-center gap-3">
        {TABS.map(tab => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className="nav-header-tab flex items-center gap-3 px-6 h-14 rounded-3xl cursor-pointer select-none relative overflow-hidden"
              style={{
                background: isActive ? tab.gradient : 'transparent',
                color: isActive ? '#fff' : 'var(--muted-foreground)',
                boxShadow: isActive
                  ? `0 8px 28px ${tab.shadowColor}, 0 2px 8px ${tab.shadowColor}`
                  : 'none',
                transform: isActive ? 'translateY(-1px)' : 'none',
                transition: 'all 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.backgroundColor = 'rgba(0,0,0,0.055)';
                  el.style.color = 'var(--foreground)';
                  el.style.transform = 'translateY(-3px) scale(1.05)';
                  el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)';
                  setShimmerTab(tab.value);
                  setShimmerKey(k => k + 1);
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.backgroundColor = 'transparent';
                  el.style.color = 'var(--muted-foreground)';
                  el.style.transform = 'none';
                  el.style.boxShadow = 'none';
                  setShimmerTab(null);
                }
              }}
            >
              {shimmerTab === tab.value && (
                <span
                  key={shimmerKey}
                  className="absolute inset-0 pointer-events-none"
                  style={{ animation: 'navShimmer 0.7s ease-out forwards' }}
                />
              )}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : `${tab.color}1A`,
                  transition: 'all 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <AppIcon name={tab.icon} size={19} style={{ color: isActive ? '#fff' : tab.color }} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base font-bold leading-none">{tab.label}</span>
                <span
                  className="text-[11px] leading-none mt-1"
                  style={{ opacity: isActive ? 0.8 : 0.5 }}
                >
                  {tab.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes navShimmer {
          from {
            background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
            transform: translateX(-100%);
          }
          to {
            background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
            transform: translateX(200%);
          }
        }
        .nav-header-tab:active {
          transform: scale(0.96) !important;
          transition: transform 0.1s ease !important;
        }
      `}</style>
    </header>
  );
}
