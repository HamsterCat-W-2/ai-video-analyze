import OpenAI from "openai"
import type { Character, Story, Shot } from "../types"

const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const MODEL = "deepseek-chat"
const TEMPERATURE = 0.2

function cleanJson(text: string): string {
  return text.replace(/```json|```/g, "").trim()
}

async function generateCharacters(visionText: string, transcript: string): Promise<Character[]> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "你是专业的 AI 绘图提示词工程师。只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。",
        },
        {
          role: "user",
          content: `根据以下视频帧分析，提取视频中出现的所有主要角色。

视觉分析：
${visionText}

字幕参考：
${transcript.slice(0, 800)}

返回 JSON 数组，每个角色的结构：
[
  {
    "name": "角色名或描述（如男主/女主）",
    "appearance": "英文外貌描述，用于 SD img2img 参考",
    "sd_tags": "SDXL 兼容的英文标签，逗号分隔，包含性别/发型/服装/表情风格",
    "lora_suggestion": "推荐的 LoRA 模型类型名称"
  }
]

只输出 JSON 数组，没有其他内容。`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "[]"
    return JSON.parse(cleanJson(content))
  } catch (err) {
    console.error("[Step 4A] 人物提示词生成失败:", err)
    return []
  }
}

async function generateStory(visionText: string, transcript: string): Promise<Story> {
  const defaultStory: Story = {
    genre: [],
    worldview: "",
    plot_bible: "",
    tone: "",
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "你是专业的 AI 短剧内容分析师。只返回合法 JSON 对象，不要有任何 markdown 代码块或多余文字。",
        },
        {
          role: "user",
          content: `根据以下视觉分析和字幕，提取故事设定。

视觉分析（摘要）：
${visionText.slice(0, 1500)}

字幕转录：
${transcript}

返回 JSON 对象：
{
  "genre": ["风格标签1", "风格标签2"],
  "worldview": "世界观和背景设定，1-2句",
  "plot_bible": "故事梗概，100-200字，包含主要人物关系和核心冲突",
  "tone": "情感基调，英文，如 lighthearted romance / dark thriller"
}

只输出 JSON 对象，没有其他内容。`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "{}"
    return JSON.parse(cleanJson(content))
  } catch (err) {
    console.error("[Step 4B] 故事提示词生成失败:", err)
    return defaultStory
  }
}

async function generateShots(visionText: string): Promise<Shot[]> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "你是专业的 AI 视频分镜师和 Stable Diffusion 提示词工程师。只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。",
        },
        {
          role: "user",
          content: `根据以下视频帧分析，提取关键分镜，最多输出 20 个场景。

视觉分析：
${visionText}

返回 JSON 数组，每个分镜的结构：
[
  {
    "index": 序号从1开始,
    "timestamp": "估算时间戳，格式 HH:MM:SS",
    "shot_type": "close-up 或 medium 或 wide 或 extreme-close-up",
    "composition": "构图描述，如 rule of thirds / centered / symmetrical",
    "lighting": "光线描述，如 warm side lighting / cold backlight",
    "camera_motion": "static 或 push-in 或 pull-out 或 pan 或 follow 或 handheld",
    "sd_prompt": "完整的英文 Stable Diffusion 提示词，包含画质词、风格词、场景词，逗号分隔"
  }
]

只输出 JSON 数组，没有其他内容。`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "[]"
    return JSON.parse(cleanJson(content))
  } catch (err) {
    console.error("[Step 4C] 分镜提示词生成失败:", err)
    return []
  }
}

export interface GeneratedResult {
  characters: Character[]
  story: Story
  shots: Shot[]
}

export async function step4Generate(visionText: string, transcript: string): Promise<GeneratedResult> {
  const start = Date.now()
  console.log("[Step 4] 生成三类提示词（DeepSeek）...")

  const [characters, story, shots] = await Promise.all([
    generateCharacters(visionText, transcript),
    generateStory(visionText, transcript),
    generateShots(visionText),
  ])

  console.log(`[Step 4] ...done（耗时 ${Date.now() - start}ms）`)
  return { characters, story, shots }
}
