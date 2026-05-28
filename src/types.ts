import { z } from "zod"

/** 人物角色 */
export const CharacterSchema = z.object({
  name: z.string(),
  appearance: z.string(),
  sd_tags: z.string(),
  lora_suggestion: z.string(),
  /** 角色设定稿完整提示词（GPT-Image-2 高稳定性格式） */
  gpt_image_prompt: z.string(),
  /** 色板 */
  color_palette: z.array(z.string()),
  /** 光影描述 */
  lighting: z.string(),
  /** 推荐视图列表 */
  reference_views: z.array(z.string()),
  /** 负面提示词 */
  negative_prompt: z.string(),
})

/** 分镜 */
export const ShotSchema = z.object({
  index: z.number(),
  timestamp: z.string(),
  shot_type: z.enum(["close-up", "medium", "wide", "extreme-close-up"]),
  composition: z.string(),
  lighting: z.string(),
  camera_motion: z.enum(["static", "push-in", "pull-out", "pan", "follow", "handheld"]),
  sd_prompt: z.string(),
})

/** 故事设定 */
export const StorySchema = z.object({
  genre: z.array(z.string()),
  worldview: z.string(),
  plot_bible: z.string(),
  tone: z.string(),
})

/** 最终输出 */
export const PromptPackSchema = z.object({
  video_id: z.string(),
  duration_seconds: z.number().optional(),
  characters: z.array(CharacterSchema),
  story: StorySchema,
  shots: z.array(ShotSchema),
  models_used: z.object({
    vision: z.string(),
    asr: z.string(),
    llm: z.string(),
  }),
  processing_time_ms: z.number().optional(),
})

export type Character = z.infer<typeof CharacterSchema>
export type Shot = z.infer<typeof ShotSchema>
export type Story = z.infer<typeof StorySchema>
export type PromptPack = z.infer<typeof PromptPackSchema>

export interface PipelineContext {
  videoId: string
  videoPath: string
  tmpDir: string
  frames: string[]
  audioPath: string
  visionText: string
  transcript: string
  startTime: number
}
