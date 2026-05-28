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
          content: `你是世界顶级的 AI 绘图提示词工程师，专精角色设计稿（character design sheet）的提示词撰写。你参考以下标杆范例来构建提示词：

【范例】
"A premium anime fantasy character design sheet of an ethereal silver-haired maiden inspired by the Virgo zodiac aesthetic. The entire composition is presented as an official AAA game artbook reference page with structured modular layout sections on a clean white background. The page design feels like a luxury entertainment industry visual development document, combining Japanese RPG concept art aesthetics, editorial layout design, and official character specification sheets. Main character: A tall and slender young woman with extremely long silver-white hair flowing to her ankles, pale porcelain skin, icy blue eyes... Outfit design: She wears a translucent layered white fantasy gown made of chiffon, lace, silk... Page layout includes: full body front view, 3/4 character turnaround, side profile, back view, facial expression sheet, hairstyle studies, hand gesture studies, dynamic pose variations, clothing detail closeups, accessory breakdown panels, color palette swatches, body proportion reference chart, visual development annotations, official character archive page composition. Facial expressions: neutral, gentle smile, melancholic, cold gaze, determined, subtle sadness, elegant confidence. Hand references: spell casting, praying hands, open palm... Hair studies: front hairstyle, side hairstyle, tied hair variation... Visual style: high-end anime concept art, official game character design sheet... Color palette: white, pearl silver, icy blue... Lighting: soft cinematic lighting, volumetric glow... Composition requirements: clean modular layout, editorial presentation... Rendering quality: masterpiece, ultra detailed, 8k quality... Negative prompt: low quality, blurry, bad anatomy..."
【范例结束】

你的每条提示词必须达到上述范例的完整度和细节密度，具体要求：

1. 开头：以专业角色设计稿定位起笔，说明这是 AAA 游戏/动画/电影级别的官方设定稿页面，描述页面整体风格（luxury artbook / editorial layout / concept art reference 等）
2. 主体角色描述（2-4 句）：精确描写体型、身高比例、面部特征、皮肤/外壳质感、眼睛颜色与光效、气质与神态
3. 服装/外观设计（2-4 句）：逐层描写材质（皮革/金属/布料等）、配色、装饰细节、品牌感工艺细节
4. 页面布局视图（必须列出 12-15 个视图）：full body front view, 3/4 character turnaround, side profile, back view, facial expression sheet, hairstyle studies, hand gesture studies, dynamic pose variations, clothing detail closeups, accessory breakdown panels, color palette swatches, body proportion reference chart, visual development annotations, official character archive page composition
5. 面部表情（6-8 种）：根据角色性格选择，每个表情用 2-3 词描述
6. 手势参考（4-5 种）：与角色身份匹配，每个手势 2-4 词
7. 发型/头部研究（4-6 种）：不同角度或变体
8. 视觉风格（6-10 个关键词）：艺术风格、渲染风格、灵感来源
9. 色板（5-7 个颜色）：用英文色名 + hex 值
10. 光影（2-3 句）：光源方向、氛围、光晕效果
11. 构图要求（6-8 项）：排版、间距、层级、可读性
12. 渲染质量（6-8 项）：分辨率、材质模拟、细节程度
13. 负面提示词（10-15 项）：常见瑕疵

整个提示词必须是一段连贯流畅的英文描述（不是编号列表），自然融合以上所有要素。总长度要求 3500-5000 字符。

只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。`,
        },
        {
          role: "user",
          content: `根据以下视频帧分析，提取视频中出现的所有可辨识角色。注意：不要遗漏任何角色，包括人类、机器人、动物伙伴、宠物、怪物、配角、路人等。每个在画面中反复出现或有辨识度的个体都应单独列为一个角色。为每个角色生成一条完整的【GPT-Image-2 高稳定性】角色设计稿提示词。

视觉分析：
${visionText}

字幕参考：
${transcript.slice(0, 800)}

返回 JSON 数组，每个元素格式如下：
{
  "name": "角色名或描述（如男主/女主/机器人牛仔/鸵鸟伙伴）",
  "appearance": "英文外貌描述，3-5 句，包含体型、面部/面具、服装/外表、配饰、气质、动作特征",
  "sd_tags": "SDXL 兼容英文标签，逗号分隔，25-35 个标签，必须包含：角色物理特征(10+)、服装配饰(5+)、风格关键词(5+)、画质标签(5+)",
  "lora_suggestion": "推荐 LoRA 类型，说明适合什么风格的角色 LoRA，2-3 句",
  "gpt_image_prompt": "完整的 GPT-Image-2 高稳定性角色设计稿提示词，英文，3500-5000 字符。参考以下结构自然融合为连贯英文段落：以专业设计稿定位起笔(AAA game/animation artbook reference page) → 主体角色外貌详细描写(体型比例、面部特征、皮肤质感、眼睛、气质) → 服装/外观逐层设计(材质、配色、装饰工艺、层次) → 页面布局视图列表(12-15个视图: full body front view, 3/4 character turnaround, side profile, back view, facial expression sheet, hairstyle studies, hand gesture studies, dynamic pose variations, clothing detail closeups, accessory breakdown panels, color palette swatches, body proportion reference chart, visual development annotations, official character archive page composition) → 面部表情表(6-8种表情) → 手势参考(4-5种) → 发型/头部研究(4-6种变体) → 视觉风格关键词(6-10个) → 色板(5-7个颜色, 含英文名+hex值) → 光影氛围(2-3句) → 构图排版要求(6-8项) → 渲染质量(6-8项) → 负面提示词(10-15项)。所有要素自然融合为连贯段落，不是编号列表。",
  "color_palette": ["#色值1", "#色值2", "#色值3", "#色值4", "#色值5"],
  "lighting": "光影描述，英文，2-3 句，包含光源方向、氛围、光晕效果",
  "reference_views": ["full body front view", "3/4 character turnaround", "side profile", "back view", "facial expression sheet", "hairstyle studies", "hand gesture studies", "dynamic pose variations", "clothing detail closeups", "accessory breakdown panels", "color palette swatches", "body proportion reference chart"],
  "negative_prompt": "负面提示词，英文逗号分隔，10-15 项常见瑕疵"
}

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
