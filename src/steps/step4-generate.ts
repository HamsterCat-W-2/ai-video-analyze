import OpenAI from "openai"
import type { Character, Story, Shot } from "../types"

const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const MODEL = "deepseek-chat"
const TEMPERATURE = 0.2  // 低温度，输出更稳定可控

/** 清理 LLM 返回中可能残留的 markdown 代码块标记 */
function cleanJson(text: string): string {
  return text.replace(/```json|```/g, "").trim()
}

/** 4A: 生成人物角色提示词 */
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

重要：区分人类角色和非人类主体（动物、机械体、雕像、玩偶、幻想生物、特效角色等）。
非人类角色的 sd_tags 必须包含其类型标签（如 robot, animal, sculpture, creature, doll 等）。

视觉分析：
${visionText}

字幕参考：
${transcript.slice(0, 800)}

返回 JSON 数组，每个角色的结构：
[
  {
    "name": "角色名或简短描述（如：男主、女主角、骑手、群众等）",
    "appearance": "英文外貌描述，用于 SD img2img 参考，需包含材质/质感信息",
    "sd_tags": "SDXL 兼容的英文标签，逗号分隔，需包含角色类型 + 性别 + 发型/外形 + 服装/配件 + 表情风格",
    "lora_suggestion": "推荐的 LoRA 模型类型名称",
    "negative_prompt": "该角色的负面提示词，用于避免生成错误特征",
    "ai_prompt": "通用的英文自然语言角色描述，可直接复制到任何 AI 工具生成该角色。用完整句子描述角色的外观、材质、服装、气质，不要用标签格式"
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

/** 4B: 生成故事设定提示词 */
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

/** 4C: 生成分镜提示词 */
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
    "sd_prompt": "完整的英文 Stable Diffusion 提示词，包含画质词、风格词、场景词，逗号分隔",
    "ai_prompt": "通用的英文自然语言场景描述，可直接复制到任何 AI 工具（SD/MidJourney/DALL-E/Sora 等）使用。要求：完整的句子描述，包含角色外观、动作、场景环境、光线氛围，不要用标签格式，要用流畅的自然语言"
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
  master_prompt: string
}

/** 4D: 生成全局 master prompt */
async function generateMasterPrompt(visionText: string, transcript: string): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "你是专业的 AI 内容创作提示词工程师。只返回纯文本，不要有 markdown 或多余格式。",
        },
        {
          role: "user",
          content: `根据以下视频分析，生成一段全局风格描述（master prompt），可作为所有分镜的基础前缀。

视觉分析（摘要）：
${visionText.slice(0, 2000)}

字幕参考：
${transcript.slice(0, 800)}

要求：
- 英文自然语言描述，2-4 句话
- 包含：整体画风（写实/卡通/赛博朋克等）、世界观背景、色调氛围、核心角色组合
- 这段描述会被放在每个分镜 prompt 的前面，作为统一风格锚点
- 直接输出描述文本，不要有任何前缀或格式标记`,
        },
      ],
    })

    return response.choices[0]?.message?.content ?? ""
  } catch (err) {
    console.error("[Step 4D] Master prompt 生成失败:", err)
    return ""
  }
}

/**
 * Step 4: 并行生成四类提示词
 * 四个请求互相独立，用 Promise.all 并发调用 DeepSeek
 */
export async function step4Generate(visionText: string, transcript: string): Promise<GeneratedResult> {
  const start = Date.now()
  console.log("[Step 4] 开始生成提示词（DeepSeek）")
  console.log(`[Step 4] 输入：视觉文本 ${visionText.length} 字符, 字幕 ${transcript.length} 字符`)

  console.log("[Step 4] 并行请求：4A人物 + 4B故事 + 4C分镜 + 4D Master Prompt")
  const [characters, story, shots, master_prompt] = await Promise.all([
    generateCharacters(visionText, transcript),
    generateStory(visionText, transcript),
    generateShots(visionText),
    generateMasterPrompt(visionText, transcript),
  ])

  console.log(`[Step 4] 完成：${characters.length} 个人物, ${shots.length} 个分镜, master_prompt ${master_prompt.length} 字符, 耗时 ${Date.now() - start}ms`)
  return { characters, story, shots, master_prompt }
}
