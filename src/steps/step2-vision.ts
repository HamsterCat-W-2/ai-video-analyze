import * as fs from "fs"
import { visionClient, MODELS } from "../clients"

const BATCH_SIZE = 10
const MAX_CONCURRENT = 3

function buildPrompt(n: number): string {
  return `按时间顺序分析这 ${n} 帧画面，对每帧依次描述：
1. 人物：外貌特征（发色、发型、面部）、服装（颜色、款式）、表情
2. 场景：地点类型、背景环境、时间氛围、色调
3. 镜头：景别（特写/近景/中景/全景/远景）、构图方式、光线方向与质感
4. 运镜：静止 / 推进 / 拉远 / 摇移 / 跟拍（根据相邻帧推断）

每帧用 [Frame N] 作为标题，内容简洁，每项不超过2句。`
}

async function analyzeBatch(batchFrames: string[]): Promise<string> {
  const content: any[] = []

  for (let i = 0; i < batchFrames.length; i++) {
    const buffer = await fs.promises.readFile(batchFrames[i])
    const base64 = buffer.toString("base64")
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64}` },
    })
  }

  content.unshift({
    type: "text",
    text: buildPrompt(batchFrames.length),
  })

  const response = await visionClient.chat.completions.create({
    model: MODELS.vision,
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  })

  return response.choices[0]?.message?.content ?? ""
}

export async function step2Vision(frames: string[]): Promise<string> {
  const start = Date.now()
  console.log(`[Step 2][${MODELS.vision}] 开始视觉分析，共 ${frames.length} 帧`)

  const batches: string[][] = []
  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    batches.push(frames.slice(i, i + BATCH_SIZE))
  }

  const results: string[] = []
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT)
    const chunkResults = await Promise.all(
      chunk.map((batch) => analyzeBatch(batch))
    )
    results.push(...chunkResults)
  }

  const visionText = results.join("\n\n---\n\n")
  console.log(`[Step 2][${MODELS.vision}] 完成：${batches.length} 批, ${visionText.length} 字符, 耗时 ${Date.now() - start}ms ...done`)
  return visionText
}
