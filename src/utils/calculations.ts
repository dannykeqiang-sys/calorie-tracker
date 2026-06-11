import type { UserProfile, BMIResult, ActivityLevel, MealRecord } from '../types';

export function calcBMI(weight: number, height: number): BMIResult {
  if (height <= 0 || weight <= 0) {
    return { value: 0, category: '数据异常', color: '#9CA3AF', description: '请检查身高体重数据' };
  }
  const h = height / 100;
  const value = Math.round((weight / (h * h)) * 10) / 10;

  if (value < 18.5) {
    return { value, category: '偏瘦', color: '#60A5FA', description: '体重略低，适当增加营养摄入' };
  } else if (value < 24) {
    return { value, category: '正常', color: '#22C55E', description: '体重维持在理想范围，继续保持！' };
  } else if (value < 28) {
    return { value, category: '超重', color: '#F97316', description: '体重略高，建议适当控制饮食' };
  } else {
    return { value, category: '肥胖', color: '#EF4444', description: '建议制定科学减重计划，配合运动' };
  }
}

export function calcBMR(profile: UserProfile): number {
  const { weight, height, age, gender } = profile;
  if (weight <= 0 || height <= 0 || age <= 0) return 1500;
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calcTDEE(profile: UserProfile): number {
  const bmr = calcBMR(profile);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel]);
}

export function calcTargetCalories(profile: UserProfile): number {
  const tdee = calcTDEE(profile);
  if (profile.goal === 'lose') return Math.max(1200, Math.round(tdee - 500));
  if (profile.goal === 'gain') return Math.round(tdee + 300);
  return tdee;
}

export function calcMacroTargets(profile: UserProfile): { proteinTarget: number; carbsTarget: number; fatTarget: number } {
  const cal = calcTargetCalories(profile);
  if (profile.goal === 'lose') {
    return {
      proteinTarget: Math.round(cal * 0.35 / 4),
      carbsTarget: Math.round(cal * 0.35 / 4),
      fatTarget: Math.round(cal * 0.30 / 9),
    };
  }
  if (profile.goal === 'gain') {
    return {
      proteinTarget: Math.round(cal * 0.30 / 4),
      carbsTarget: Math.round(cal * 0.50 / 4),
      fatTarget: Math.round(cal * 0.20 / 9),
    };
  }
  return {
    proteinTarget: Math.round(cal * 0.25 / 4),
    carbsTarget: Math.round(cal * 0.50 / 4),
    fatTarget: Math.round(cal * 0.25 / 9),
  };
}

export function getDefaultMacroTargets(): { proteinTarget: number; carbsTarget: number; fatTarget: number } {
  return { proteinTarget: 125, carbsTarget: 250, fatTarget: 56 };
}

export function sumMacrosWithEstimate(meals: MealRecord): { protein: number; carbs: number; fat: number } {
  let protein = 0, carbs = 0, fat = 0;
  for (const foods of Object.values(meals)) {
    if (foods.length === 0) continue;
    const slotCal = foods.reduce((s, f) => s + f.calories, 0);
    const slotProt = foods.reduce((s, f) => s + (f.protein ?? 0), 0);
    const slotCarbs = foods.reduce((s, f) => s + (f.carbs ?? 0), 0);
    const slotFat = foods.reduce((s, f) => s + (f.fat ?? 0), 0);
    const isEmpty = slotCal > 0 && slotProt === 0 && slotCarbs === 0 && slotFat === 0;
    protein += isEmpty ? slotCal * 0.20 / 4 : slotProt;
    carbs += isEmpty ? slotCal * 0.50 / 4 : slotCarbs;
    fat += isEmpty ? slotCal * 0.30 / 9 : slotFat;
  }
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}
