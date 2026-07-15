import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import type { UserProfile, DailyRecord } from '../../types';
import { sumMacrosWithEstimate } from '../../utils/calculations';
import InflammationKnowledge from './InflammationKnowledge';

interface InflammationIndexCardProps {
  profile: UserProfile | null;
  record: DailyRecord;
  waterAmount: number;
}

interface Factor {
  label: string;
  direction: 'good' | 'bad' | 'neutral';
  tip: string;
}

function calcScore(
  protein: number,
  carbs: number,
  fat: number,
  exerciseBurn: number,
  water: number,
  totalCalories: number,
): { score: number; factors: Factor[] } {
  let score = 38;
  const factors: Factor[] = [];
  const total = protein * 4 + carbs * 4 + fat * 9;

  if (total > 0) {
    const proteinPct = (protein * 4 / total) * 100;
    const carbsPct = (carbs * 4 / total) * 100;
    const fatPct = (fat * 9 / total) * 100;

    if (proteinPct >= 20 && proteinPct <= 38) {
      score -= 8;
      factors.push({ label: `蛋白质 ${Math.round(proteinPct)}%`, direction: 'good', tip: '比例优秀' });
    } else if (proteinPct < 12) {
      score += 8;
      factors.push({ label: `蛋白质 ${Math.round(proteinPct)}%`, direction: 'bad', tip: '摄入偏低' });
    } else {
      factors.push({ label: `蛋白质 ${Math.round(proteinPct)}%`, direction: 'neutral', tip: '比例正常' });
    }

    if (carbsPct > 65) {
      score += 12;
      factors.push({ label: `碳水 ${Math.round(carbsPct)}%`, direction: 'bad', tip: '比例偏高' });
    } else if (carbsPct >= 35 && carbsPct <= 58) {
      score -= 5;
      factors.push({ label: `碳水 ${Math.round(carbsPct)}%`, direction: 'good', tip: '比例合理' });
    } else {
      factors.push({ label: `碳水 ${Math.round(carbsPct)}%`, direction: 'neutral', tip: '比例尚可' });
    }

    if (fatPct > 40) {
      score += 10;
      factors.push({ label: `脂肪 ${Math.round(fatPct)}%`, direction: 'bad', tip: '比例偏高' });
    } else if (fatPct >= 15 && fatPct <= 35) {
      score -= 4;
      factors.push({ label: `脂肪 ${Math.round(fatPct)}%`, direction: 'good', tip: '比例健康' });
    } else {
      factors.push({ label: `脂肪 ${Math.round(fatPct)}%`, direction: 'neutral', tip: '比例尚可' });
    }
  } else {
    factors.push({ label: '未记录饮食', direction: 'neutral', tip: '无法评估' });
  }

  if (exerciseBurn > 200) {
    score -= 12;
    factors.push({ label: `运动 ${exerciseBurn} kcal`, direction: 'good', tip: '强效抗炎' });
  } else if (exerciseBurn > 0) {
    score -= 6;
    factors.push({ label: `运动 ${exerciseBurn} kcal`, direction: 'good', tip: '有益运动' });
  } else {
    score += 5;
    factors.push({ label: '今日未运动', direction: 'bad', tip: '建议运动' });
  }

  if (water >= 1500) {
    score -= 8;
    factors.push({ label: `饮水 ${water}ml`, direction: 'good', tip: '水分充足' });
  } else if (water >= 800) {
    score -= 3;
    factors.push({ label: `饮水 ${water}ml`, direction: 'neutral', tip: '水分尚可' });
  } else if (water < 200) {
    score += 5;
    factors.push({ label: `饮水 ${water}ml`, direction: 'bad', tip: '严重不足' });
  } else {
    factors.push({ label: `饮水 ${water}ml`, direction: 'neutral', tip: '饮水偏少' });
  }

  return { score: Math.max(8, Math.min(90, score)), factors };
}

function getLevel(score: number): { label: string; color: string; bg: string; desc: string } {
  if (score < 25) return { label: '低炎症', color: '#16A34A', bg: 'rgba(34,197,94,0.12)', desc: '身体状态良好，炎症水平理想' };
  if (score < 48) return { label: '轻度炎症', color: '#84CC16', bg: 'rgba(132,204,22,0.12)', desc: '整体较好，少量因素需要关注' };
  if (score < 68) return { label: '中度炎症', color: '#F97316', bg: 'rgba(249,115,22,0.12)', desc: '需要关注饮食和运动习惯' };
  return { label: '偏高炎症', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', desc: '建议调整饮食结构和生活方式' };
}

function GaugeArc({ score, color }: { score: number; color: string }) {
  const r = 72;
  const cx = 100;
  const cy = 96;
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;

  return (
    <svg width="200" height="106" viewBox="0 0 200 106" fill="none">
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        stroke="var(--ck-chart-grid)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        pathLength={100}
        strokeDasharray={`${score} 100`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.1,0.64,1), stroke 0.4s ease' }}
      />
    </svg>
  );
}

export default function InflammationIndexCard({ profile, record, waterAmount }: InflammationIndexCardProps) {
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  const allFoods = Object.values(record.meals).flat();
  const totalCalories = allFoods.reduce((s, f) => s + f.calories, 0);
  const { protein, carbs, fat } = sumMacrosWithEstimate(record.meals);
  const exerciseBurn = record.exercises.reduce((s, e) => s + e.calories, 0);

  const { score, factors } = calcScore(protein, carbs, fat, exerciseBurn, waterAmount, totalCalories);
  const level = getLevel(score);

  const factorColors: Record<string, { bg: string; text: string }> = {
    good: { bg: 'rgba(34,197,94,0.10)', text: '#16A34A' },
    bad: { bg: 'rgba(239,68,68,0.10)', text: '#DC2626' },
    neutral: { bg: 'rgba(107,114,128,0.08)', text: '#6B7280' },
  };

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-foreground">炎症指数</p>
          <button
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors"
            style={{ background: knowledgeOpen ? 'rgba(139,92,246,0.12)' : 'var(--ck-hover)', color: knowledgeOpen ? '#7C3AED' : '#9CA3AF' }}
            onClick={() => setKnowledgeOpen(v => !v)}
          >
            <BookOpen className="w-3 h-3" />
            炎症知识
            <ChevronDown
              className="w-3 h-3 transition-transform duration-300"
              style={{ transform: knowledgeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>
        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>基于今日饮食、运动与饮水综合评估</p>
      </div>

      <div className="flex flex-col items-center px-4 pb-2 -mt-1">
        <div className="relative">
          <GaugeArc score={score} color={level.color} />
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <p className="text-4xl font-black tabular-nums leading-none" style={{ color: level.color }}>{score}</p>
            <div
              className="mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: level.bg, color: level.color }}
            >
              {level.label}
            </div>
          </div>
        </div>
        <p className="text-[10px] mt-1 text-center" style={{ color: '#9CA3AF' }}>{level.desc}</p>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[10px] font-semibold mb-2" style={{ color: '#9CA3AF' }}>影响因素</p>
        <div className="flex flex-wrap gap-1.5">
          {factors.map((f, i) => {
            const fc = factorColors[f.direction];
            return (
              <div
                key={i}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium"
                style={{ background: fc.bg, color: fc.text }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: fc.text }}
                />
                {f.label}
              </div>
            );
          })}
        </div>
      </div>

      {knowledgeOpen && (
        <div className="border-t border-border/40 px-4 pt-4 pb-4">
          <InflammationKnowledge />
        </div>
      )}
    </div>
  );
}
