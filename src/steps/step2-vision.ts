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
  return `Analyze these ${n} frames in chronological order. For each frame, describe:
1. Characters: All subjects in the frame, distinguish humans from non-humans (animals, mechanical beings, sculptures, dolls, fantasy creatures, VFX characters, etc.). Describe each character's: appearance/material features, clothing/accessories, expression/pose. Non-human subjects must be clearly labeled by type.
2. Scene: Location type, background environment, time/atmosphere, color palette
3. Shot: Framing (close-up / medium / wide / extreme close-up), composition, lighting direction and quality
4. Camera movement: static / push-in / pull-out / pan / follow / handheld (infer from adjacent frames)

Use [Frame N] as heading for each frame. Keep it concise — max 2 sentences per item.

Content safety (MUST follow):
- NEVER describe: graphic violence, gore, blood, injury, weapons, self-harm, sexual content, nudity, child endangerment, bullying, hate speech
- Banned words: blood, gore, wound, rotting, corpse, dead, kill, weapon, gun, knife, flesh, naked, nude, sexual, abuse, suicide
- If a frame contains disturbing content, use safe cinematic equivalents: "tense confrontation" (violence), "still figures" (bodies), "dramatic shadows" (blood), "mysterious objects" (weapons), "shadowy figures" (undead), "eerie atmosphere" (horror)
- Focus on: composition, lighting, color palette, atmosphere, character poses, fashion, architecture`
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
  console.log(`[Step 2] 开始视觉分析，共 ${frames.length} 帧`)

  // 将帧列表按 BATCH_SIZE 分组
  const batches: string[][] = []
  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    batches.push(frames.slice(i, i + BATCH_SIZE))
  }
  console.log(`[Step 2] 分为 ${batches.length} 批，每批最多 ${BATCH_SIZE} 帧，并发上限 ${MAX_CONCURRENT}`)

  // 按 MAX_CONCURRENT 控制并发，每轮最多同时请求 3 批
  const results: string[] = []
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT)
    const round = Math.floor(i / MAX_CONCURRENT) + 1
    console.log(`[Step 2] 第 ${round} 轮：处理批次 ${i + 1}-${Math.min(i + MAX_CONCURRENT, batches.length)}`)
    const chunkResults = await Promise.all(
      chunk.map((batch) => analyzeBatch(batch))
    )
    results.push(...chunkResults)
  }

  // 所有批次用分隔线拼接
  const visionText = results.join("\n\n---\n\n")
  console.log(`[Step 2] 完成：${batches.length} 批分析结果, 文本长度 ${visionText.length} 字符, 耗时 ${Date.now() - start}ms`)
  return visionText
}
