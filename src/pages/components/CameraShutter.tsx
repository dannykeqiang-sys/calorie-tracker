import { useState, useRef, useCallback } from 'react';
import { Camera, Image, Loader2, Sparkles, X, CheckCircle, Plus, RefreshCw } from 'lucide-react';
import { analyzeFoodImage, fileToBase64 } from '../../utils/qwen-vl';
import type { VisionFoodItem } from '../../utils/qwen-vl';
import type { FoodItem, MealType } from '../../types';

interface CameraShutterProps {
  open: boolean;
  apiKey: string;
  onClose: () => void;
  onResult: (items: FoodItem[], mealType: MealType, summary: string) => void;
}

type Phase = 'idle' | 'selecting' | 'analyzing' | 'preview' | 'success' | 'error';

export default function CameraShutter({ open, apiKey, onClose, onResult }: CameraShutterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [foods, setFoods] = useState<VisionFoodItem[]>([]);
  const [summary, setSummary] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');

  const reset = useCallback(() => {
    setPhase('idle');
    setError('');
    setPreviewUrl('');
    setFoods([]);
    setSummary('');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const triggerCapture = () => {
    setPhase('selecting');
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setPhase('idle'); return; }

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPhase('analyzing');

    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeFoodImage(apiKey, base64);
      setFoods(result.foods);
      setSummary(result.summary);
      setMealType(
        (result.mealTypeHint === 'breakfast' || result.mealTypeHint === 'lunch' ||
         result.mealTypeHint === 'dinner' || result.mealTypeHint === 'snack')
          ? result.mealTypeHint : 'lunch'
      );
      setPhase('preview');
    } catch (err: any) {
      setError(err.message || '识别失败');
      setPhase('error');
    }

    // Reset input for re-capture
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirm = () => {
    const items: FoodItem[] = foods.map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
    }));
    onResult(items, mealType, summary);
    setPhase('success');
    setTimeout(handleClose, 1600);
  };

  if (!open) return null;

  const isAnalyzing = phase === 'analyzing';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          maxHeight: '92vh',
          animation: 'shutter-up 0.32s cubic-bezier(0.4,0,0.2,1) both',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.18), 0 -2px 8px rgba(0,0,0,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
            >
              <Camera className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">AI 视觉识别</p>
              <p className="text-xs text-muted-foreground">拍照分析食物营养</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-border/40 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-4">
          {/* Idle / Selecting */}
          {!isAnalyzing && phase !== 'preview' && phase !== 'success' && phase !== 'error' && (
            <>
              <div
                className="rounded-2xl p-8 text-center border-2 border-dashed border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)' }}
                onClick={triggerCapture}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    animation: 'shutter-breathe 2.5s ease-in-out infinite',
                  }}
                >
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <p className="text-sm font-semibold" style={{ color: '#7c3aed' }}>点击拍照识别食物</p>
                <p className="text-xs text-muted-foreground mt-1.5">AI 会自动识别食物名称、热量和营养素</p>
              </div>

              <button
                onClick={triggerCapture}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', boxShadow: '0 6px 20px rgba(139,92,246,0.35)' }}
              >
                <Camera className="w-4 h-4" />
                打开相机
              </button>
            </>
          )}

          {/* Analyzing */}
          {isAnalyzing && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative w-48 h-48 rounded-2xl overflow-hidden">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="w-full h-full object-cover animate-pulse"
                    style={{ filter: 'blur(8px)', transition: 'filter 0.6s ease' }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                    <span className="text-sm text-white/90 font-medium">AI 正在扫描食物...</span>
                    <span className="text-xs text-white/60">识别营养成分中</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <>
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">取消</button>
                <button onClick={triggerCapture} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  <RefreshCw className="w-4 h-4" />重试
                </button>
              </div>
            </>
          )}

          {/* Preview */}
          {phase === 'preview' && (
            <>
              {/* AI Summary */}
              <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1px solid #c4b5fd' }}>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8b5cf6' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#5b21b6' }}>{summary}</p>
                </div>
              </div>

              {/* Food capsules */}
              <div className="space-y-1.5">
                {foods.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-full border bg-white/80"
                    style={{ borderColor: 'rgba(139,92,246,0.15)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                      <span className="text-xs text-white font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                      {f.grams && <p className="text-xs text-muted-foreground">约 {f.grams}g</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {f.protein != null && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">蛋白{f.protein}g</span>
                      )}
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#8b5cf6' }}>{f.calories} kcal</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Meal type selector */}
              <div className="rounded-xl bg-muted/20 p-1 flex gap-1">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(mt => {
                  const labels: Record<MealType, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
                  const isActive = mealType === mt;
                  return (
                    <button
                      key={mt}
                      onClick={() => setMealType(mt)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      style={isActive ? { background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white' } : { color: 'var(--muted-foreground)' }}
                    >
                      {labels[mt]}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={triggerCapture} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"><RefreshCw className="w-4 h-4" />重拍</button>
                <button onClick={handleConfirm} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  <Plus className="w-4 h-4" />确认录入
                </button>
              </div>
            </>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">记录成功！</p>
              <p className="text-xs text-muted-foreground">{foods.length} 项食物已添加</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shutter-up {
          from { opacity: 0; transform: translateY(48px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shutter-breathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
          50% { box-shadow: 0 0 0 16px rgba(139,92,246,0); }
        }
      `}</style>
    </>
  );
}
