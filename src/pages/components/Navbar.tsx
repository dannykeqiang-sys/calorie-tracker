import { Button } from '@/components/shadcn/button';
import AppIcon, { AppMark } from '@/components/AppIcon';
import type { UserProfile } from '../../types';

interface NavbarProps {
  profile: UserProfile | null;
  onEditProfile: () => void;
  onOpenSettings: () => void;
}

export default function Navbar({ profile, onEditProfile, onOpenSettings }: NavbarProps) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border backdrop-blur-md bg-background/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 sm:h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppMark size={36} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">燃烧我的卡路里</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">{today}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="API 设置"
          >
            <AppIcon name="settings" size={17} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEditProfile}
            className="border-border bg-card hover:bg-muted text-foreground gap-2 cursor-pointer"
          >
            <AppIcon name="user" size={17} className="text-primary" />
            <span className="hidden sm:inline">
              {profile?.name ? profile.name : '设置个人信息'}
            </span>
            <span className="sm:hidden">
              {profile?.name ? profile.name : '设置'}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
