import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { LogOut, Download, Upload, Settings } from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onExport: () => void;
  onBatchImport: () => void;
}

export default function SettingsPanel({ open, onClose, onLogout, onExport, onBatchImport }: SettingsPanelProps) {

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            设置
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            数据管理与账户设置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="pt-0 border-t border-border/50 space-y-2">
            <button
              onClick={() => { onClose(); setTimeout(onBatchImport, 150); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all cursor-pointer border border-dashed border-border/40 hover:border-border"
            >
              <Upload className="w-4 h-4" />
              批量导入历史数据
            </button>
            <button
              onClick={() => { onClose(); setTimeout(onExport, 150); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all cursor-pointer border border-dashed border-border/40 hover:border-border"
            >
              <Download className="w-4 h-4" />
              导出所有记录数据
            </button>
          </div>

          <div className="border-t border-border/50">
            <button
              onClick={() => {
                if (window.confirm('确定要退出登录吗？')) {
                  onLogout();
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-all cursor-pointer border border-dashed border-destructive/25 hover:border-destructive/40"
            >
              <LogOut className="w-4 h-4" />
              退出登录，重新设置
            </button>
            <p className="text-[11px] text-muted-foreground/50 text-center mt-1.5">
              退出后跳转登录页，可重新登录或注册
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
