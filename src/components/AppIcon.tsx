import type { CSSProperties, ReactNode, SVGProps } from 'react';

export type AppIconName =
  | 'flame' | 'journal' | 'trend' | 'ai' | 'user' | 'settings'
  | 'upload' | 'download' | 'key' | 'reset' | 'logout'
  | 'sparkles' | 'plus' | 'check' | 'close' | 'water'
  | 'activity' | 'weight' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: AppIconName;
  size?: number;
  tone?: 'plain' | 'duotone';
}

const paths: Record<AppIconName, ReactNode> = {
  flame: <><path d="M12.4 3.1c.4 3-1.8 4.2-3.1 6.1-1 1.4-1.5 2.7-.8 4.4.5-1.6 1.5-2.5 2.7-3.5-.1 2.2 1.1 3.2 2.2 4.3 1-1.5 1.5-3.3 1-5.2 2.4 1.8 4.1 4.1 3.8 7.1-.3 3.3-3 5.7-6.3 5.7-3.7 0-6.6-2.7-6.4-6.4.2-3.6 2.6-5.6 4.7-8 .9-1 1.7-2.2 2.2-4.5Z" /><path d="M12.1 20c-1.7 0-3-1.2-3-2.8 0-1.3.8-2.3 2-3.2 0 1 .6 1.6 1.2 2.2.6-.8.9-1.7.8-2.7 1.2 1 2 2.1 1.8 3.5-.1 1.7-1.3 3-2.8 3Z" opacity=".45" /></>,
  journal: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z" /><path d="M5 4.5A2.5 2.5 0 0 0 2.5 7v12.5A2.5 2.5 0 0 0 5 22M9 7h7M9 11h5" opacity=".5" /></>,
  trend: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3.2-3.3 2.8 2.2L19 7" /><path d="M15 7h4v4" opacity=".5" /></>,
  ai: <><path d="M12 2.8c.7 3.1 2.6 5 5.7 5.7-3.1.7-5 2.6-5.7 5.7-.7-3.1-2.6-5-5.7-5.7 3.1-.7 5-2.6 5.7-5.7Z" /><path d="M18.5 14.2c.4 1.8 1.5 2.9 3.3 3.3-1.8.4-2.9 1.5-3.3 3.3-.4-1.8-1.5-2.9-3.3-3.3 1.8-.4 2.9-1.5 3.3-3.3ZM5.2 14.7c.3 1.2 1 1.9 2.2 2.2-1.2.3-1.9 1-2.2 2.2-.3-1.2-1-1.9-2.2-2.2 1.2-.3 1.9-1 2.2-2.2Z" opacity=".55" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.5-4.3 3-6.5 7.5-6.5s7 2.2 7.5 6.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" opacity=".55" /></>,
  upload: <><path d="M12 16V3M7.5 7.5 12 3l4.5 4.5" /><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" opacity=".55" /></>,
  download: <><path d="M12 3v13M7.5 11.5 12 16l4.5-4.5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" opacity=".55" /></>,
  key: <><circle cx="8" cy="12" r="4.2" /><path d="m11.5 9.5 8-5M16 6.8l2.2 2.2M13.5 8.4l1.8 1.8" opacity=".55" /></>,
  reset: <><path d="M4.8 8A8 8 0 1 1 4 15" /><path d="M4.8 3.5V8h4.5" opacity=".55" /></>,
  logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="M14 8l4 4-4 4M8 12h10" opacity=".55" /></>,
  sparkles: <><path d="M12 2.8c.7 3.1 2.6 5 5.7 5.7-3.1.7-5 2.6-5.7 5.7-.7-3.1-2.6-5-5.7-5.7 3.1-.7 5-2.6 5.7-5.7Z" /><path d="M5 14.5c.35 1.5 1.25 2.4 2.75 2.75C6.25 17.6 5.35 18.5 5 20c-.35-1.5-1.25-2.4-2.75-2.75C3.75 16.9 4.65 16 5 14.5Z" opacity=".55" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m4.5 12.5 4.5 4.3L19.5 6.5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  water: <path d="M12 2.8S5.5 10 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10 12 2.8 12 2.8Z" />,
  activity: <path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" />,
  weight: <><path d="M5 8.5h14l1.5 12h-17l1.5-12Z" /><path d="M9 8.5a3 3 0 0 1 6 0M12 8.5l2-2" opacity=".5" /></>,
  breakfast: <><path d="M4 14a8 8 0 0 1 16 0H4ZM2.5 17h19" /><path d="M12 3V1M5 7 3.5 5.5M19 7l1.5-1.5" opacity=".55" /></>,
  lunch: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" opacity=".45" /></>,
  dinner: <><path d="M4 14a8 8 0 0 1 16 0H4ZM2.5 17h19" /><path d="M12 6V3" opacity=".55" /></>,
  snack: <><path d="M7 5h10l1.5 16h-13L7 5Z" /><path d="M9 5c0-2 1.2-3 3-3s3 1 3 3M9 10h6" opacity=".5" /></>,
};

export default function AppIcon({ name, size = 20, tone = 'duotone', style, ...props }: AppIconProps) {
  const mergedStyle: CSSProperties = { display: 'block', flexShrink: 0, ...style };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={tone === 'duotone' ? 1.85 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={mergedStyle}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export function AppMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[30%] text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, #FF8A24 0%, #F95A75 52%, #8057E8 100%)',
        boxShadow: '0 8px 22px rgba(241,92,96,.24), inset 0 1px 0 rgba(255,255,255,.42)',
      }}
      aria-label="应用 Logo 占位"
    >
      <AppIcon name="flame" size={size * 0.56} />
    </span>
  );
}
