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
import { MODELS } from "../clients"

const SHOT_TYPE_MAP: Record<string, Shot["shot_type"]> = {
  "medium shot": "medium",
  "wide shot": "wide",
  "close-up shot": "close-up",
  "close up": "close-up",
  "closeup": "close-up",
  "extreme close-up": "extreme-close-up",
  "extreme close up": "extreme-close-up",
  "extremecloseup": "extreme-close-up",
  "medium": "medium",
  "wide": "wide",
  "close-up": "close-up",
  "extreme-close-up": "extreme-close-up",
  "long shot": "wide",
  "full shot": "wide",
  "over-the-shoulder": "medium",
  "two-shot": "medium",
  "bird eye": "wide",
  "aerial": "wide",
}

const CAMERA_MOTION_MAP: Record<string, Shot["camera_motion"]> = {
  "static": "static",
  "push-in": "push-in",
  "push in": "push-in",
  "pull-out": "pull-out",
  "pull out": "pull-out",
  "pan": "pan",
  "panning": "pan",
  "follow": "follow",
  "following": "follow",
  "handheld": "handheld",
  "tracking": "follow",
  "dolly": "push-in",
  "zoom in": "push-in",
  "zoom out": "pull-out",
}

function normalizeShot(raw: any): Shot {
  const shotTypeRaw = String(raw.shot_type ?? "").toLowerCase().trim()
  const shot_type = SHOT_TYPE_MAP[shotTypeRaw] ?? "medium"

  const motionRaw = String(raw.camera_motion ?? "static").toLowerCase().trim()
  const camera_motion = CAMERA_MOTION_MAP[motionRaw] ?? "static"

  return {
    index: Number(raw.index) || 0,
    timestamp: String(raw.timestamp ?? "00:00:00"),
    shot_type,
    composition: String(raw.composition ?? ""),
    lighting: String(raw.lighting ?? ""),
    camera_motion,
    sd_prompt: String(raw.sd_prompt ?? ""),
  }
}

export function step5Validate(
  ctx: PipelineContext,
  generated: GeneratedResult
): PromptPack {
  console.log("[Step 5] 开始数据校验 + 格式化")

  const charactersResult = CharacterSchema.array().safeParse(generated.characters)
  const characters: Character[] = charactersResult.success ? charactersResult.data : []
  if (!charactersResult.success) {
    console.warn("[Step 5] 人物数据校验失败，使用空数组:", charactersResult.error?.issues)
  }

  const storyResult = StorySchema.safeParse(generated.story)
  const story: Story = storyResult.success
    ? storyResult.data
    : { genre: [], worldview: "", plot_bible: "", tone: "" }
  if (!storyResult.success) {
    console.warn("[Step 5] 故事数据校验失败，使用默认值:", storyResult.error?.issues)
  }

  const normalizedShots = Array.isArray(generated.shots)
    ? generated.shots.map(normalizeShot)
    : []
  const shotsResult = ShotSchema.array().safeParse(normalizedShots)
  const shots: Shot[] = shotsResult.success ? shotsResult.data : []
  if (!shotsResult.success) {
    console.warn("[Step 5] 分镜数据校验失败，使用空数组:", shotsResult.error?.issues)
  }

  const totalTime = Date.now() - ctx.startTime
  const result: PromptPack = {
    video_id: ctx.videoId,
    characters,
    story,
    shots,
    models_used: {
      vision: MODELS.vision,
      asr: MODELS.asr,
      llm: MODELS.llm,
    },
    processing_time_ms: totalTime,
  }

  console.log(`[Step 5] 完成：video_id=${ctx.videoId}, 人物=${characters.length}, 分镜=${shots.length}, 总耗时=${totalTime}ms`)
  return result
}
