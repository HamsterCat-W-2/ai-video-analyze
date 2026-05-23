import OpenAI from "openai"
import * as fs from "fs"

// 使用 OpenAI SDK 兼容模式调用阿里云百炼 Qwen2.5-VL
const client = new OpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.DASHSCOPE_API_KEY,
})

const BATCH_SIZE = 10       // 每批处理 10 帧
const MAX_CONCURRENT = 3    // 最多 3 批并发，避免触发 429 限流

/** 构造视觉分析的提示词 */
function buildPrompt(n: number): string {
  return `按时间顺序分析这 ${n} 帧画面，对每帧依次描述：
1. 人物：出现的所有人物的外貌特征（发色、发型、面部）、服装（颜色、款式）、表情
2. 场景：地点类型、背景环境、时间氛围、色调
3. 镜头：景别（特写/近景/中景/全景/远景）、构图方式、光线方向与质感
4. 运镜：静止 / 推进 / 拉远 / 摇移 / 跟拍（根据相邻帧推断）

每帧用 [Frame N] 作为标题，内容简洁，每项不超过2句。`
}

/**
 * 分析一批帧图片
 * 将图片读取为 base64，与提示词一起发送给 Qwen2.5-VL-72B
 */
async function analyzeBatch(batchFrames: string[]): Promise<string> {
  const content: any[] = []

  // 将每张帧图片转为 base64 格式
  for (let i = 0; i < batchFrames.length; i++) {
    const buffer = await fs.promises.readFile(batchFrames[i])
    const base64 = buffer.toString("base64")
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64}` },
    })
  }

  // 提示词放在图片列表前面
  content.unshift({
    type: "text",
    text: buildPrompt(batchFrames.length),
  })

  const response = await client.chat.completions.create({
    model: "qwen2.5-vl-72b-instruct",
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  })

  return response.choices[0]?.message?.content ?? ""
}

/**
 * Step 2: 视觉分析
 * 将帧按批次分组，控制并发调用 Qwen2.5-VL-72B，拼接所有批次结果
 */
export async function step2Vision(frames: string[]): Promise<string> {
  const start = Date.now()
  console.log(`[Step 2] 视觉分析，共 ${frames.length} 帧 ...`)

  // 将帧列表按 BATCH_SIZE 分组
  const batches: string[][] = []
  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    batches.push(frames.slice(i, i + BATCH_SIZE))
  }

  // 按 MAX_CONCURRENT 控制并发，每轮最多同时请求 3 批
  const results: string[] = []
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT)
    const chunkResults = await Promise.all(
      chunk.map((batch) => analyzeBatch(batch))
    )
    results.push(...chunkResults)
  }

  // 所有批次用分隔线拼接
  const visionText = results.join("\n\n---\n\n")
  console.log(`[Step 2] ...done（耗时 ${Date.now() - start}ms）`)
  return visionText
}
