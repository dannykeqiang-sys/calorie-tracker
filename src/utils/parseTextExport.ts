/**
 * 解析「文字摘要版(.txt)」导出格式
 */
import type { DailyRecord, FoodItem, ExerciseItem, WaterItem, MealRecord } from '../types';

const MEAL_KEY_MAP: Record<string, keyof MealRecord> = {
  '早餐': 'breakfast',
  '午餐': 'lunch',
  '晚餐': 'dinner',
  '加餐': 'snack',
};

function makeEmptyMeals(): MealRecord {
  return { breakfast: [], lunch: [], dinner: [], snack: [] };
}

/** 从日期行提取日期，如 "[ 2026-06-12 周五 ]" → "2026-06-12" */
function extractDate(line: string): string | null {
  const m = line.match(/\[\s*(\d{4}-\d{2}-\d{2})\s/);
  return m ? m[1] : null;
}

/** 解析一行饮食记录："    - 黄瓜×2  30 kcal" → { name, calories } */
function parseMealLine(line: string): { name: string; calories: number } | null {
  // 去掉前导 "    - "
  const trimmed = line.replace(/^\s*-\s*/, '').trim();
  // kcal 在末尾
  const kcalMatch = trimmed.match(/(\d+)\s*kcal\s*$/i);
  if (!kcalMatch) return null;
  const calories = parseInt(kcalMatch[1], 10);
  const name = trimmed.slice(0, kcalMatch.index).trim();
  if (!name) return null;
  return { name, calories };
}

/** 解析一行运动记录："    - 练腿  -111 kcal" → { name, calories } */
function parseExerciseLine(line: string): { name: string; calories: number } | null {
  const trimmed = line.replace(/^\s*-\s*/, '').trim();
  // 热量是最后一个数字，带负号
  const kcalMatch = trimmed.match(/-\s*(\d+)\s*kcal\s*$/i);
  if (!kcalMatch) return null;
  const calories = parseInt(kcalMatch[1], 10);
  let name = trimmed.slice(0, kcalMatch.index).trim();
  // 去掉尾部的 "  30分钟" 之类的时长描述 → 合并到名称中
  if (!name) return null;
  return { name, calories };
}

/** 解析一行饮水记录："    - 250 ml（抹茶拿铁）  14:31" → { amount, note, time } */
function parseWaterLine(line: string): { amount: number; note: string; time: string } | null {
  const trimmed = line.replace(/^\s*-\s*/, '').trim();
  // 匹配: AMOUNT ml（NOTE）  TIME  或  AMOUNT ml  TIME
  const m = trimmed.match(/^(\d+)\s*ml\s*(?:（([^）]*)）)?\s*(\d{1,2}:\d{2})?\s*$/);
  if (!m) return null;
  const amount = parseInt(m[1], 10);
  const note = (m[2] || '').trim();
  const time = (m[3] || '').trim();
  if (isNaN(amount) || amount <= 0) return null;
  return { amount, note, time };
}

export function parseTextExport(content: string): DailyRecord[] | null {
  try {
    // 按分隔线切分每天的数据块
    const blocks = content.split(/[─━]+/).filter(b => b.trim());
    const records: DailyRecord[] = [];

    for (const block of blocks) {
      const lines = block.split('\n');
      let currentDate = '';
      let currentSection: 'meals' | 'exercises' | 'water' | null = null;
      let currentMealType: keyof MealRecord | null = null;
      let meals = makeEmptyMeals();
      let exercises: ExerciseItem[] = [];
      let water: WaterItem[] = [];

      const saveDay = () => {
        if (currentDate) {
          records.push({
            date: currentDate,
            meals: { ...meals },
            exercises: [...exercises],
            water: water.length > 0 ? [...water] : undefined,
          });
        }
        // 为新一天创建全新对象
        meals = makeEmptyMeals();
        exercises = [];
        water = [];
        currentSection = null;
        currentMealType = null;
      };

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        // 跳过空行和表头
        if (!line.trim() || line.startsWith('════') || line.includes('健康记录数据导出') ||
            line.includes('导出时间') || (line.includes('共 ') && line.includes('天数据'))) {
          continue;
        }

        // 检测日期行
        const date = extractDate(line);
        if (date) {
          saveDay();  // 保存上一天
          currentDate = date;
          continue;
        }

        if (!currentDate) continue; // 还没找到日期，跳过

        // 检测饮食段落标题
        let foundMeal = false;
        for (const [label, key] of Object.entries(MEAL_KEY_MAP)) {
          if (line.trim().startsWith(label + '：')) {
            currentSection = 'meals';
            currentMealType = key;
            foundMeal = true;
            break;
          }
        }
        if (foundMeal) continue;

        // 检测运动段落标题
        if (line.trim().startsWith('运动：')) {
          currentSection = 'exercises';
          currentMealType = null;
          continue;
        }

        // 检测饮水段落标题
        if (line.trim().startsWith('饮水：')) {
          currentSection = 'water';
          currentMealType = null;
          continue;
        }

        // 跳过小计/合计/消耗行
        if (/^(小计|合计|消耗)[：:]/.test(line.trim())) continue;

        // 解析内容行
        if (line.trim().startsWith('-')) {
          if (currentSection === 'meals' && currentMealType) {
            const parsed = parseMealLine(line);
            if (parsed) {
              meals[currentMealType] = [...meals[currentMealType], {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                name: parsed.name,
                calories: parsed.calories,
              }];
            }
          } else if (currentSection === 'exercises') {
            const parsed = parseExerciseLine(line);
            if (parsed) {
              exercises.push({
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                name: parsed.name,
                calories: parsed.calories,
                duration: 0,
              });
            }
          } else if (currentSection === 'water') {
            const parsed = parseWaterLine(line);
            if (parsed) {
              water.push({
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                amount: parsed.amount,
                note: parsed.note || undefined,
                time: parsed.time,
              });
            }
          }
        }
      }

      // 保存最后一天
      saveDay();
    }

    return records.length > 0 ? records : null;
  } catch {
    return null;
  }
}
