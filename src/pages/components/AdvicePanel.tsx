import type { UserProfile, DailyRecord } from '../../types';
import { calcBMI, calcTargetCalories } from '../../utils/calculations';
import { Lightbulb, Apple, Dumbbell, Heart, Star } from 'lucide-react';

interface AdvicePanelProps {
  profile: UserProfile | null;
  record: DailyRecord;
}

interface Advice {
  icon: React.ElementType;
  title: string;
  content: string;
  color: string;
  bg: string;
}

function genAdvices(profile: UserProfile, record: DailyRecord): Advice[] {
  const advices: Advice[] = [];
  const bmi = calcBMI(profile.weight, profile.height);
  const target = calcTargetCalories(profile);
  const totalIntake = Object.values(record.meals).flat().reduce((s, f) => s + f.calories, 0);
  const totalBurn = record.exercises.reduce((s, e) => s + e.calories, 0);
  const surplus = totalIntake - totalBurn - target;

  if (bmi.value < 18.5) {
    advices.push({
      icon: Apple,
      title: '增加优质蛋白质摄入',
      content: 'BMI 偏低，建议每日每公斤体重摄入 1.5-2g 蛋白质，如鸡胸肉、鸡蛋、豆制品，配合力量训练，帮助健康增重。',
      color: '#7CB9E8',
      bg: 'bg-blue-50',
    });
  } else if (bmi.value >= 28) {
    advices.push({
      icon: Apple,
      title: '优化饮食结构',
      content: '建议以优质蛋白质（占30-35%）和复合碳水（占40-50%）为主，减少精制糖摄入，增加膳食纤维，让身体在饱足感中自然瘦下来。',
      color: '#E07878',
      bg: 'bg-red-50',
    });
  }

  if (surplus > 200) {
    advices.push({
      icon: Dumbbell,
      title: '今天热量盈余，增加运动消耗',
      content: `你今天摄入比目标多了 ${Math.abs(surplus)} 大卡，可以增加 ${Math.round(Math.abs(surplus) / 10)} 分钟有氧运动来平衡。别焦虑，运动是让你享受美食后最好的礼物。`,
      color: '#EBB193',
      bg: 'bg-orange-50',
    });
  } else if (surplus < -300 && totalIntake > 0) {
    const remaining = Math.abs(surplus);
    const mainMealsRecorded = ['breakfast', 'lunch', 'dinner'].filter(
      m => record.meals[m as keyof typeof record.meals].length > 0,
    ).length;
    if (mainMealsRecorded < 3) {
      advices.push({
        icon: Apple,
        title: `今天还能吃 ${remaining} 大卡`,
        content: `距离今日目标还有 ${remaining} 大卡的空间，合理安排接下来的餐食，吃饱又营养才是关键！`,
        color: '#A3B899',
        bg: 'bg-primary/5',
      });
    } else if (surplus < -500) {
      advices.push({
        icon: Apple,
        title: '热量缺口较大，记得吃够哦',
        content: `今天热量缺口达 ${remaining} 大卡，长期大幅节食会降低基础代谢率。保证优质蛋白质摄入，健康瘦才能瘦得长久。`,
        color: '#C9934A',
        bg: 'bg-amber-50',
      });
    }
  }

  if (totalBurn === 0) {
    advices.push({
      icon: Dumbbell,
      title: '今天还没有运动记录',
      content: '即使是 20 分钟的健步走（消耗约 100 大卡）也能显著改善胰岛素敏感性，促进脂肪代谢。运动不仅是消耗热量，更是在给身体充满活力！',
      color: '#7CB9E8',
      bg: 'bg-blue-50',
    });
  }

  if (profile.goal === 'lose') {
    advices.push({
      icon: Heart,
      title: '科学减脂核心法则',
      content: '① 热量缺口控制在 300-500 kcal/天 ② 保证每日 1.2-1.6g/kg 蛋白质防止肌肉流失 ③ 每周 3-5 次有氧+2-3 次力量训练 ④ 保证 7-8 小时睡眠，高皮质醇水平会阻碍减脂。',
      color: '#A3B899',
      bg: 'bg-green-50',
    });
  } else if (profile.goal === 'gain') {
    advices.push({
      icon: Dumbbell,
      title: '科学增肌核心法则',
      content: '① 热量盈余控制在 200-300 kcal/天 ② 每日蛋白质 1.6-2.2g/kg ③ 以复合训练（深蹲、硬拉、卧推）为主，每块肌肉每周至少训练 2 次 ④ 训练后 30 分钟内补充蛋白质+碳水。',
      color: '#8B7EC8',
      bg: 'bg-violet-50',
    });
  }

  const mealCounts = Object.values(record.meals).filter(m => m.length > 0).length;
  if (mealCounts < 3 && new Date().getHours() >= 20) {
    advices.push({
      icon: Apple,
      title: '养成规律进餐习惯',
      content: '规律三餐能稳定血糖水平，避免下午的暴食冲动。早餐推荐蛋白质+复合碳水，午餐最丰盛，晚餐以蔬菜+优质蛋白为主，减少精制碳水。',
      color: '#C9934A',
      bg: 'bg-amber-50',
    });
  }

  advices.push({
    icon: Star,
    title: '水分补充别忘了',
    content: `根据你的体重（${profile.weight}kg），每天至少需要饮水 ${Math.round(profile.weight * 30)}ml。充足的水分有助于代谢废物排出，在运动前后各补充 500ml 水分效果最佳。`,
    color: '#A3B899',
    bg: 'bg-primary/5',
  });

  return advices.slice(0, 4);
}

export default function AdvicePanel({ profile, record }: AdvicePanelProps) {
  if (!profile) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center">
        <Lightbulb className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-semibold">填写个人信息后获取专属建议</p>
        <p className="text-sm text-muted-foreground mt-1">点击右上角「设置个人信息」开始你的健康旅程</p>
      </div>
    );
  }

  const advices = genAdvices(profile, record);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-foreground">今日个性化健康建议</span>
        <span className="text-xs text-muted-foreground">基于你的数据实时生成</span>
      </div>
      {advices.map((advice, i) => {
        const Icon = advice.icon;
        return (
          <div key={i} className={`rounded-2xl border border-border ${advice.bg} p-4`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${advice.color}20` }}>
                <Icon className="w-4 h-4" style={{ color: advice.color }} />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{advice.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{advice.content}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
