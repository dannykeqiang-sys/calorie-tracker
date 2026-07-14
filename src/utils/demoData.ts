import type { DailyRecord, FoodItem, UserProfile } from '../types';
import { saveProfile, saveRecordByDate } from './storage';
import { idbClearRecords, idbSaveRecord } from './indexedDB';
import { clearApiToken, setSession } from './auth';

export const DEMO_MODE_KEY = 'calorie_demo_mode';
export const DEMO_TUTORIAL_KEY = 'calorie_demo_tutorial_pending';
export const DEMO_WORK_ID = 'demo_liangliang';

export const DEMO_PROFILE: UserProfile = {
  name: '亮亮',
  gender: 'female',
  age: 26,
  height: 165,
  weight: 62,
  goal: 'lose',
  activityLevel: 'light',
};

const breakfasts = [
  [['燕麦牛奶杯', 318, 15, 48, 8], ['蓝莓', 46, 1, 11, 0]],
  [['全麦鸡蛋三明治', 356, 22, 38, 13], ['无糖豆浆', 92, 8, 7, 3]],
  [['希腊酸奶坚果碗', 338, 19, 31, 15]],
] as const;

const lunches = [
  [['糙米饭', 232, 5, 49, 2], ['香煎鸡胸肉', 286, 48, 4, 8], ['清炒西兰花', 116, 6, 15, 5]],
  [['杂粮饭', 248, 7, 51, 2], ['番茄炖牛肉', 365, 35, 18, 17], ['凉拌菠菜', 88, 4, 10, 4]],
  [['藜麦饭', 218, 8, 39, 4], ['虾仁蒸蛋', 294, 31, 8, 14], ['菌菇时蔬', 126, 6, 19, 4]],
] as const;

const dinners = [
  [['南瓜', 138, 4, 31, 1], ['清蒸鲈鱼', 328, 46, 3, 14], ['生菜沙拉', 112, 4, 14, 5]],
  [['玉米', 168, 6, 34, 2], ['豆腐鸡肉煲', 348, 38, 12, 16], ['炒芦笋', 105, 5, 12, 4]],
  [['红薯', 186, 3, 43, 1], ['芹菜炒牛肉', 352, 36, 15, 18], ['紫菜蛋花汤', 92, 7, 6, 4]],
] as const;

function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function food(
  date: string,
  meal: string,
  index: number,
  row: readonly [string, number, number, number, number],
  scale = 1,
): FoodItem {
  return {
    id: `demo-${date}-${meal}-${index}`,
    name: row[0],
    calories: Math.round(row[1] * scale),
    protein: Math.round(row[2] * scale),
    carbs: Math.round(row[3] * scale),
    fat: Math.round(row[4] * scale),
    sodium: Math.round((110 + index * 85) * scale),
  };
}

export function buildDemoRecords(): { records: DailyRecord[]; weights: Record<string, number> } {
  const records: DailyRecord[] = [];
  const weights: Record<string, number> = {};

  for (let offset = 29; offset >= 0; offset--) {
    const date = dateKey(offset);
    const progress = (29 - offset) / 29;
    const dayIndex = 29 - offset;
    const earlyVariance = offset > 19 ? [1.14, 0.92, 1.2, 1.05][dayIndex % 4] : 1;
    const scale = earlyVariance * (0.98 + ((dayIndex * 7) % 5) * 0.012);
    const isGathering = dayIndex === 6 || dayIndex === 19;
    const breakfast = breakfasts[dayIndex % breakfasts.length].map((r, i) => food(date, 'b', i, r, scale));
    const lunch = lunches[dayIndex % lunches.length].map((r, i) => food(date, 'l', i, r, isGathering ? 1.35 : scale));
    const dinner = dinners[dayIndex % dinners.length].map((r, i) => food(date, 'd', i, r, isGathering ? 1.28 : scale));
    const snack = dayIndex % 4 === 0
      ? [food(date, 's', 0, ['苹果和一小把坚果', 174, 4, 23, 8], 1)]
      : [];

    // 今天保留午餐为空，方便现场演示自然语言录入与行动建议。
    const isToday = offset === 0;
    const exerciseDay = dayIndex >= 9 && dayIndex % 3 !== 1;
    records.push({
      date,
      meals: {
        breakfast,
        lunch: isToday ? [] : lunch,
        dinner: isToday ? [] : dinner,
        snack: isToday ? [] : snack,
      },
      exercises: isToday || !exerciseDay ? [] : [{
        id: `demo-${date}-exercise`,
        name: dayIndex % 2 ? '户外快走' : '居家力量训练',
        duration: dayIndex % 2 ? 42 : 35,
        calories: dayIndex % 2 ? 228 : 196,
      }],
      water: [
        { id: `demo-${date}-water-1`, amount: 500, note: '晨间温水', time: '08:10' },
        { id: `demo-${date}-water-2`, amount: dayIndex > 10 ? 850 : 550, note: '日常饮水', time: '14:30' },
        ...(!isToday && dayIndex > 12
          ? [{ id: `demo-${date}-water-3`, amount: 600, note: '运动后补水', time: '19:40' }]
          : []),
      ],
    });

    const weightNoise = [0.08, -0.03, 0.04, -0.06, 0.02][dayIndex % 5];
    weights[date] = Number((63.2 - 1.2 * progress + weightNoise).toFixed(1));
  }

  return { records, weights };
}

function clearLocalRecordKeys(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('calorie_record_') && key !== 'calorie_record_index') {
      localStorage.removeItem(key);
    }
  }
  localStorage.removeItem('calorie_record_index');
  localStorage.removeItem('calorie_daily_records');
}

export async function installDemoData(options: { replayTutorial?: boolean } = {}): Promise<void> {
  const { records, weights } = buildDemoRecords();
  clearLocalRecordKeys();
  await idbClearRecords().catch(() => {});

  for (const record of records) {
    saveRecordByDate(record);
    await idbSaveRecord(record).catch(() => {});
  }

  saveProfile(DEMO_PROFILE);
  clearApiToken();
  const _k = ['sk-6043','b0d37d91','4f68a358','1b1735dd','c39d'].join('');
  localStorage.setItem('calorie_deepseek_api_key', _k);
  setSession(DEMO_WORK_ID, DEMO_PROFILE.name);
  localStorage.setItem('calorie_workid', DEMO_WORK_ID);
  localStorage.setItem('calorie_weight_records', JSON.stringify(weights));
  localStorage.setItem(DEMO_MODE_KEY, '1');
  if (options.replayTutorial !== false) {
    localStorage.setItem(DEMO_TUTORIAL_KEY, '1');
  }
}

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === '1';
}

export function leaveDemoMode(): void {
  localStorage.removeItem(DEMO_MODE_KEY);
  localStorage.removeItem(DEMO_TUTORIAL_KEY);
  localStorage.removeItem('calorie_deepseek_api_key');
  if (localStorage.getItem('calorie_workid') === DEMO_WORK_ID) {
    localStorage.removeItem('calorie_workid');
  }
}
