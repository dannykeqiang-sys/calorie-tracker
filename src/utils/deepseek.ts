const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export async function streamReview(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: true,
        temperature: 0.7,
      }),
    });
  } catch {
    callbacks.onError(new Error('网络请求失败，请检查网络连接'));
    return;
  }

  if (!response.ok) {
    callbacks.onError(new Error(`API 请求失败 (${response.status})，请检查 API Key 是否正确`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error('无法读取响应流'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) callbacks.onChunk(content);
        } catch {
          // skip malformed chunks
        }
      }
    }
    callbacks.onDone();
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function streamChatWithContext(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.7,
      }),
    });
  } catch {
    callbacks.onError(new Error('网络请求失败，请检查网络连接'));
    return;
  }

  if (!response.ok) {
    callbacks.onError(new Error(`API 请求失败 (${response.status})，请检查 API Key 是否正确`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error('无法读取响应流'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) callbacks.onChunk(content);
        } catch {
          // skip malformed chunks
        }
      }
    }
    callbacks.onDone();
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

export interface CalorieEstimate {
  food_name: string;
  estimated_weight: string;
  calories: number;
  reason: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  sodium?: number;
}

export async function estimateCalories(
  apiKey: string,
  foodDescription: string,
): Promise<CalorieEstimate> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个食物营养换算助手。请分析用户输入的食物描述（可能来自语音识别，包含错别字请自行纠正），根据常识估算其卡路里、三大宏营养素和钠含量。请严格返回 JSON 格式：{"food_name":"纠正后的标准食物名","estimated_weight":"估算重量","calories":整数,"protein":蛋白质克数,"carbs":碳水克数,"fat":脂肪克数,"sodium":钠毫克整数,"reason":"温柔的估算理由"}，所有数值为纯数字不含单位。⚠️重要：若用户提到数量（如"两个鸡蛋"、"三块饼干"），calories/protein/carbs/fat/sodium均必须是该总数量的合计值而非单个值，food_name中注明数量（如"鸡蛋×2"）。钠含量参考：白米饭(100g)≈1mg、鸡蛋(1个)≈70mg、牛奶(200ml)≈100mg、面包(1片)≈170mg、火腿(100g)≈700mg、方便面(1包)≈1500mg、酱油(1汤匙)≈900mg。',
        },
        { role: 'user', content: foodDescription },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as CalorieEstimate;
}

export interface ParsedFoodItem {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sodium?: number;
}

export interface ParsedExerciseItem {
  name: string;
  calories: number;
}

export interface MixedMealResult {
  has_data: boolean;
  analysis_summary: string;
  data: {
    breakfast: ParsedFoodItem[];
    lunch: ParsedFoodItem[];
    dinner: ParsedFoodItem[];
    snack: ParsedFoodItem[];
    exercises: ParsedExerciseItem[];
    water_logs: WaterLogItem[];
  };
}

export async function parseMixedMeals(
  apiKey: string,
  userInput: string,
): Promise<MixedMealResult> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个温暖的饮食记录助手。用户会用自然语言描述今天吃了什么，可能混合了多个餐段的内容，也可能包含运动信息。请认真分析并将每种食物/饮品拆分为独立条目，估算各自卡路里、三大宏营养素和钠含量；运动同样拆分为独立条目。语气要温暖鼓励。

严格返回如下 JSON 格式，不含任何额外文字：
{
  "has_data": true,
  "analysis_summary": "温暖的一句话总结",
  "data": {
    "breakfast": [{ "name": "食物名称", "calories": 数字, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数, "sodium": 钠含量毫克数 }],
    "lunch": [{ "name": "食物名称", "calories": 数字, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数, "sodium": 钠含量毫克数 }],
    "dinner": [{ "name": "食物名称", "calories": 数字, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数, "sodium": 钠含量毫克数 }],
    "snack": [{ "name": "食物名称", "calories": 数字, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数, "sodium": 钠含量毫克数 }],
    "exercises": [{ "name": "运动名称", "calories": 数字 }],
    "water_logs": [{ "raw_text": "液体简称", "amount": 含水量毫升整数 }]
  }
}

规则：
- 每种食物/饮品单独一个对象，calories/protein/carbs/fat 均为纯数字（克/千卡），sodium 为纯整数毫克(mg)
- ⚠️数量处理：若提到数量（两个、三块、一碗等），该条目的calories/protein/carbs/fat/sodium均必须是该数量的总合计值（而非单份），name中标注数量（如"鸡蛋×2"）
- protein=蛋白质(g)、carbs=碳水化合物(g)、fat=脂肪(g)、sodium=钠(mg)，根据常见食物营养数据库估算
- 钠含量参考：白米饭(100g)≈1mg、白面包(1片)≈170mg、馒头(100g)≈200mg、方便面(1包)≈1500mg、酱油(1汤匙)≈900mg、食盐(1g)≈400mg、火腿(100g)≈700mg、腊肉(100g)≈1000mg、泡菜(100g)≈800mg、薯片(50g)≈400mg、鸡胸肉(100g)≈70mg、鸡蛋(1个)≈70mg、牛奶(200ml)≈100mg、豆腐(100g)≈7mg、苹果(1个)≈1mg
- 无数据的餐段返回空数组 []
- exercises 包含用户提及的所有运动，无运动则返回 []
- 时间线索（早上/中午/晚上/下午）决定归属餐段，无明确时间线索默认归入对应合理餐段
- water_logs：识别所有液体/含水饮品（水、茶、咖啡、牛奶、豆浆、果汁、奶茶、拿铁、汤、粥等），估算实际含水量ml；raw_text为该项简洁描述（≤10字），amount为纯整数ml；无液体则返回 []
- 含水率参考：纯水100%、茶98%、美式95%、豆浆95%、果汁88%、牛奶87%、拿铁83%、奶茶80%、汤90%、粥85%；无分量时按常见份量推断（一杯250ml、一碗300ml）`,
        },
        { role: 'user', content: userInput },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as MixedMealResult;
}

export interface SmartAdviceResult {
  has_data: boolean;
  next_action_trigger: 'next_meal' | 'tomorrow' | 'review';
  today_review: string;
  predictive_advice: {
    title: string;
    energy_target: string;
    diet_strategy: string;
    exercise_suggestion: string;
  };
  health_tips: string;
}

export async function generateSmartAdvice(
  apiKey: string,
  todaySummary: string,
  historyContext: string,
  mode: 'next_meal' | 'tomorrow' | 'review',
): Promise<SmartAdviceResult> {
  const timeStr = new Date().toLocaleString('zh-CN', { hour12: false });
  const isNextMeal = mode === 'next_meal';
  const isReview = mode === 'review';

  const systemPrompt = isReview
    ? `你是温暖的 AI 健康伙伴"卡卡"。语气温柔治愈，绝不制造身材焦虑，不要说教。这是用户某一天的历史饮食与运动数据，请做温柔的复盘分析。

严格返回如下 JSON 格式，所有字段都必须有值，不含任何额外文字：
{
  "has_data": true,
  "next_action_trigger": "review",
  "today_review": "这一天的整体温柔回顾（100字内，关注饮食亮点与情绪价值）",
  "predictive_advice": {
    "title": "这一天的复盘洞察",
    "energy_target": "热量摄入评价与目标对比分析（含具体数字）",
    "diet_strategy": "饮食结构亮点与温柔改进建议（100字内，正向引导）",
    "exercise_suggestion": "运动情况评价与后续建议（60字内，温暖激励）"
  },
  "health_tips": "基于这一天数据的温馨健康提示（60字内，温暖实用）"
}`
    : `你是温暖的 AI 健康伙伴"卡卡"。当前时间：${timeStr}。语气温柔治愈，绝不制造身材焦虑，不要说教。

严格返回如下 JSON 格式，所有字段都必须有值，不含任何额外文字：
{
  "has_data": true,
  "next_action_trigger": "${mode}",
  "today_review": "${isNextMeal ? '今日温柔小复盘（80字内，治愈语气，高情绪价值）' : '今日温柔复盘（100字内，治愈语气，关注趋势与情绪）'}",
  "predictive_advice": {
    "title": "${isNextMeal ? '下一餐轻负担锦囊' : '明日治愈锦囊'}",
    "energy_target": "${isNextMeal ? '本餐建议摄入热量范围（含具体数字）' : '明日建议摄入热量范围（含具体数字）'}",
    "diet_strategy": "${isNextMeal ? '具体的下一餐饮食建议（80字内，轻盈不负重）' : '具体的明日饮食建议（100字内，温柔可执行）'}",
    "exercise_suggestion": "${isNextMeal ? '饭后轻松小运动（50字内，零负担）' : '明日轻松可执行的运动建议（60字内）'}"
  },
  "health_tips": "${isNextMeal ? '今日暖心小贴士（60字内，温暖实用，与饮水或久坐相关）' : '明日健康小贴士（60字内，温暖实用）'}"
}`;

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `今日数据：\n${todaySummary}\n\n近期历史：\n${historyContext}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as SmartAdviceResult;
}

export interface MultiDateEntry {
  date: string;
  meals: {
    breakfast: ParsedFoodItem[];
    lunch: ParsedFoodItem[];
    dinner: ParsedFoodItem[];
    snack: ParsedFoodItem[];
  };
  exercises: ParsedExerciseItem[];
  water_logs: WaterLogItem[];
}

export interface MultiDateImportResult {
  has_data: boolean;
  analysis_summary: string;
  dates: MultiDateEntry[];
}

export async function parseMultiDateMeals(
  apiKey: string,
  userInput: string,
  todayDate: string,
): Promise<MultiDateImportResult> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个多日饮食记录批量导入助手。今天是 ${todayDate}。
用户会用自然语言描述多天的饮食、运动和饮水情况，可能包含相对日期（今天、昨天、前天、大前天、上周X、X月X日等）。请将内容按日期归类，并估算每种食物的卡路里及三大宏营养素，返回结构化JSON。

日期解析规则：
- "今天" → ${todayDate}
- "昨天" → 前一天日期
- "前天" → 前两天日期
- "大前天" → 前三天日期
- "上周X" → 上一个对应星期几的日期
- "X月X日" → 本年对应日期
- 无明确日期的内容默认归入今天

严格返回如下 JSON（不含任何额外文字）：
{
  "has_data": true,
  "analysis_summary": "一句话总结导入内容（≤50字）",
  "dates": [
    {
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": [{"name":"食物名","calories":数字,"protein":蛋白质克数,"carbs":碳水化合物克数,"fat":脂肪克数,"sodium":钠毫克数}],
        "lunch": [{"name":"食物名","calories":数字,"protein":蛋白质克数,"carbs":碳水化合物克数,"fat":脂肪克数,"sodium":钠毫克数}],
        "dinner": [{"name":"食物名","calories":数字,"protein":蛋白质克数,"carbs":碳水化合物克数,"fat":脂肪克数,"sodium":钠毫克数}],
        "snack": [{"name":"食物名","calories":数字,"protein":蛋白质克数,"carbs":碳水化合物克数,"fat":脂肪克数,"sodium":钠毫克数}]
      },
      "exercises": [{"name":"运动名","calories":数字}],
      "water_logs": [{"raw_text":"液体简称","amount":毫升整数}]
    }
  ]
}

规则：
- 每个日期作为独立 dates 元素，dates 按日期升序排列
- 无数据的餐段返回 []，无运动/饮水则返回 []
- 时间线索（早上/中午/晚上/下午）决定餐段归属
- 数量要合计（如"两个鸡蛋"→calories是两个合计），name注明数量（如"鸡蛋×2"）
- protein=蛋白质(g)、carbs=碳水化合物(g)、fat=脂肪(g)、sodium=钠(mg)，必须根据常见食物营养数据库估算，不可省略或留0
- calories/protein/carbs/fat 均为纯数字（无单位），sodium 为纯整数毫克
- 钠含量参考：白米饭(100g)≈1mg、白面包(1片)≈170mg、馒头(100g)≈200mg、方便面(1包)≈1500mg、酱油(1汤匙)≈900mg、火腿(100g)≈700mg、鸡蛋(1个)≈70mg、牛奶(200ml)≈100mg、鸡胸肉(100g)≈70mg
- water_logs 记录所有液体实际含水量（ml），amount 为纯整数`,
        },
        { role: 'user', content: userInput },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as MultiDateImportResult;
}

export interface WaterLogItem {
  raw_text: string;
  amount: number;
}

export interface WaterContentResult {
  has_data: boolean;
  analysis_summary: string;
  data: {
    water_logs: WaterLogItem[];
  };
}

export async function parseWaterContent(
  apiKey: string,
  userInput: string,
): Promise<WaterContentResult> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个含水量计算助手。用户会输入任意食物或饮料描述，可能包含多项。请根据含水率常识，计算每项的实际含水量（ml），拆分为独立条目。

含水率参考：纯水100%，茶/美式95~98%，豆浆95%，黄瓜96%，西瓜92%，草莓91%，冬瓜汤90~95%，鸡汤88~92%，牛奶87%，拿铁/奶茶80~88%，果汁85~90%，粥/稀饭85%，苹果86%，梨85%，香蕉75%。

规则：每项单独一个对象；raw_text为该项简洁描述（≤10字）；amount为实际含水量纯整数ml，最小50；无分量时按常见份量推断（一杯250ml，一碗300ml，一个水果200g）；analysis_summary为1句温暖小结（≤40字）。

严格返回JSON，不含额外文字：{"has_data":true,"analysis_summary":"...","data":{"water_logs":[{"raw_text":"...","amount":数字}]}}`,
        },
        { role: 'user', content: userInput },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as WaterContentResult;
}

export interface PredictiveAdvice {
  title: string;
  energy_target: string;
  diet_strategy: string;
  exercise_suggestion: string;
  health_tips?: string;
}

export interface PredictiveAdviceResult {
  has_data: boolean;
  today_review: string;
  next_action_trigger: 'tomorrow' | 'next_meal';
  predictive_advice: PredictiveAdvice;
}

export async function generatePredictiveAdvice(
  apiKey: string,
  todaySummary: string,
  historyContext: string,
  mode: 'next_meal' | 'tomorrow',
): Promise<PredictiveAdviceResult> {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { hour12: false });

  const systemPrompt = mode === 'next_meal'
    ? `你是温暖的 AI 健康伙伴"卡卡"。当前时间：${timeStr}。用户三餐尚未全部完成，请给出下一餐轻负担锦囊和健康小贴士。语气温柔，不制造焦虑。

严格返回如下 JSON 格式：
{
  "has_data": true,
  "today_review": "今日温柔小复盘（80字内，治愈语气）",
  "next_action_trigger": "next_meal",
  "predictive_advice": {
    "title": "下一餐轻负担锦囊",
    "energy_target": "本餐建议摄入热量范围描述",
    "diet_strategy": "具体的下一餐饮食建议（80字内，轻盈不负重）",
    "exercise_suggestion": "饭后轻松小运动（50字内）",
    "health_tips": "今日健康小贴士（60字内，温暖实用）"
  }
}`
    : `你是温暖的 AI 健康伙伴"卡卡"。当前时间：${timeStr}。用户三餐已完成或时间较晚，请给出明日治愈锦囊。语气温柔，不制造焦虑。

严格返回如下 JSON 格式：
{
  "has_data": true,
  "today_review": "今日温柔小复盘（100字内，治愈语气）",
  "next_action_trigger": "tomorrow",
  "predictive_advice": {
    "title": "明日治愈锦囊",
    "energy_target": "明日建议摄入热量范围描述",
    "diet_strategy": "具体的明日饮食建议（100字内）",
    "exercise_suggestion": "轻松可执行的运动建议（60字内）"
  }
}`;

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `今日数据：\n${todaySummary}\n\n近期历史：\n${historyContext}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`API 请求失败 (${response.status})`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as PredictiveAdviceResult;
}
