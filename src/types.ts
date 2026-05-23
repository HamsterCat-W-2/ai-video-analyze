import { z } from "zod"

/** 人物角色：用于 SD/SDXL 绘图的角色描述 */
export const CharacterSchema = z.object({
  name: z.string(),             // 角色名（如"男主"、"女主"）
  appearance: z.string(),       // 英文外貌描述，用于 img2img 参考
  sd_tags: z.string(),          // SDXL 标签，逗号分隔（性别/发型/服装/表情）
  lora_suggestion: z.string(),  // 推荐的 LoRA 模型名称
  negative_prompt: z.string(),  // 负面提示词，避免生成错误特征
})

/** 分镜：单个镜头的视觉描述和 SD 提示词 */
export const ShotSchema = z.object({
  index: z.number(),
  timestamp: z.string(),                                                // HH:MM:SS
  shot_type: z.enum(["close-up", "medium", "wide", "extreme-close-up"]),// 景别
  composition: z.string(),       // 构图（rule of thirds / centered 等）
  lighting: z.string(),          // 光线（warm side lighting 等）
  camera_motion: z.enum(["static", "push-in", "pull-out", "pan", "follow", "handheld"]),
  sd_prompt: z.string(),         // 完整的英文 SD 提示词
  ai_prompt: z.string(),         // 通用自然语言提示词，可直接用于任何 AI 工具生成内容
})

/** 故事设定：世界观、风格、情感基调 */
export const StorySchema = z.object({
  genre: z.array(z.string()),   // 风格标签（如"都市"、"甜宠"）
  worldview: z.string(),        // 世界观和背景设定
  plot_bible: z.string(),       // 故事梗概 100-200 字
  tone: z.string(),             // 英文情感基调
})

/** 最终输出的完整提示词包 */
export const PromptPackSchema = z.object({
  video_id: z.string(),
  duration_seconds: z.number().optional(),
  characters: z.array(CharacterSchema),
  story: StorySchema,
  shots: z.array(ShotSchema),
  master_prompt: z.string(),                  // 全局风格描述，可作为所有 shot 的基础 prompt 前缀
  processing_time_ms: z.number().optional(),  // 总处理耗时
})

export type Character = z.infer<typeof CharacterSchema>
export type Shot = z.infer<typeof ShotSchema>
export type Story = z.infer<typeof StorySchema>
export type PromptPack = z.infer<typeof PromptPackSchema>

/** 流水线内部传递的上下文对象，贯穿五个步骤 */
export interface PipelineContext {
  videoId: string      // 8 位随机 hex ID
  videoPath: string    // 上传的原始视频临时路径
  tmpDir: string       // ffmpeg 输出的临时目录
  frames: string[]     // 抽帧图片路径列表
  audioPath: string    // 音轨文件路径
  visionText: string   // Step 2 视觉分析结果
  transcript: string   // Step 3 语音转录结果
  duration: number     // 视频时长（秒）
  startTime: number    // 流水线开始时间戳
}
