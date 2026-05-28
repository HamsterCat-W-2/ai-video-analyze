import type { Character, Story, Shot } from "../types"
import { llmClient, MODELS } from "../clients"

const TEMPERATURE = 0.2

function cleanJson(text: string): string {
  return text.replace(/```json|```/g, "").trim()
}

async function generateCharacters(visionText: string, transcript: string): Promise<Character[]> {
  try {
    const response = await llmClient.chat.completions.create({
      model: MODELS.llm,
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

返回 JSON 数组：
[{
  "name": "角色名或描述（如男主/女主）",
  "appearance": "英文外貌描述",
  "sd_tags": "SDXL 兼容英文标签，逗号分隔",
  "lora_suggestion": "推荐 LoRA 类型"
}]

只输出 JSON 数组。`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "[]"
    return JSON.parse(cleanJson(content))
  } catch (err) {
    console.error("[Step 4A] Character prompt generation failed:", err)
    return []
  }
}

async function generateStory(visionText: string, transcript: string): Promise<Story> {
  const defaultStory: Story = { genre: [], worldview: "", plot_bible: "", tone: "" }

  try {
    const response = await llmClient.chat.completions.create({
      model: MODELS.llm,
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
  "genre": ["风格标签"],
  "worldview": "世界观，1-2句",
  "plot_bible": "故事梗概，100-200字",
  "tone": "情感基调，英文"
}

只输出 JSON 对象。`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "{}"
    return JSON.parse(cleanJson(content))
  } catch (err) {
    console.error("[Step 4B] Story prompt generation failed:", err)
    return defaultStory
  }
}

async function generateShots(visionText: string): Promise<Shot[]> {
  try {
    const response = await llmClient.chat.completions.create({
      model: MODELS.llm,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "你是专业的 AI 视频分镜师和 Stable Diffusion 提示词工程师。只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。",
        },
        {
          role: "user",
          content: `根据以下视频帧分析，提取关键分镜，最多 20 个场景。

视觉分析：
${visionText}

返回 JSON 数组：
[{
  "index": 序号,
  "timestamp": "HH:MM:SS",
  "shot_type": "close-up | medium | wide | extreme-close-up",
  "composition": "构图描述",
  "lighting": "光线描述",
  "camera_motion": "static | push-in | pull-out | pan | follow | handheld",
  "sd_prompt": "完整英文 SD 提示词，逗号分隔"
}]

只输出 JSON 数组。`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "[]"
    return JSON.parse(cleanJson(content))
  } catch (err) {
    console.error("[Step 4C] Shot prompt generation failed:", err)
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
  console.log(`[Step 4][${MODELS.llm}] Starting prompt generation`)
  console.log(`[Step 4] Input: vision text ${visionText.length} chars, transcript ${transcript.length} chars`)

  const [characters, story, shots] = await Promise.all([
    generateCharacters(visionText, transcript),
    generateStory(visionText, transcript),
    generateShots(visionText),
  ])

  console.log(`[Step 4][${MODELS.llm}] Done: ${characters.length} characters, ${shots.length} shots, took ${Date.now() - start}ms ...done`)
  return { characters, story, shots }
}
