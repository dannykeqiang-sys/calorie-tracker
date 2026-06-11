import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { estimateCalories } from '../../utils/deepseek';
import { safeNormalizeString } from '../../utils/stringUtils';

interface VoiceInputButtonProps {
  apiKey: string;
  color?: string;
  onResult: (foodName: string, calories: number, reason: string) => void;
}

type Status = 'idle' | 'listening' | 'processing' | 'done' | 'error';

declare class WebkitSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } }; isFinal: boolean } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

const isSpeechSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

const BAR_COUNT = 12;
const BAR_HEIGHTS = [0.3, 0.5, 0.8, 1.0, 0.7, 0.5, 0.9, 0.6, 1.0, 0.7, 0.4, 0.6];

export default function VoiceInputButton({ apiKey, color = '#A3B899', onResult }: VoiceInputButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const recognitionRef = useRef<WebkitSpeechRecognition | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number>(0);
  const [barScales, setBarScales] = useState<number[]>(Array(BAR_COUNT).fill(0.15));
  const statusRef = useRef<Status>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const animateBars = () => {
    setBarScales(prev =>
      prev.map((_, i) => {
        const base = BAR_HEIGHTS[i];
        const jitter = (Math.random() - 0.5) * 0.5;
        return Math.max(0.15, Math.min(1.0, base + jitter));
      })
    );
    animFrameRef.current = requestAnimationFrame(() => {
      setTimeout(animateBars, 80);
    });
  };

  const startListening = () => {
    if (!isSpeechSupported()) {
      showToast('当前浏览器不支持语音识别，请使用 Chrome');
      return;
    }
    if (!apiKey) {
      showToast('请先在设置中填写 DeepSeek API Key');
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition: typeof WebkitSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof WebkitSpeechRecognition }).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    setStatus('listening');

    animateBars();

    recognition.onresult = async (e) => {
      cancelAnimationFrame(animFrameRef.current);
      const text = safeNormalizeString(e.results[0][0].transcript);
      setStatus('processing');
      try {
        const result = await estimateCalories(apiKey, text);
        setStatus('done');
        onResult(safeNormalizeString(result.food_name), result.calories, safeNormalizeString(result.reason));
        showToast(`听到了～ AI 估算约 ${result.calories} kcal，已自动填入`);
        setTimeout(() => setStatus('idle'), 1500);
      } catch {
        setStatus('error');
        showToast('AI 估算失败，已填入食物名称，请手动输入卡路里');
        onResult(text, 0, '');
        setTimeout(() => setStatus('idle'), 2000);
      }
    };

    recognition.onerror = () => {
      cancelAnimationFrame(animFrameRef.current);
      setStatus('idle');
      showToast('语音识别失败，请重试');
    };

    recognition.onend = () => {
      cancelAnimationFrame(animFrameRef.current);
      if (statusRef.current === 'listening') setStatus('idle');
    };

    recognition.start();
  };

  const stopListening = () => {
    cancelAnimationFrame(animFrameRef.current);
    recognitionRef.current?.stop();
    if (statusRef.current === 'listening') setStatus('idle');
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPressed(true);
    holdTimerRef.current = setTimeout(() => {
      if (statusRef.current === 'idle') startListening();
    }, 200);
  };

  const handlePointerUp = () => {
    setPressed(false);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (statusRef.current === 'listening') stopListening();
  };

  const handleClick = () => {
    if (status === 'idle') startListening();
    else if (status === 'listening') stopListening();
  };

  const isListening = status === 'listening';
  const isProcessing = status === 'processing';

  return (
    <div className="relative w-full">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        disabled={isProcessing}
        className="relative w-full h-10 rounded-xl flex items-center justify-center gap-2 overflow-hidden transition-all duration-200 cursor-pointer select-none touch-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        style={{
          backgroundColor: isListening ? `${color}25` : pressed ? `${color}18` : `${color}10`,
          border: `1.5px solid ${isListening ? color : `${color}40`}`,
          boxShadow: isListening ? `0 0 0 3px ${color}20, 0 2px 8px ${color}30` : 'none',
        }}
      >
        {isListening ? (
          <div className="flex items-end gap-0.5 h-5">
            {barScales.map((scale, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full"
                style={{
                  backgroundColor: color,
                  height: `${scale * 20}px`,
                  transition: 'height 0.08s ease',
                  opacity: 0.6 + scale * 0.4,
                }}
              />
            ))}
          </div>
        ) : isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
        ) : (
          <Mic className="w-4 h-4 flex-shrink-0" style={{ color }} />
        )}

        <span
          className="text-xs font-medium select-none"
          style={{ color: isListening ? color : `${color}cc` }}
        >
          {isListening ? '松开结束录音' : isProcessing ? 'AI 识别中...' : '长按说出食物'}
        </span>
      </button>

      {toast && (
        <div
          className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-white rounded-xl shadow-lg border border-border px-3 py-2 text-xs text-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ borderLeft: `3px solid ${color}` }}
        >
          {toast}
        </div>
      )}

      {isListening && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-white rounded-xl shadow-lg border border-border px-3 py-2 text-xs text-muted-foreground animate-in fade-in duration-300">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5 animate-pulse" style={{ backgroundColor: '#EF4444' }} />
          请说，我在听...（如：午餐吃了牛肉面）
        </div>
      )}
    </div>
  );
}
