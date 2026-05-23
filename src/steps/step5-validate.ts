import { randomBytes } from "crypto"
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

export function step5Validate(
  ctx: PipelineContext,
  generated: GeneratedResult
): PromptPack {
  const start = Date.now()
  console.log("[Step 5] 校验 + 格式化 ...")

  const charactersResult = CharacterSchema.array().safeParse(generated.characters)
  const characters: Character[] = charactersResult.success ? charactersResult.data : []

  const storyResult = StorySchema.safeParse(generated.story)
  const story: Story = storyResult.success
    ? storyResult.data
    : { genre: [], worldview: "", plot_bible: "", tone: "" }

  const shotsResult = ShotSchema.array().safeParse(generated.shots)
  const shots: Shot[] = shotsResult.success ? shotsResult.data : []

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
