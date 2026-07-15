import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Scale, X } from 'lucide-react';
import { loadWeightRecords } from './TodayWeightCard';

const HEADINGS = [
  '今天的你，多少公斤？',
  '量一量，爱自己的第一步',
  '每一克，都是认真生活的证明',
  '记录，是与自己的温柔约定',
];

const SUBS = [
  '数字只是参考，你永远比它更重要',
  '无论多少，你都值得被好好对待',
  '了解自己，才能更好地照顾自己',
  '每次记录，都是对身体的一次倾听',
];

interface WeightRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (weight: number, previousWeight: number | undefined) => void;
  journalDate: string;
}

export default function WeightRecordModal({ open, onClose, onSave, journalDate }: WeightRecordModalProps) {
  const [inputVal, setInputVal] = useState('');
  const [shake, setShake] = useState(false);
  const [visible, setVisible] = useState(false);
  const [previousWeight, setPreviousWeight] = useState<number | undefined>(undefined);
  const [currentWeight, setCurrentWeight] = useState<number | undefined>(undefined);
  const [heading] = useState(() => HEADINGS[Math.floor(Math.random() * HEADINGS.length)]);
  const [sub] = useState(() => SUBS[Math.floor(Math.random() * SUBS.length)]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const records = loadWeightRecords();
    const cur = records[journalDate];
    setCurrentWeight(cur);
    setInputVal(cur !== undefined ? String(cur) : '');

    const yesterday = new Date(journalDate + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().split('T')[0];
    setPreviousWeight(records[yKey]);

    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, [open, journalDate]);

  const closeModal = () => {
    setVisible(false);
    setTimeout(onClose, 360);
  };

  const handleConfirm = () => {
    const val = parseFloat(inputVal);
    if (!inputVal || isNaN(val) || val < 20 || val > 300) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    onSave(val, previousWeight);
    closeModal();
  };

  const parsedInput = parseFloat(inputVal);
  const diff = previousWeight !== undefined && !isNaN(parsedInput)
    ? +(parsedInput - previousWeight).toFixed(1)
    : null;

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{
        background: visible ? 'rgba(0,0,0,0.52)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(5px)' : 'none',
        transition: 'background 0.35s ease, backdrop-filter 0.35s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        className="w-full max-w-lg overflow-hidden"
        style={{
          borderRadius: '26px 26px 0 0',
          background: 'var(--card)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.42s cubic-bezier(0.34,1.10,0.64,1)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
        }}
      >
        <div className="flex justify-center pt-4">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex justify-end px-5 pt-2">
          <button
            onClick={closeModal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center px-6 pt-2 pb-8">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
            style={{
              background: 'linear-gradient(135deg, #A3B899 0%, #7CB9E8 100%)',
              boxShadow: '0 10px 36px rgba(163,184,153,0.52), 0 3px 10px rgba(124,185,232,0.38)',
            }}
          >
            <Scale className="w-9 h-9 text-white" />
          </div>

          <h2 className="text-xl font-bold text-foreground text-center mb-2 leading-snug">{heading}</h2>
          <p className="text-sm text-muted-foreground text-center mb-7 leading-relaxed max-w-[260px]">{sub}</p>

          <div className={`flex items-baseline justify-center mb-2 ${shake ? 'animate-[weightShake_0.45s_ease]' : ''}`}>
            <input
              autoFocus
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') closeModal();
              }}
              placeholder="0.0"
              step="0.1"
              min="20"
              max="300"
              className="text-center text-6xl font-black tabular-nums outline-none bg-transparent border-b-[3px] pb-1 w-36 transition-colors"
              style={{
                borderColor: inputVal ? '#A3B899' : '#E5E7EB',
                color: '#1F2937',
                caretColor: '#A3B899',
              }}
            />
            <span className="text-2xl font-bold ml-2" style={{ color: '#9CA3AF' }}>kg</span>
          </div>

          <div className="h-7 flex items-center justify-center mb-6">
            {previousWeight !== undefined ? (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                昨天 {previousWeight} kg
                {diff !== null && diff !== 0 && (
                  <span
                    className="ml-2 font-semibold transition-all"
                    style={{ color: diff < 0 ? '#22C55E' : '#F97316' }}
                  >
                    {diff < 0 ? '▼' : '▲'} {Math.abs(diff)} kg
                  </span>
                )}
                {diff === 0 && (
                  <span className="ml-2 font-semibold" style={{ color: '#7CB9E8' }}>持平</span>
                )}
              </p>
            ) : (
              <p className="text-sm" style={{ color: '#D1D5DB' }}>
                {currentWeight !== undefined ? '修改今日体重' : '开始记录体重旅程'}
              </p>
            )}
          </div>

          <button
            onClick={handleConfirm}
            className="w-full h-14 rounded-2xl text-lg font-bold cursor-pointer transition-all duration-300 active:scale-[0.97]"
            style={{
              background: inputVal
                ? 'linear-gradient(135deg, #A3B899 0%, #7CB9E8 100%)'
                : '#F3F4F6',
              boxShadow: inputVal ? '0 10px 28px rgba(163,184,153,0.48)' : 'none',
              color: inputVal ? 'white' : '#9CA3AF',
            }}
          >
            {currentWeight !== undefined ? '更新体重' : '记录今日体重'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes weightShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );

  return createPortal(modal, document.body);
}
