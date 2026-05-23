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
  console.log("[Step 5] 开始数据校验 + 格式化")

  // 校验人物列表，格式不符则返回空数组
  const charactersResult = CharacterSchema.array().safeParse(generated.characters)
  const characters: Character[] = charactersResult.success ? charactersResult.data : []
  if (!charactersResult.success) {
    console.warn("[Step 5] 人物数据校验失败，使用空数组:", charactersResult.error?.issues)
  }

  // 校验故事设定，格式不符则返回空默认值
  const storyResult = StorySchema.safeParse(generated.story)
  const story: Story = storyResult.success
    ? storyResult.data
    : { genre: [], worldview: "", plot_bible: "", tone: "" }
  if (!storyResult.success) {
    console.warn("[Step 5] 故事数据校验失败，使用默认值:", storyResult.error?.issues)
  }

  // 校验分镜列表，格式不符则返回空数组
  const shotsResult = ShotSchema.array().safeParse(generated.shots)
  const shots: Shot[] = shotsResult.success ? shotsResult.data : []
  if (!shotsResult.success) {
    console.warn("[Step 5] 分镜数据校验失败，使用空数组:", shotsResult.error?.issues)
  }

  // 组装最终结果，补充元数据
  const totalTime = Date.now() - ctx.startTime
  const result: PromptPack = {
    video_id: ctx.videoId,
    characters,
    story,
    shots,
    processing_time_ms: totalTime,
  }

  console.log(`[Step 5] 完成：video_id=${ctx.videoId}, 人物=${characters.length}, 分镜=${shots.length}, 总耗时=${totalTime}ms`)
  return result
}
