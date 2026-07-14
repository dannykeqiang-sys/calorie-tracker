import { useState } from 'react';
import { Activity, Zap, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react';
import type { DailyRecord, FoodItem, UserProfile } from '../../types';
import { calcTargetCalories, calcMacroTargets, getDefaultMacroTargets } from '../../utils/calculations';
import MacroRingChart from './MacroRingChart';

const ANTI_KW = [
  '蔬菜', '菠菜', '西兰花', '芹菜', '胡萝卜', '番茄', '西红柿', '黄瓜', '生菜',
  '牛油果', '鳄梨', '三文鱼', '金枪鱼', '鳕鱼', '沙丁鱼', '带鱼', '深海鱼',
  '核桃', '杏仁', '腰果', '亚麻籽', '蓝莓', '草莓', '橙子', '苹果', '猕猴桃',
  '豆腐', '豆浆', '燕麦', '全麦', '红豆', '黑豆', '绿茶', '橄榄油',
];

const PRO_KW = [
  '炸鸡', '薯条', '炸薯', '汉堡', '披萨', '饼干', '蛋糕', '奶油', '甜甜圈',
  '可乐', '雪碧', '含糖饮料', '奶茶', '香肠', '培根', '腊肉', '腊肠', '烤串', '火腿肠',
];

function calcInflammationScore(foods: FoodItem[]): number {
  if (foods.length === 0) return -1;
  let keywordAdj = 0;
  for (const food of foods) {
    const n = food.name;
    if (ANTI_KW.some(kw => n.includes(kw))) keywordAdj += 6;
    if (PRO_KW.some(kw => n.includes(kw))) keywordAdj -= 10;
  }
  keywordAdj = Math.max(-30, Math.min(30, keywordAdj));
  let score = 50 + keywordAdj;
  const totalCal = foods.reduce((s, f) => s + f.calories, 0);
  if (totalCal > 100) {
    const carbCal = foods.reduce((s, f) => s + (f.carbs ?? 0) * 4, 0);
    const carbRatio = carbCal / totalCal;
    if (carbRatio > 0.65) score -= 8;
    if (carbRatio < 0.4) score += 5;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreInfo(score: number): { label: string; color: string; desc: string } {
  if (score < 0) return { label: '暂无数据', color: '#9CA3AF', desc: '记录今日饮食后查看你的炎症指数' };
  if (score >= 75) return { label: '优秀抗炎', color: '#16A34A', desc: '今日饮食以抗炎食物为主，身体在悄悄感谢你' };
  if (score >= 55) return { label: '较好抗炎', color: '#65A30D', desc: '饮食结构不错，多吃深色蔬菜会更好' };
  if (score >= 40) return { label: '中性平衡', color: '#D97706', desc: '可以增加蔬菜和优质蛋白的比例' };
  return { label: '偏高炎症', color: '#DC2626', desc: '减少加工食品，多吃蔬果和深海鱼' };
}

const MACRO_REASSURANCE: Record<string, { text: string; tip: string }> = {
  protein: {
    text: '蛋白质稍微超标没关系',
    tip: '运动后多补充蛋白质有助于肌肉修复，今天如果有锻炼就不用担心',
  },
  carbs: {
    text: '碳水今天摄入稍多',
    tip: '可以减少晚餐的精制主食，多选择粗粮或蔬菜替代',
  },
  fat: {
    text: '脂肪略微超标',
    tip: '优先选择坚果、鱼类等优质脂肪来源，减少油炸和加工食品',
  },
};

interface TodayNutritionCardProps {
  record: DailyRecord;
  profile?: UserProfile | null;
}

interface MacroRowProps {
  label: string;
  actual: number;
  target: number;
  color: string;
  hasData: boolean;
  foods?: FoodItem[];
  macroKey?: 'protein' | 'carbs' | 'fat';
}

function MacroRow({ label, actual, target, color, hasData, foods, macroKey }: MacroRowProps) {
  const [expanded, setExpanded] = useState(false);
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const isOver = actual > target && target > 0;
  const displayColor = isOver ? '#EF4444' : color;

  const topFoods = isOver && foods && macroKey
    ? [...foods]
        .filter(f => (f[macroKey] ?? 0) > 0)
        .sort((a, b) => (b[macroKey] ?? 0) - (a[macroKey] ?? 0))
        .slice(0, 3)
    : [];

  const reassurance = macroKey ? MACRO_REASSURANCE[macroKey] : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="font-bold tabular-nums" style={{ color: displayColor }}>
            {hasData ? actual : '—'}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-muted-foreground tabular-nums">{target}g</span>
          {isOver && topFoods.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="ml-1 flex items-center gap-0.5 text-[10px] font-semibold cursor-pointer transition-colors"
              style={{ color: displayColor }}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}18` }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: hasData ? `${pct}%` : '0%',
            backgroundColor: displayColor,
          }}
        />
      </div>

      {isOver && expanded && topFoods.length > 0 && reassurance && macroKey && (
        <div
          className="mt-1.5 rounded-xl p-2.5 space-y-2"
          style={{ backgroundColor: `${displayColor}08`, border: `1px solid ${displayColor}20` }}
        >
          <p className="text-[10px] font-semibold" style={{ color: displayColor }}>
            {reassurance.text}，主要来源：
          </p>
          <div className="space-y-1">
            {topFoods.map((food, i) => (
              <div key={food.id ?? i} className="flex items-center justify-between">
                <span className="text-[10px] text-foreground/70 truncate max-w-[60%]">{food.name}</span>
                <span className="text-[10px] tabular-nums font-medium" style={{ color: displayColor }}>
                  {Math.round(food[macroKey] ?? 0)}g
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed pt-0.5 border-t border-border/30">
            {reassurance.tip}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TodayNutritionCard({ record, profile }: TodayNutritionCardProps) {
  const allFoods = Object.values(record.meals).flat();
  const protein = Math.round(allFoods.reduce((s, f) => s + (f.protein ?? 0), 0));
  const carbs = Math.round(allFoods.reduce((s, f) => s + (f.carbs ?? 0), 0));
  const fat = Math.round(allFoods.reduce((s, f) => s + (f.fat ?? 0), 0));
  const intake = Math.round(allFoods.reduce((s, f) => s + f.calories, 0));

  const targetCalories = profile ? calcTargetCalories(profile) : 2000;
  const { proteinTarget, carbsTarget, fatTarget } = profile
    ? calcMacroTargets(profile)
    : getDefaultMacroTargets();

  const activeBurn = Math.round(record.exercises.reduce((s, e) => s + e.calories, 0));
  const netCalories = intake - activeBurn;
  const netRemaining = targetCalories - netCalories;

  const score = calcInflammationScore(allFoods);
  const { label: scoreLabel, color: scoreColor, desc: scoreDesc } = getScoreInfo(score);
  const hasData = allFoods.length > 0;
  const hasAnyData = hasData || activeBurn > 0;

  const indicatorPct = score >= 0 ? Math.max(3, Math.min(97, 100 - score)) : 50;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F97316, #6366F1)' }}
          >
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-sm font-bold text-foreground">今日营养概览</p>
          {!hasData && (
            <span className="ml-auto text-[10px] text-muted-foreground/50">记录饮食后查看</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,240px)_1fr] gap-3 items-start">
          <div className="min-w-0 w-full">
            <MacroRingChart
              intake={intake}
              targetCalories={targetCalories}
              protein={protein}
              carbs={carbs}
              fat={fat}
              proteinTarget={proteinTarget}
              carbsTarget={carbsTarget}
              fatTarget={fatTarget}
              hasData={hasData}
              compact={true}
            />
          </div>

          <div className="min-w-0 pt-1 sm:pt-3 space-y-2.5">
            <MacroRow
              label="蛋白质"
              actual={protein}
              target={proteinTarget}
              color="#F97316"
              hasData={hasData}
              foods={allFoods}
              macroKey="protein"
            />
            <MacroRow
              label="碳水化合物"
              actual={carbs}
              target={carbsTarget}
              color="#6366F1"
              hasData={hasData}
              foods={allFoods}
              macroKey="carbs"
            />
            <MacroRow
              label="脂肪"
              actual={fat}
              target={fatTarget}
              color="#0EA5E9"
              hasData={hasData}
              foods={allFoods}
              macroKey="fat"
            />

            {hasData && (
              <p className="text-[10px] text-muted-foreground/50 leading-relaxed pt-1">
                {targetCalories} kcal · {profile?.goal === 'lose' ? '减脂方案' : profile?.goal === 'gain' ? '增肌方案' : '维持方案'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-4 border-t border-border/50" />

      {/* 热量收支 */}
      {hasAnyData && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Dumbbell className="w-3 h-3" style={{ color: '#22C55E' }} />
            <p className="text-[11px] font-semibold text-foreground">热量收支</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 py-2 rounded-xl text-center" style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
              <p className="text-[13px] font-bold text-foreground tabular-nums">{hasData ? intake : '—'}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">摄入 kcal</p>
            </div>
            <span className="flex-shrink-0 text-sm text-muted-foreground/40 font-light px-0.5">−</span>
            <div className="flex-1 py-2 rounded-xl text-center" style={{ backgroundColor: 'rgba(34,197,94,0.08)' }}>
              <p
                className="text-[13px] font-bold tabular-nums"
                style={{ color: activeBurn > 0 ? '#16A34A' : '#9CA3AF' }}
              >
                {activeBurn}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">活动消耗</p>
            </div>
            <span className="flex-shrink-0 text-sm text-muted-foreground/40 font-light px-0.5">=</span>
            <div
              className="flex-1 py-2 rounded-xl text-center"
              style={{
                backgroundColor: hasData
                  ? netCalories > targetCalories ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)'
                  : 'rgba(0,0,0,0.04)',
              }}
            >
              <p
                className="text-[13px] font-bold tabular-nums"
                style={{
                  color: hasData
                    ? netCalories > targetCalories ? '#DC2626' : '#6366F1'
                    : '#9CA3AF',
                }}
              >
                {hasData ? netCalories : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">净摄入</p>
            </div>
          </div>
          {hasData && activeBurn > 0 && (
            <p
              className="text-[10px] text-center mt-1.5 font-medium tabular-nums"
              style={{ color: netRemaining >= 0 ? '#16A34A' : '#DC2626' }}
            >
              {netRemaining >= 0
                ? `运动后还可净摄入 ${netRemaining} kcal`
                : `净摄入已超出目标 ${-netRemaining} kcal`}
            </p>
          )}
        </div>
      )}

      <div className="mx-4 border-t border-border/50" />

      <div className="p-4 pt-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" style={{ color: scoreColor }} />
            <p className="text-sm font-semibold text-foreground">炎症指数</p>
          </div>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: scoreColor, backgroundColor: `${scoreColor}18` }}
          >
            {scoreLabel}
          </span>
        </div>

        <div className="relative mb-1.5">
          <div
            className="h-2.5 rounded-full overflow-hidden transition-opacity duration-500"
            style={{
              background: 'linear-gradient(to right, #16A34A, #84CC16, #F59E0B, #EF4444)',
              opacity: hasData ? 1 : 0.2,
            }}
          />
          {hasData && (
            <div
              className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md"
              style={{
                left: `${indicatorPct}%`,
                transform: 'translateX(-50%) translateY(-50%)',
                backgroundColor: scoreColor,
                transition: 'left 0.6s ease',
              }}
            />
          )}
        </div>

        <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
          <span>抗炎</span>
          <span>中性</span>
          <span>促炎</span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">{scoreDesc}</p>
      </div>
    </div>
  );
}
