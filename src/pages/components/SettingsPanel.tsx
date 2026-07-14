import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Input } from '@/components/shadcn/input';
import { Button } from '@/components/shadcn/button';
import { Check, PlayCircle, Trash2 } from 'lucide-react';
import AppIcon from '@/components/AppIcon';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onExport: () => void;
  onBatchImport: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  demoMode?: boolean;
  onReplayTutorial?: () => void;
  onResetDemo?: () => void;
}

function maskApiKey(key: string): string {
  if (!key) return '未设置';
  if (key.length <= 4) return '••••';
  return `•••• ${key.slice(-4)}`;
}

export default function SettingsPanel({
  open,
  onClose,
  onLogout,
  onExport,
  onBatchImport,
  apiKey,
  onApiKeyChange,
  demoMode = false,
  onReplayTutorial,
  onResetDemo,
}: SettingsPanelProps) {
  const [inputKey, setInputKey] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const handleSaveApiKey = () => {
    onApiKeyChange(inputKey);
    setInputKey('');
    setShowSuccess(true);
    setShowApiKeyInput(false);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <AppIcon name="settings" size={17} className="text-primary" />
            设置
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            数据管理与账户设置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* API Key 配置 */}
          <div className="space-y-3 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <AppIcon name="key" size={17} className="text-primary" />
                DeepSeek API Key
              </div>
              <span className="text-xs font-mono text-foreground/60">{maskApiKey(apiKey)}</span>
            </div>
            {showSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                <Check className="w-3.5 h-3.5" />
                API Key 已保存
              </div>
            )}
            {showApiKeyInput ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="输入新的 API Key (sk-...)"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    className="flex-1"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!inputKey.trim()}
                    size="sm"
                    className="shrink-0"
                  >
                    保存
                  </Button>
                </div>
                <button
                  onClick={() => { setShowApiKeyInput(false); setInputKey(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all cursor-pointer border border-dashed border-border/40 hover:border-border"
              >
                <AppIcon name="key" size={17} />
                {apiKey ? '覆盖 API Key' : '配置 API Key'}
              </button>
            )}
            {apiKey && !showApiKeyInput && (
              <button
                onClick={() => {
                  if (window.confirm('确定清除当前设备上的 API Key 吗？')) onApiKeyChange('');
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清除本地配置
              </button>
            )}
            <p className="text-[11px] text-muted-foreground/60">
              API Key 仅保存在本地浏览器中，不会上传到云端
            </p>
          </div>

          {demoMode && (
            <div className="pt-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-foreground">演示模式</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-violet-600 bg-violet-50">亮亮 · 30 天</span>
              </div>
              <button
                onClick={onReplayTutorial}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-foreground/70 hover:bg-muted transition-all cursor-pointer border border-dashed border-border/40"
              >
                <PlayCircle className="w-4 h-4" />
                重新播放新手引导
              </button>
              <button
                onClick={() => {
                  if (window.confirm('将恢复亮亮最近 30 天的初始演示数据，确定继续吗？')) onResetDemo?.();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-violet-600 hover:bg-violet-50 transition-all cursor-pointer border border-dashed border-violet-200"
              >
                <AppIcon name="reset" size={17} />
                重置演示数据
              </button>
            </div>
          )}

          {/* 数据管理 */}
          <div className="pt-0 border-t border-border/50 space-y-2">
            <button
              onClick={() => { onClose(); setTimeout(onBatchImport, 150); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all cursor-pointer border border-dashed border-border/40 hover:border-border"
            >
              <AppIcon name="upload" size={17} />
              批量导入历史数据
            </button>
            <button
              onClick={() => { onClose(); setTimeout(onExport, 150); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-all cursor-pointer border border-dashed border-border/40 hover:border-border"
            >
              <AppIcon name="download" size={17} />
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
              <AppIcon name="logout" size={17} />
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
