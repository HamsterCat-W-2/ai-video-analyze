import {
  CharacterSchema,
  StorySchema,
  ShotSchema,
  type Character,
  type Story,
  type Shot,
  type PromptPack,
  type PipelineContext,
} from "../types"
import type { GeneratedResult } from "./step4-generate"

/**
 * Step 5: 数据校验 + 格式化
 * 用 Zod safeParse 校验每类数据，失败时使用空默认值而非报错
 * 最终组装为完整的 PromptPack 返回
 */
export function step5Validate(
  ctx: PipelineContext,
  generated: GeneratedResult
): PromptPack {
  const start = Date.now()
  console.log("[Step 5] 校验 + 格式化 ...")

  // 校验人物列表，格式不符则返回空数组
  const charactersResult = CharacterSchema.array().safeParse(generated.characters)
  const characters: Character[] = charactersResult.success ? charactersResult.data : []

  // 校验故事设定，格式不符则返回空默认值
  const storyResult = StorySchema.safeParse(generated.story)
  const story: Story = storyResult.success
    ? storyResult.data
    : { genre: [], worldview: "", plot_bible: "", tone: "" }

  // 校验分镜列表，格式不符则返回空数组
  const shotsResult = ShotSchema.array().safeParse(generated.shots)
  const shots: Shot[] = shotsResult.success ? shotsResult.data : []

  // 组装最终结果，补充元数据
  const result: PromptPack = {
    video_id: ctx.videoId,
    characters,
    story,
    shots,
    processing_time_ms: Date.now() - ctx.startTime,
  }

  console.log(`[Step 5] ...done（耗时 ${Date.now() - start}ms）`)
  return result
}
