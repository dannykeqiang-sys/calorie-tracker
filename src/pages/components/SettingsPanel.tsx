import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/shadcn/dialog';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Label } from '@/components/shadcn/label';
import { Eye, EyeOff, Key, ExternalLink, LogOut, Download, Upload, Sparkles, Camera } from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  apiKey: string;
  qwenApiKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
  onSaveQwen: (key: string) => void;
  onLogout: () => void;
  onExport: () => void;
  onBatchImport: () => void;
}

export default function SettingsPanel({ open, apiKey, qwenApiKey, onClose, onSave, onSaveQwen, onLogout, onExport, onBatchImport }: SettingsPanelProps) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [inputQwenKey, setInputQwenKey] = useState(qwenApiKey);
  const [showKey, setShowKey] = useState(false);
  const [showQwenKey, setShowQwenKey] = useState(false);

  const handleSave = () => {
    onSave(inputKey.trim());
    onSaveQwen(inputQwenKey.trim());
    onClose();
  };

  const maskedKey = (key: string) => key
    ? key.slice(0, 6) + '•'.repeat(Math.max(0, key.length - 10)) + key.slice(-4)
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            API 设置
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            配置 DeepSeek 和千问视觉 API Key
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* DeepSeek API Key */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              DeepSeek API Key
            </Label>
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
              <p className="text-xs text-muted-foreground font-mono">{maskedKey(inputKey)}</p>
            )}
            <p className="text-[10px] text-muted-foreground/50">用于 AI 对话、食物文本解析、批量导入等文字类 AI 功能</p>
          </div>

          {/* Qwen Vision API Key */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-purple-500" />
              千问视觉 API Key
            </Label>
            <div className="relative">
              <Input
                type={showQwenKey ? 'text' : 'password'}
                value={inputQwenKey}
                onChange={e => setInputQwenKey(e.target.value)}
                placeholder="sk-..."
                className="bg-muted border-border text-foreground pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowQwenKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                {showQwenKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {inputQwenKey && !showQwenKey && (
              <p className="text-xs text-muted-foreground font-mono">{maskedKey(inputQwenKey)}</p>
            )}
            <p className="text-[10px] text-muted-foreground/50">用于拍照识别食物，仅此功能使用千问 Vision API</p>
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-primary">使用须知</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>API Key 仅存储在本地浏览器，不会上传到任何服务器</li>
              <li>DeepSeek 用于 AI 对话和文字解析；千问 Vision 仅用于拍照识图</li>
              <li>拍照识别食物（每次约 0.003 元），AI 文字解析消耗 DeepSeek 额度</li>
            </ul>
            <div className="flex gap-3 pt-1">
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                DeepSeek 控制台
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://bailian.console.aliyun.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-500 hover:underline"
              >
                百炼控制台
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
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
