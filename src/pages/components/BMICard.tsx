import type { UserProfile } from '../../types';
import { calcBMI, calcBMR, calcTDEE, calcTargetCalories } from '../../utils/calculations';
import { Activity, Zap, Target, Scale } from 'lucide-react';

interface BMICardProps {
  profile: UserProfile;
}

const GOAL_LABELS = { lose: '减脂模式', maintain: '维持模式', gain: '增肌模式' };
const ACTIVITY_LABELS = {
  sedentary: '久坐',
  light: '轻度活动',
  moderate: '中度活动',
  active: '活跃',
  very_active: '高强度',
};

function BMIGauge({ value }: { value: number }) {
  const min = 15;
  const max = 35;
  const clamped = Math.max(min, Math.min(max, value));
  const pct = ((clamped - min) / (max - min)) * 100;

  const getColor = (bmi: number) => {
    if (bmi < 18.5) return '#7CB9E8';
    if (bmi < 24) return '#A3B899';
    if (bmi < 28) return '#EBB193';
    return '#E07878';
  };

  const color = getColor(value);

  return (
    <div className="relative mt-2">
      <div className="h-3 rounded-full overflow-hidden" style={{
        background: 'linear-gradient(to right, #7CB9E8 0%, #A3B899 25%, #A3B899 55%, #EBB193 70%, #E07878 100%)',
      }}>
        <div />
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-700"
        style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color }}
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
        <span>偏瘦</span>
        <span>正常</span>
        <span>超重</span>
        <span>肥胖</span>
      </div>
    </div>
  );
}

export default function BMICard({ profile }: BMICardProps) {
  const bmi = calcBMI(profile.weight, profile.height);
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(profile);
  const target = calcTargetCalories(profile);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">身体指数分析</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {profile.name} · {ACTIVITY_LABELS[profile.activityLevel]} · {GOAL_LABELS[profile.goal]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5" style={{ color: bmi.color }} />
            <span className="text-xs text-muted-foreground">BMI 指数</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: bmi.color }}>{bmi.value}</p>
          <p className="text-xs mt-0.5" style={{ color: bmi.color }}>{bmi.category}</p>
          <BMIGauge value={bmi.value} />
        </div>

        <div className="grid grid-rows-3 gap-2">
          <div className="rounded-xl bg-muted/50 border border-border/50 p-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">基础代谢</p>
              <p className="text-sm font-bold text-primary">{bmr} <span className="text-xs font-normal">kcal</span></p>
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border/50 p-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/15 flex items-center justify-center flex-shrink-0">
              <Activity className="w-3.5 h-3.5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">总消耗TDEE</p>
              <p className="text-sm font-bold text-secondary">{tdee} <span className="text-xs font-normal">kcal</span></p>
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border/50 p-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Target className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">今日目标</p>
              <p className="text-sm font-bold text-amber-500">{target} <span className="text-xs font-normal">kcal</span></p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center bg-muted/50 rounded-lg py-2 px-3 border border-border/50">
        {bmi.description}
      </p>
    </div>
  );
}
