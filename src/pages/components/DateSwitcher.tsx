import { useRef, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface DateSwitcherProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

function getRecentDates(count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDateChip(dateStr: string): { day: string; label: string; isToday: boolean } {
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(dateStr + 'T00:00:00');
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  return {
    day: String(d.getDate()),
    label: dateStr === today ? '今' : WEEKDAYS[d.getDay()],
    isToday: dateStr === today,
  };
}

export default function DateSwitcher({ selectedDate, onDateChange }: DateSwitcherProps) {
  const allDates = getRecentDates(14);
  const recentDates = allDates.slice(7);
  const olderDates = allDates.slice(0, 7);
  const [showOlder, setShowOlder] = useState(false);

  const visibleDates = showOlder ? allDates : recentDates;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idx = visibleDates.indexOf(selectedDate);
    if (idx < 0 || !scrollRef.current) return;
    const children = scrollRef.current.children;
    const targetChild = children[idx];
    if (targetChild) {
      (targetChild as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedDate, visibleDates, showOlder]);

  const selectedIsOlder = olderDates.includes(selectedDate);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setShowOlder(v => !v)}
        className="flex-shrink-0 flex flex-col items-center justify-center w-8 h-9 rounded-xl transition-all cursor-pointer active:scale-90 border border-border/60"
        style={{
          backgroundColor: selectedIsOlder ? 'var(--primary)' : 'var(--ck-surface-medium)',
          color: selectedIsOlder ? 'white' : 'var(--muted-foreground)',
        }}
        title={showOlder ? '收起' : '查看更早日期'}
      >
        <ChevronLeft
          className="w-3 h-3"
          style={{ transform: showOlder ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
        />
        <span className="text-[8px] font-medium leading-none mt-0.5">{showOlder ? '收' : '早'}</span>
      </button>

      <div
        ref={scrollRef}
        className="date-switcher-scroll flex gap-1 overflow-x-auto flex-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {visibleDates.map(date => {
          const { day, label, isToday } = formatDateChip(date);
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              onClick={() => onDateChange(date)}
              className="flex flex-col items-center flex-shrink-0 w-9 py-1 rounded-xl transition-all cursor-pointer active:scale-90"
              style={{
                backgroundColor: isSelected
                  ? 'var(--primary)'
                  : isToday
                  ? 'rgba(163,184,153,0.18)'
                  : 'var(--ck-surface-subtle)',
                color: isSelected
                  ? 'white'
                  : isToday
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)',
                border: isSelected
                  ? 'none'
                  : isToday
                  ? '1px solid rgba(163,184,153,0.45)'
                  : '1px solid var(--border)',
                boxShadow: isSelected ? '0 2px 6px rgba(163,184,153,0.38)' : 'none',
              }}
            >
              <span className="text-[9px] font-medium leading-none mb-1">{label}</span>
              <span className="text-[13px] font-bold leading-none">{day}</span>
            </button>
          );
        })}
      </div>
      <style>{`.date-switcher-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
