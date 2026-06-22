import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Input } from '@/components/shadcn/input';
import { Button } from '@/components/shadcn/button';
import { LogOut, Download, Upload, Settings, Key, Check } from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onExport: () => void;
  onBatchImport: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

function maskApiKey(key: string): string {
  if (!key) return '未设置';
  if (key.length <= 7) return '***';
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

export default function SettingsPanel({
  open,
  onClose,
  onLogout,
  onExport,
  onBatchImport,
  apiKey,
  onApiKeyChange,
}: SettingsPanelProps) {
  const [inputKey, setInputKey] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSaveApiKey = () => {
    onApiKeyChange(inputKey);
    setInputKey('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

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
          {/* API Key 配置 */}
          <div className="space-y-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Key className="w-4 h-4 text-primary" />
              DeepSeek API Key
            </div>
            <div className="text-xs text-muted-foreground">
              当前状态: <span className="font-mono text-foreground/80">{maskApiKey(apiKey)}</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="输入新的 API Key (sk-...)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSaveApiKey}
                disabled={!inputKey.trim()}
                size="sm"
                className="shrink-0"
              >
                {showSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    已保存
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              API Key 仅保存在本地浏览器中，不会上传到云端
            </p>
          </div>

          {/* 数据管理 */}
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

          {/* 退出登录 */}
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
