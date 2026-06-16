const QWEN_ENDPOINT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-vl-plus';

export interface VisionFoodItem {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  water?: number; // 含水量百分比
  grams?: number; // 估计克数
}

export interface VisionAnalysisResult {
  foods: VisionFoodItem[];
  summary: string;
  mealTypeHint?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface NutritionLabelResult {
  foodName: string;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  servingSize: string | null;
  note: string | null;
}

const SYSTEM_PROMPT = `你是一个专业的营养分析 AI。用户会发送食物照片，请分析并返回 JSON。
要求：
1. 识别照片中所有食物，估计每种食物的克数（g）和热量（kcal）
2. 估计每种食物的三大营养素：蛋白质(g)、碳水(g)、脂肪(g)
3. 估计食物的含水量百分比
4. 根据食物类型推断最可能的餐段：breakfast/lunch/dinner/snack
5. 提供一句温暖的饮食点评（summary）

按如下 JSON 格式返回（只返回 JSON，不要 markdown 代码块）：
{
  "foods": [{ "name": "食物名", "calories": 数字, "protein": 数字, "carbs": 数字, "fat": 数字, "water": 数字, "grams": 数字 }],
  "summary": "温暖的点评",
  "mealTypeHint": "lunch"
}`;

const NUTRITION_LABEL_PROMPT = `你是一个专业的营养标签识别 AI。请读取营养成分表的照片并返回 JSON。
要求：
1. 识别产品名称（foodName）
2. 读取每100g（或每份）的热量和三大营养素含量
3. 如果标签标注的是"每份"而非"每100g"，在servingSize中说明每份的克数

只返回JSON，不要markdown代码块：
{
  "foodName": "产品名称",
  "per100g": { "calories": 数字, "protein": 数字, "carbs": 数字, "fat": 数字 },
  "servingSize": null,
  "note": null
}`;

export async function analyzeFoodImage(
  apiKey: string,
  base64Image: string,
): Promise<VisionAnalysisResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(QWEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              { type: 'text', text: '请分析这张食物照片' },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('请求超时，请检查网络连接');
    throw new Error('网络请求失败，请检查网络连接');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new Error('千问 API Key 无效，请在设置中配置');
    if (status === 402) throw new Error('千问 API 额度不足，请充值或更换 Key');
    if (status === 429) throw new Error('请求过于频繁，请稍后再试');
    if (status >= 500) throw new Error('千问服务暂时不可用，请稍后重试');
    throw new Error(`API 请求失败 (${status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 未返回有效结果');

  let parsed: any;
  try {
    const jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI 返回格式异常，请重试');
  }

  if (!parsed.foods || !Array.isArray(parsed.foods) || parsed.foods.length === 0) {
    throw new Error('未能识别到食物，请确保照片中有清晰的食物');
  }

  return {
    foods: parsed.foods.map((f: any) => ({
      name: String(f.name ?? '未知食物'),
      calories: Number(f.calories ?? 0),
      protein: f.protein != null ? Number(f.protein) : undefined,
      carbs: f.carbs != null ? Number(f.carbs) : undefined,
      fat: f.fat != null ? Number(f.fat) : undefined,
      water: f.water != null ? Number(f.water) : undefined,
      grams: f.grams != null ? Number(f.grams) : undefined,
    })),
    summary: parsed.summary || '已识别食物，请确认',
    mealTypeHint: parsed.mealTypeHint || undefined,
  };
}

/** 读取营养成分表照片 */
export async function analyzeNutritionLabel(
  apiKey: string,
  base64Image: string,
): Promise<NutritionLabelResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(QWEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: NUTRITION_LABEL_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              { type: 'text', text: '请读取这张营养成分表' },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('请求超时，请检查网络连接');
    throw new Error('网络请求失败，请检查网络连接');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new Error('千问 API Key 无效，请在设置中配置');
    if (status === 402) throw new Error('千问 API 额度不足');
    if (status === 429) throw new Error('请求过于频繁，请稍后再试');
    if (status >= 500) throw new Error('千问服务暂时不可用');
    throw new Error(`API 请求失败 (${status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 未返回有效结果');

  let parsed: any;
  try {
    const jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI 返回格式异常，请重试');
  }

  return {
    foodName: String(parsed.foodName ?? '未知产品'),
    per100g: {
      calories: Number(parsed.per100g?.calories ?? 0),
      protein: Number(parsed.per100g?.protein ?? 0),
      carbs: Number(parsed.per100g?.carbs ?? 0),
      fat: Number(parsed.per100g?.fat ?? 0),
    },
    servingSize: parsed.servingSize ?? null,
    note: parsed.note ?? null,
  };
}

/** 将图片文件转为 base64（不含 data URI 前缀） */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 提取纯 base64 数据（去掉 data:image/jpeg;base64, 前缀）
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}
