import { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { loadWeightRecords } from './TodayWeightCard';
import WeightRecordModal from './WeightRecordModal';
import WeightRecordCelebration from './WeightRecordCelebration';

const WEIGHT_KEY = 'calorie_weight_records';

function saveWeightForDate(date: string, weight: number) {
  try {
    const all = loadWeightRecords();
    all[date] = weight;
    localStorage.setItem(WEIGHT_KEY, JSON.stringify(all));
  } catch {}
}

interface WeightChipProps {
  journalDate: string;
}

export default function WeightChip({ journalDate }: WeightChipProps) {
  const [weight, setWeight] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [celebration, setCelebration] = useState<{ weight: number; previousWeight?: number } | null>(null);

  useEffect(() => {
    const records = loadWeightRecords();
    setWeight(records[journalDate] ?? null);
  }, [journalDate]);

  const handleSave = (val: number, previousWeight: number | undefined) => {
    setWeight(val);
    saveWeightForDate(journalDate, val);
    setCelebration({ weight: val, previousWeight });
  };

  const hasWeight = weight !== null;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl cursor-pointer active:scale-95 transition-all flex-shrink-0 whitespace-nowrap"
        style={hasWeight ? {
          background: 'linear-gradient(135deg, #A3B899, #7CB9E8)',
          boxShadow: '0 2px 8px rgba(163,184,153,0.45)',
        } : {
          background: 'var(--ck-surface-medium)',
          border: '1.5px dashed var(--border)',
        }}
      >
        <Scale
          className="w-3 h-3 flex-shrink-0"
          style={{ color: hasWeight ? 'rgba(255,255,255,0.9)' : 'var(--muted-foreground)' }}
        />
        {hasWeight ? (
          <span className="text-xs font-bold tabular-nums text-white">{weight} kg</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">体重</span>
        )}
      </button>

      <WeightRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        journalDate={journalDate}
      />

      {celebration && (
        <WeightRecordCelebration
          weight={celebration.weight}
          previousWeight={celebration.previousWeight}
          onDismiss={() => setCelebration(null)}
        />
      )}
    </>
  );
}
