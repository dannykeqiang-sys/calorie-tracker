import { useState, useRef, useCallback } from 'react';
import { Camera, Image, Loader2, Sparkles, X, CheckCircle, Plus, RefreshCw, ScanLine } from 'lucide-react';
import { analyzeFoodImage, analyzeNutritionLabel, fileToBase64 } from '../../utils/qwen-vl';
import type { VisionFoodItem, NutritionLabelResult } from '../../utils/qwen-vl';
import type { FoodItem, MealType } from '../../types';

interface CameraShutterProps {
  open: boolean;
  apiKey: string;
  onClose: () => void;
  onResult: (items: FoodItem[], mealType: MealType, summary: string) => void;
}

type Phase = 'idle' | 'selecting' | 'analyzing' | 'preview' | 'nutrition-form' | 'success' | 'error';

export default function CameraShutter({ open, apiKey, onClose, onResult }: CameraShutterProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [foods, setFoods] = useState<VisionFoodItem[]>([]);
  const [summary, setSummary] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');

  // 营养成分表模式
  const [nutritionResult, setNutritionResult] = useState<NutritionLabelResult | null>(null);
  const [nutritionGrams, setNutritionGrams] = useState('');
  const [nutritionName, setNutritionName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setError('');
    setPreviewUrl('');
    setFoods([]);
    setSummary('');
    setNutritionResult(null);
    setNutritionGrams('');
    setNutritionName('');
    setPendingFile(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const triggerCamera = () => {
    setPhase('selecting');
    setTimeout(() => cameraInputRef.current?.click(), 100);
  };

  const triggerGallery = () => {
    setPhase('selecting');
    setTimeout(() => galleryInputRef.current?.click(), 100);
  };

  const analyzeAsFood = async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPendingFile(file);
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
  };

  const switchToNutritionLabel = async () => {
    const file = pendingFile;
    if (!file) return;
    setPhase('analyzing');

    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeNutritionLabel(apiKey, base64);
      setNutritionResult(result);
      setNutritionName(result.foodName);
      setNutritionGrams('');
      setPhase('nutrition-form');
    } catch (err: any) {
      setError(err.message || '识别失败');
      setPhase('error');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setPhase('idle'); return; }

    await analyzeAsFood(file);

    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
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

  const handleNutritionConfirm = () => {
    if (!nutritionResult) return;
    const grams = parseFloat(nutritionGrams) || 0;
    if (grams <= 0) return;

    const ratio = grams / 100;
    const name = nutritionName.trim() || nutritionResult.foodName;

    const item: FoodItem = {
      id: crypto.randomUUID(),
      name: `${name} (${grams}g)`,
      calories: Math.round(nutritionResult.per100g.calories * ratio),
      protein: Math.round(nutritionResult.per100g.protein * ratio * 10) / 10,
      carbs: Math.round(nutritionResult.per100g.carbs * ratio * 10) / 10,
      fat: Math.round(nutritionResult.per100g.fat * ratio * 10) / 10,
    };

    onResult([item], mealType, `已记录 ${name} ${grams}g`);
    setPhase('success');
    setTimeout(handleClose, 1600);
  };

  // 编辑预览列表中的单个食物
  const updateFoodItem = (index: number, field: keyof VisionFoodItem, value: string) => {
    setFoods(prev => prev.map((f, i) => {
      if (i !== index) return f;
      const num = parseFloat(value);
      return { ...f, [field]: isNaN(num) ? (value || (f as any)[field]) : num };
    }));
  };

  if (!open) return null;

  const isAnalyzing = phase === 'analyzing';
  const isNutritionMode = phase === 'nutrition-form';

  return (
    <>
      {/* 相机拍照输入 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* 相册选择输入 */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
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
              style={{ background: isNutritionMode
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
            >
              {isNutritionMode ? (
                <ScanLine className="w-4.5 h-4.5 text-white" />
              ) : (
                <Camera className="w-4.5 h-4.5 text-white" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {isNutritionMode ? '营养成分表识别' : 'AI 视觉识别'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isNutritionMode ? '输入克数自动折算' : '拍照或从相册选择'}
              </p>
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
          {/* Idle: 拍照 / 相册 */}
          {!isAnalyzing && phase !== 'preview' && phase !== 'nutrition-form' && phase !== 'success' && phase !== 'error' && (
            <>
              {/* 拍照 */}
              <div
                className="rounded-2xl p-6 text-center border-2 border-dashed border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)' }}
                onClick={triggerCamera}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    animation: 'shutter-breathe 2.5s ease-in-out infinite',
                  }}
                >
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold" style={{ color: '#7c3aed' }}>拍照识别</p>
                <p className="text-xs text-muted-foreground mt-1">AI 自动识别食物或营养成分表</p>
              </div>

              {/* 相册 */}
              <div
                className="rounded-2xl p-4 text-center border-2 border-dashed border-blue-200 hover:border-blue-400 transition-colors cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}
                onClick={triggerGallery}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                >
                  <Image className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-semibold" style={{ color: '#2563eb' }}>从相册选择</p>
                <p className="text-xs text-muted-foreground mt-0.5">上传已有照片，同样智能识别</p>
              </div>
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
                    <span className="text-sm text-white/90 font-medium">AI 正在识别...</span>
                    <span className="text-xs text-white/60">分析图片内容中</span>
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
                <button onClick={() => { setPhase('idle'); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  <RefreshCw className="w-4 h-4" />重试
                </button>
              </div>
            </>
          )}

          {/* 营养标签表单 */}
          {phase === 'nutrition-form' && nutritionResult && (
            <>
              <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7' }}>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#059669' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#065f46' }}>{nutritionResult.foodName}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#047857' }}>
                      每100g：{nutritionResult.per100g.calories}kcal ｜
                      蛋白 {nutritionResult.per100g.protein}g ｜
                      碳水 {nutritionResult.per100g.carbs}g ｜
                      脂肪 {nutritionResult.per100g.fat}g
                    </p>
                    {nutritionResult.note && (
                      <p className="text-xs mt-1" style={{ color: '#065f46', opacity: 0.7 }}>{nutritionResult.note}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">食物名称</label>
                  <input
                    type="text"
                    value={nutritionName}
                    onChange={e => setNutritionName(e.target.value)}
                    placeholder={nutritionResult.foodName}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-white/80 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">
                    你摄入了多少克？
                    <span className="text-muted-foreground font-normal ml-1">（按每100g的营养成分折算）</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={nutritionGrams}
                      onChange={e => setNutritionGrams(e.target.value)}
                      placeholder="例如：75"
                      min="1"
                      max="9999"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-white/80 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-400 transition-colors pr-12"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">g</span>
                  </div>
                </div>

                {nutritionGrams && parseFloat(nutritionGrams) > 0 && (
                  <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#166534' }}>预计营养摄入</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-emerald-700 border border-emerald-200">
                        🔥 {Math.round(nutritionResult.per100g.calories * parseFloat(nutritionGrams) / 100)} kcal
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-blue-700 border border-blue-200">
                        蛋白 {(nutritionResult.per100g.protein * parseFloat(nutritionGrams) / 100).toFixed(1)}g
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-orange-700 border border-orange-200">
                        碳水 {(nutritionResult.per100g.carbs * parseFloat(nutritionGrams) / 100).toFixed(1)}g
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-purple-700 border border-purple-200">
                        脂肪 {(nutritionResult.per100g.fat * parseFloat(nutritionGrams) / 100).toFixed(1)}g
                      </span>
                    </div>
                  </div>
                )}
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
                <button onClick={() => { setPhase('idle'); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />重拍
                </button>
                <button
                  onClick={handleNutritionConfirm}
                  disabled={!nutritionGrams || parseFloat(nutritionGrams) <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Plus className="w-4 h-4" />确认录入
                </button>
              </div>
            </>
          )}

          {/* Preview: 食物识别结果 */}
          {phase === 'preview' && (
            <>
              {/* AI Summary */}
              <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1px solid #c4b5fd' }}>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8b5cf6' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#5b21b6' }}>{summary}</p>
                </div>
              </div>

              {/* 切换为营养成分表 */}
              <button
                onClick={switchToNutritionLabel}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer border border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50"
                style={{ color: '#059669' }}
              >
                <ScanLine className="w-3.5 h-3.5" />
                识别的是营养成分表？点此切换
              </button>

              {/* Food capsules with edit */}
              <div className="space-y-1.5">
                {foods.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2.5 rounded-xl border bg-white/80"
                    style={{ borderColor: 'rgba(139,92,246,0.15)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                      <span className="text-xs text-white font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="text"
                        value={f.name}
                        onChange={e => updateFoodItem(i, 'name', e.target.value)}
                        className="w-full text-sm font-semibold text-foreground bg-transparent border-none outline-none"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">kcal</span>
                          <input
                            type="number"
                            value={f.calories || ''}
                            onChange={e => updateFoodItem(i, 'calories', e.target.value)}
                            className="w-14 text-xs font-bold tabular-nums bg-purple-50 rounded-md px-1.5 py-0.5 border border-purple-100 outline-none focus:border-purple-300"
                            style={{ color: '#8b5cf6' }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">P</span>
                        <input
                          type="number"
                          value={f.protein ?? ''}
                          onChange={e => updateFoodItem(i, 'protein', e.target.value)}
                          className="w-10 text-[10px] bg-blue-50 rounded-md px-1 py-0.5 border border-blue-100 outline-none focus:border-blue-300 text-blue-600"
                        />
                        <span className="text-[10px] text-muted-foreground">C</span>
                        <input
                          type="number"
                          value={f.carbs ?? ''}
                          onChange={e => updateFoodItem(i, 'carbs', e.target.value)}
                          className="w-10 text-[10px] bg-orange-50 rounded-md px-1 py-0.5 border border-orange-100 outline-none focus:border-orange-300 text-orange-600"
                        />
                        <span className="text-[10px] text-muted-foreground">F</span>
                        <input
                          type="number"
                          value={f.fat ?? ''}
                          onChange={e => updateFoodItem(i, 'fat', e.target.value)}
                          className="w-10 text-[10px] bg-purple-50 rounded-md px-1 py-0.5 border border-purple-100 outline-none focus:border-purple-300 text-purple-600"
                        />
                      </div>
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
                <button onClick={() => { setPhase('idle'); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />重拍
                </button>
                <button onClick={handleConfirm} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer active:scale-95" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  <Plus className="w-4 h-4" />确认录入
                </button>
              </div>
            </>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-semibold text-foreground">记录成功！</p>
              <p className="text-xs text-muted-foreground">数据已即刻保存</p>
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
