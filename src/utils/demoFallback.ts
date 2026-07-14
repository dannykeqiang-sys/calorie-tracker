import type { MixedMealResult, ParsedFoodItem, ParsedExerciseItem, WaterLogItem } from './deepseek';

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface FoodDef {
  name: string;
  keywords: string[];
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  defaultMeal: MealKey;
  waterMl?: number;
}

const FOODS: FoodDef[] = [
  { name: '燕麦粥', keywords: ['燕麦粥', '燕麦'], unit: '碗', calories: 150, protein: 5, carbs: 27, fat: 3, sodium: 5, defaultMeal: 'breakfast', waterMl: 220 },
  { name: '牛奶', keywords: ['牛奶'], unit: '杯', calories: 128, protein: 8, carbs: 12, fat: 7, sodium: 100, defaultMeal: 'breakfast', waterMl: 217 },
  { name: '鸡蛋', keywords: ['水煮蛋', '煎蛋', '鸡蛋'], unit: '个', calories: 78, protein: 7, carbs: 1, fat: 5, sodium: 70, defaultMeal: 'breakfast' },
  { name: '全麦面包', keywords: ['全麦面包', '全麦'], unit: '片', calories: 80, protein: 4, carbs: 14, fat: 1, sodium: 150, defaultMeal: 'breakfast' },
  { name: '面包', keywords: ['面包', '吐司'], unit: '片', calories: 120, protein: 4, carbs: 20, fat: 3, sodium: 170, defaultMeal: 'breakfast' },
  { name: '豆浆', keywords: ['豆浆'], unit: '杯', calories: 80, protein: 7, carbs: 5, fat: 3, sodium: 30, defaultMeal: 'breakfast', waterMl: 237 },
  { name: '蓝莓', keywords: ['蓝莓'], unit: '把', calories: 29, protein: 0.4, carbs: 7, fat: 0.2, sodium: 1, defaultMeal: 'breakfast' },
  { name: '酸奶', keywords: ['酸奶'], unit: '杯', calories: 100, protein: 5, carbs: 12, fat: 3, sodium: 60, defaultMeal: 'snack', waterMl: 120 },
  { name: '三明治', keywords: ['三明治'], unit: '个', calories: 300, protein: 12, carbs: 35, fat: 12, sodium: 600, defaultMeal: 'breakfast' },
  { name: '油条', keywords: ['油条'], unit: '根', calories: 230, protein: 4, carbs: 25, fat: 13, sodium: 300, defaultMeal: 'breakfast' },
  { name: '包子', keywords: ['包子'], unit: '个', calories: 200, protein: 7, carbs: 30, fat: 6, sodium: 400, defaultMeal: 'breakfast' },
  { name: '馒头', keywords: ['馒头'], unit: '个', calories: 220, protein: 6, carbs: 47, fat: 1, sodium: 200, defaultMeal: 'breakfast' },
  { name: '白粥', keywords: ['白粥', '稀饭', '粥'], unit: '碗', calories: 90, protein: 2, carbs: 20, fat: 0.3, sodium: 5, defaultMeal: 'breakfast', waterMl: 255 },
  { name: '饺子', keywords: ['饺子', '水饺'], unit: '份', calories: 320, protein: 12, carbs: 40, fat: 12, sodium: 700, defaultMeal: 'lunch' },
  { name: '米饭', keywords: ['米饭', '白饭'], unit: '碗', calories: 200, protein: 4, carbs: 46, fat: 0.5, sodium: 2, defaultMeal: 'lunch' },
  { name: '糙米饭', keywords: ['糙米饭', '糙米'], unit: '碗', calories: 216, protein: 5, carbs: 45, fat: 1.8, sodium: 5, defaultMeal: 'lunch' },
  { name: '鸡胸肉', keywords: ['鸡胸肉', '鸡胸'], unit: '份', calories: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 70, defaultMeal: 'lunch' },
  { name: '鸡腿', keywords: ['鸡腿'], unit: '个', calories: 180, protein: 18, carbs: 0, fat: 12, sodium: 90, defaultMeal: 'lunch' },
  { name: '西兰花', keywords: ['西兰花'], unit: '份', calories: 40, protein: 3, carbs: 7, fat: 0.4, sodium: 30, defaultMeal: 'lunch' },
  { name: '牛肉面', keywords: ['牛肉面'], unit: '碗', calories: 650, protein: 28, carbs: 82, fat: 22, sodium: 1380, defaultMeal: 'lunch', waterMl: 200 },
  { name: '卤蛋', keywords: ['卤蛋'], unit: '个', calories: 78, protein: 7, carbs: 2, fat: 5, sodium: 310, defaultMeal: 'lunch' },
  { name: '番茄炒蛋', keywords: ['番茄炒蛋', '西红柿炒蛋'], unit: '份', calories: 170, protein: 9, carbs: 8, fat: 12, sodium: 500, defaultMeal: 'lunch' },
  { name: '虾仁', keywords: ['虾仁', '基围虾', '虾'], unit: '份', calories: 99, protein: 20, carbs: 1, fat: 1.4, sodium: 200, defaultMeal: 'lunch' },
  { name: '红烧肉', keywords: ['红烧肉'], unit: '份', calories: 480, protein: 15, carbs: 8, fat: 42, sodium: 900, defaultMeal: 'lunch' },
  { name: '排骨', keywords: ['排骨'], unit: '份', calories: 350, protein: 20, carbs: 3, fat: 28, sodium: 600, defaultMeal: 'lunch' },
  { name: '芹菜炒牛肉', keywords: ['芹菜炒牛肉'], unit: '份', calories: 220, protein: 18, carbs: 6, fat: 14, sodium: 600, defaultMeal: 'dinner' },
  { name: '牛肉', keywords: ['牛肉'], unit: '份', calories: 250, protein: 26, carbs: 0, fat: 15, sodium: 60, defaultMeal: 'lunch' },
  { name: '鲈鱼', keywords: ['清蒸鲈鱼', '鲈鱼'], unit: '份', calories: 120, protein: 20, carbs: 0, fat: 4, sodium: 80, defaultMeal: 'dinner' },
  { name: '三文鱼', keywords: ['三文鱼'], unit: '份', calories: 208, protein: 20, carbs: 0, fat: 13, sodium: 60, defaultMeal: 'dinner' },
  { name: '鱼', keywords: ['清蒸鱼', '鱼'], unit: '份', calories: 130, protein: 22, carbs: 0, fat: 4, sodium: 80, defaultMeal: 'dinner' },
  { name: '生菜沙拉', keywords: ['生菜沙拉', '蔬菜沙拉', '沙拉'], unit: '份', calories: 80, protein: 2, carbs: 6, fat: 5, sodium: 200, defaultMeal: 'dinner' },
  { name: '豆腐', keywords: ['豆腐'], unit: '份', calories: 82, protein: 8, carbs: 2, fat: 5, sodium: 7, defaultMeal: 'dinner' },
  { name: '南瓜', keywords: ['南瓜'], unit: '份', calories: 45, protein: 1, carbs: 11, fat: 0.1, sodium: 1, defaultMeal: 'dinner' },
  { name: '玉米', keywords: ['玉米'], unit: '根', calories: 120, protein: 4, carbs: 27, fat: 1.5, sodium: 15, defaultMeal: 'dinner' },
  { name: '红薯', keywords: ['红薯', '地瓜'], unit: '个', calories: 130, protein: 2, carbs: 30, fat: 0.2, sodium: 40, defaultMeal: 'dinner' },
  { name: '土豆', keywords: ['土豆', '马铃薯'], unit: '个', calories: 130, protein: 3, carbs: 30, fat: 0.1, sodium: 10, defaultMeal: 'dinner' },
  { name: '菠菜', keywords: ['菠菜'], unit: '份', calories: 35, protein: 3, carbs: 4, fat: 0.4, sodium: 80, defaultMeal: 'dinner' },
  { name: '青菜', keywords: ['青菜', '油麦菜', '小白菜'], unit: '份', calories: 30, protein: 2, carbs: 4, fat: 0.3, sodium: 60, defaultMeal: 'dinner' },
  { name: '黄瓜', keywords: ['黄瓜'], unit: '根', calories: 20, protein: 1, carbs: 4, fat: 0.1, sodium: 3, defaultMeal: 'snack' },
  { name: '番茄', keywords: ['番茄', '西红柿'], unit: '个', calories: 25, protein: 1, carbs: 5, fat: 0.2, sodium: 5, defaultMeal: 'snack' },
  { name: '茄子', keywords: ['茄子'], unit: '份', calories: 90, protein: 2, carbs: 9, fat: 6, sodium: 300, defaultMeal: 'dinner' },
  { name: '蘑菇', keywords: ['蘑菇', '香菇'], unit: '份', calories: 40, protein: 3, carbs: 5, fat: 0.5, sodium: 200, defaultMeal: 'dinner' },
  { name: '苹果', keywords: ['苹果'], unit: '个', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, sodium: 2, defaultMeal: 'snack' },
  { name: '坚果', keywords: ['坚果', '腰果', '巴旦木', '杏仁', '花生'], unit: '把', calories: 150, protein: 5, carbs: 6, fat: 13, sodium: 3, defaultMeal: 'snack' },
  { name: '香蕉', keywords: ['香蕉'], unit: '根', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, sodium: 1, defaultMeal: 'snack' },
  { name: '橙子', keywords: ['橙子', '橘子', '柑橘'], unit: '个', calories: 62, protein: 1.2, carbs: 15, fat: 0.2, sodium: 1, defaultMeal: 'snack' },
  { name: '葡萄', keywords: ['葡萄', '提子'], unit: '把', calories: 69, protein: 0.7, carbs: 18, fat: 0.2, sodium: 2, defaultMeal: 'snack' },
  { name: '西瓜', keywords: ['西瓜'], unit: '块', calories: 46, protein: 0.9, carbs: 12, fat: 0.2, sodium: 2, defaultMeal: 'snack', waterMl: 180 },
  { name: '草莓', keywords: ['草莓'], unit: '把', calories: 33, protein: 0.7, carbs: 8, fat: 0.3, sodium: 1, defaultMeal: 'snack' },
  { name: '梨', keywords: ['梨'], unit: '个', calories: 100, protein: 0.6, carbs: 27, fat: 0.2, sodium: 2, defaultMeal: 'snack' },
  { name: '猕猴桃', keywords: ['猕猴桃', '奇异果'], unit: '个', calories: 61, protein: 1.1, carbs: 15, fat: 0.5, sodium: 3, defaultMeal: 'snack' },
  { name: '巧克力', keywords: ['巧克力'], unit: '块', calories: 155, protein: 2, carbs: 17, fat: 9, sodium: 20, defaultMeal: 'snack' },
  { name: '饼干', keywords: ['饼干'], unit: '块', calories: 70, protein: 1, carbs: 9, fat: 3, sodium: 60, defaultMeal: 'snack' },
  { name: '薯片', keywords: ['薯片'], unit: '份', calories: 270, protein: 3, carbs: 27, fat: 17, sodium: 400, defaultMeal: 'snack' },
  { name: '蛋糕', keywords: ['蛋糕'], unit: '块', calories: 260, protein: 4, carbs: 35, fat: 12, sodium: 250, defaultMeal: 'snack' },
  // 液体（纯液体，无热量的仅记录饮水）
  { name: '水', keywords: ['白开水', '温水', '矿泉水', '水'], unit: '杯', calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, defaultMeal: 'snack', waterMl: 250 },
  { name: '茶', keywords: ['绿茶', '红茶', '茶'], unit: '杯', calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, defaultMeal: 'snack', waterMl: 245 },
  { name: '咖啡', keywords: ['美式', '黑咖啡', '咖啡'], unit: '杯', calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, defaultMeal: 'snack', waterMl: 238 },
  { name: '拿铁', keywords: ['拿铁'], unit: '杯', calories: 130, protein: 7, carbs: 12, fat: 6, sodium: 90, defaultMeal: 'snack', waterMl: 200 },
  { name: '奶茶', keywords: ['奶茶'], unit: '杯', calories: 280, protein: 4, carbs: 45, fat: 9, sodium: 100, defaultMeal: 'snack', waterMl: 200 },
  { name: '果汁', keywords: ['果汁', '橙汁'], unit: '杯', calories: 110, protein: 0.5, carbs: 26, fat: 0.3, sodium: 10, defaultMeal: 'snack', waterMl: 220 },
  { name: '可乐', keywords: ['可乐', '汽水'], unit: '杯', calories: 140, protein: 0, carbs: 39, fat: 0, sodium: 15, defaultMeal: 'snack', waterMl: 220 },
  { name: '汤', keywords: ['汤'], unit: '碗', calories: 60, protein: 3, carbs: 4, fat: 3, sodium: 500, defaultMeal: 'dinner', waterMl: 270 },
];

interface ExerciseDef {
  name: string;
  keywords: string[];
  caloriesPer30min: number;
}

const EXERCISES: ExerciseDef[] = [
  { name: '跑步', keywords: ['跑步', '慢跑', '晨跑', '夜跑'], caloriesPer30min: 300 },
  { name: '快走', keywords: ['快走', '散步', '走路', '暴走'], caloriesPer30min: 150 },
  { name: '游泳', keywords: ['游泳'], caloriesPer30min: 250 },
  { name: '瑜伽', keywords: ['瑜伽'], caloriesPer30min: 120 },
  { name: '力量训练', keywords: ['力量训练', '力量', '撸铁', '举铁', '健身', '器械'], caloriesPer30min: 180 },
  { name: '骑行', keywords: ['骑行', '骑车', '单车', '自行车', '动感单车'], caloriesPer30min: 210 },
  { name: '跳绳', keywords: ['跳绳'], caloriesPer30min: 300 },
  { name: '篮球', keywords: ['篮球'], caloriesPer30min: 240 },
  { name: '羽毛球', keywords: ['羽毛球'], caloriesPer30min: 180 },
  { name: '足球', keywords: ['足球'], caloriesPer30min: 260 },
  { name: '爬山', keywords: ['爬山', '登山', '徒步'], caloriesPer30min: 270 },
  { name: '有氧操', keywords: ['有氧操', '健身操', '跳操', '帕梅拉'], caloriesPer30min: 200 },
  { name: '普拉提', keywords: ['普拉提'], caloriesPer30min: 130 },
];

const TIME_KEYWORDS: { meal: MealKey; words: string[] }[] = [
  { meal: 'snack', words: ['下午茶', '下午', '加餐', '零食', '夜宵', '宵夜'] },
  { meal: 'breakfast', words: ['早上', '早晨', '早餐', '早饭', '清晨', '一早'] },
  { meal: 'lunch', words: ['中午', '午餐', '午饭', '正午'] },
  { meal: 'dinner', words: ['晚上', '晚餐', '晚饭', '傍晚', '夜里'] },
];

const CN_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

function cnToNumber(raw: string): number {
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(raw)) return parseFloat(raw);
  if (raw === '半') return 0.5;
  if (raw === '十') return 10;
  if (raw.includes('十')) {
    const [a, b] = raw.split('十');
    const tens = a === '' ? 1 : CN_DIGITS[a] ?? 1;
    const ones = b === '' ? 0 : CN_DIGITS[b] ?? 0;
    return tens * 10 + ones;
  }
  return CN_DIGITS[raw[0]] ?? 1;
}

const NUM_TOKEN = /([0-9]+(?:\.[0-9]+)?|[零一二两三四五六七八九十半]+)/g;

function extractQuantity(beforeText: string): number {
  const matches = beforeText.match(NUM_TOKEN);
  if (!matches || matches.length === 0) return 1;
  const qty = cnToNumber(matches[matches.length - 1]);
  return qty > 0 ? qty : 1;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function detectMeal(segment: string): MealKey | null {
  for (const { meal, words } of TIME_KEYWORDS) {
    if (words.some(w => segment.includes(w))) return meal;
  }
  return null;
}

function extractDurationMinutes(segment: string): number | null {
  const hourMatch = segment.match(/([0-9]+(?:\.[0-9]+)?|[零一二两三四五六七八九十半]+)\s*(?:个)?\s*(?:小时|h|hr|hour)/i);
  if (hourMatch) return cnToNumber(hourMatch[1]) * 60;
  const minMatch = segment.match(/([0-9]+(?:\.[0-9]+)?|[零一二两三四五六七八九十半]+)\s*(?:分钟|min|分)/i);
  if (minMatch) return cnToNumber(minMatch[1]);
  return null;
}

const sortedFoods = [...FOODS].sort((a, b) => {
  const al = Math.max(...a.keywords.map(k => k.length));
  const bl = Math.max(...b.keywords.map(k => k.length));
  return bl - al;
});

/**
 * 本地降级解析器：纯关键词匹配 + 内置营养数据库，
 * 在无 API Key 或 API 调用失败时，尽力将自然语言解析为结构化饮食记录。
 */
export function parseMixedMealsLocally(input: string): MixedMealResult {
  const meals: Record<MealKey, ParsedFoodItem[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const exercises: ParsedExerciseItem[] = [];
  const waterLogs: WaterLogItem[] = [];

  const segments = input
    .split(/[，,。.；;！!？?\n]/)
    .map(s => s.trim())
    .filter(Boolean);

  let currentMeal: MealKey | null = null;

  for (const segment of segments) {
    const detected = detectMeal(segment);
    if (detected) currentMeal = detected;

    // 运动识别
    for (const ex of EXERCISES) {
      const kw = ex.keywords.find(k => segment.includes(k));
      if (!kw) continue;
      const minutes = extractDurationMinutes(segment);
      const factor = minutes ? minutes / 30 : 1;
      const calories = Math.round(ex.caloriesPer30min * factor);
      const label = minutes ? `${ex.name}（${minutes}分钟）` : ex.name;
      if (!exercises.some(e => e.name === label)) {
        exercises.push({ name: label, calories });
      }
    }

    // 食物 / 液体识别（长关键词优先，命中后消费掉，避免子串重复匹配）
    let working = segment;
    for (const food of sortedFoods) {
      for (const kw of food.keywords) {
        let idx = working.indexOf(kw);
        while (idx !== -1) {
          // 规避 "水果" 误命中 "水"
          if (food.name === '水' && working[idx + kw.length] === '果') {
            idx = working.indexOf(kw, idx + kw.length);
            continue;
          }
          const before = working.slice(Math.max(0, idx - 6), idx);
          const qty = extractQuantity(before);
          const meal = currentMeal ?? food.defaultMeal;

          if (food.calories > 0) {
            meals[meal].push({
              name: qty === 1 ? food.name : `${food.name}（${qty}${food.unit}）`,
              calories: Math.round(food.calories * qty),
              protein: round1(food.protein * qty),
              carbs: round1(food.carbs * qty),
              fat: round1(food.fat * qty),
              sodium: Math.round(food.sodium * qty),
            });
          }
          if (food.waterMl) {
            waterLogs.push({ raw_text: food.name, amount: Math.round(food.waterMl * qty) });
          }

          // 消费掉命中的关键词，避免子串（如 米饭⊂糙米饭）重复计入
          working = working.slice(0, idx) + '\u0000'.repeat(kw.length) + working.slice(idx + kw.length);
          idx = working.indexOf(kw, idx + kw.length);
        }
      }
    }
  }

  const mealCount = meals.breakfast.length + meals.lunch.length + meals.dinner.length + meals.snack.length;
  const hasData = mealCount > 0 || exercises.length > 0 || waterLogs.length > 0;

  const totalCalories = (['breakfast', 'lunch', 'dinner', 'snack'] as MealKey[])
    .reduce((sum, k) => sum + meals[k].reduce((s, f) => s + f.calories, 0), 0);
  const totalWater = waterLogs.reduce((s, w) => s + w.amount, 0);
  const totalBurn = exercises.reduce((s, e) => s + e.calories, 0);

  return {
    has_data: hasData,
    analysis_summary: buildSummary(mealCount, totalCalories, exercises.length, totalBurn, totalWater),
    data: {
      breakfast: meals.breakfast,
      lunch: meals.lunch,
      dinner: meals.dinner,
      snack: meals.snack,
      exercises,
      water_logs: waterLogs,
    },
  };
}

function buildSummary(
  mealCount: number,
  totalCalories: number,
  exerciseCount: number,
  totalBurn: number,
  totalWater: number,
): string {
  if (mealCount === 0 && exerciseCount === 0 && totalWater === 0) {
    return '暂时没有识别到具体的饮食内容，可以换个说法再试试，比如“中午吃了一碗米饭和鸡胸肉”。';
  }
  const parts: string[] = [];
  if (mealCount > 0) parts.push(`识别到 ${mealCount} 项饮食，约 ${totalCalories} kcal`);
  if (exerciseCount > 0) parts.push(`${exerciseCount} 项运动消耗约 ${totalBurn} kcal`);
  if (totalWater > 0) parts.push(`补水约 ${totalWater}ml`);
  return `已为你${parts.join('、')}。这份记录很用心啦，均衡饮食加适度运动，慢慢来就很好～`;
}
