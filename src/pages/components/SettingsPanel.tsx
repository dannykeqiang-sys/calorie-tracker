import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Label } from '@/components/shadcn/label';
import { Eye, EyeOff, Key, ExternalLink, LogOut, Download, Upload } from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  apiKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
  onLogout: () => void;
  onExport: () => void;
  onBatchImport: () => void;
}

export default function SettingsPanel({ open, apiKey, onClose, onSave, onLogout, onExport, onBatchImport }: SettingsPanelProps) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave(inputKey.trim());
    onClose();
  };

  const maskedKey = inputKey
    ? inputKey.slice(0, 6) + '•'.repeat(Math.max(0, inputKey.length - 10)) + inputKey.slice(-4)
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            DeepSeek API 设置
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            配置 API Key 以启用 AI 复盘与语音卡路里估算功能
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-foreground text-sm">API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={e => setInputKey(e.target.value)}
                placeholder="sk-..."
                className="bg-muted border-border text-foreground pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {inputKey && !showKey && (
              <p className="text-xs text-muted-foreground font-mono">{maskedKey}</p>
            )}
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-primary">使用须知</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>API Key 仅存储在本地浏览器，不会上传到任何服务器</li>
              <li>语音卡路里估算（每次约 0.001 元）和 AI 复盘会消耗 API 额度</li>
              <li>在 DeepSeek 官网注册账号可获得免费额度</li>
            </ul>
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              前往获取 API Key
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border cursor-pointer"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              保存配置
            </Button>
          </div>

          <div className="pt-2 border-t border-border/50 space-y-2">
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
