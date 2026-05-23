import OpenAI from "openai"
import type { Character, Story, Shot } from "../types"

const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const MODEL = "deepseek-chat"
const TEMPERATURE = 0.2  // 低温度，输出更稳定可控

/** Clean markdown code fences from LLM response */
function cleanJson(text: string): string {
  return text.replace(/```json|```/g, "").trim()
}

/** 4A: Generate character prompts */
async function generateCharacters(visionText: string, transcript: string): Promise<Character[]> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "You are a professional AI art prompt engineer. Return only a valid JSON array with no markdown code fences or extra text.",
        },
        {
          role: "user",
          content: `Extract the MAIN recurring characters from the following video frame analysis.

CRITICAL RULES:
1. ONLY include characters that appear in MULTIPLE frames (2+). A character mentioned in only one frame is likely a background element, not a main character.
2. DO NOT include incidental objects, props, furniture, or background decorations as characters.
3. DO NOT hallucinate or infer characters that are not explicitly described in the vision analysis.
4. If unsure whether something is a character or an object, EXCLUDE it.
5. Maximum 5 characters. Quality over quantity — fewer, accurate characters are better than many inaccurate ones.

Distinguish human characters from non-human subjects (animals, mechanical beings, etc.).
Non-human characters MUST include their type label in sd_tags (e.g. robot, animal, creature).

Vision analysis:
${visionText}

Subtitle reference:
${transcript.slice(0, 800)}

Return a JSON array with this structure:
[
  {
    "name": "Character name or short description (e.g. male lead, robot protagonist, animal companion)",
    "appearance": "Detailed English appearance description (3-5 sentences). Include: face/screen type and displayed content, eye color and glow, body material and texture (metallic/organic/fabric), specific clothing items with colors and patterns, accessories, distinguishing marks, overall build and posture. Be as specific as possible.",
    "sd_tags": "SDXL-compatible English tags, comma-separated, must include character type + gender + hair/shape + clothing/accessories + expression style + material/texture",
    "lora_suggestion": "Recommended LoRA model type name",
    "negative_prompt": "Negative prompt for this character to avoid generating incorrect features",
    "ai_prompt": "Detailed English character description (3-5 sentences) for any AI tool. Describe exact visual features: face/screen details, eye appearance, body material, specific clothing with colors and patterns, accessories, posture, and overall mood. Be vivid and specific — not generic."
  }
]

Output only the JSON array, nothing else.`,
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

/** 4B: Generate story setting prompts */
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
          content: "You are a professional AI short drama content analyst. Return only a valid JSON object with no markdown code fences or extra text.",
        },
        {
          role: "user",
          content: `Extract the story setting from the following visual analysis and subtitles.

Vision analysis (summary):
${visionText.slice(0, 1500)}

Subtitle transcript:
${transcript}

Return a JSON object:
{
  "genre": ["genre tag 1", "genre tag 2"],
  "worldview": "World-building and background setting, 1-2 sentences",
  "plot_bible": "Story synopsis, 100-200 words, including main character relationships and core conflict",
  "tone": "Emotional tone in English, e.g. lighthearted romance / dark thriller"
}

Output only the JSON object, nothing else.`,
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

/** 4C: Generate shot/storyboard prompts */
async function generateShots(visionText: string): Promise<Shot[]> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "You are a professional AI video storyboard artist and Stable Diffusion prompt engineer. Return only a valid JSON array with no markdown code fences or extra text.",
        },
        {
          role: "user",
          content: `Extract key storyboard shots from the following video frame analysis. Output up to 20 scenes.

Vision analysis:
${visionText}

Return a JSON array with this structure for each shot:
[
  {
    "index": "Sequential number starting from 1",
    "timestamp": "Estimated timestamp in HH:MM:SS format",
    "shot_type": "close-up or medium or wide or extreme-close-up",
    "composition": "Composition description, e.g. rule of thirds / centered / symmetrical",
    "lighting": "Lighting description, e.g. warm side lighting / cold backlight",
    "camera_motion": "static or push-in or pull-out or pan or follow or handheld",
    "sd_prompt": "Complete English Stable Diffusion prompt with quality words, style words, scene words, comma-separated",
    "ai_prompt": "Universal English natural language scene description that can be directly used in any AI tool (SD/MidJourney/DALL-E/Sora etc.). Use complete fluent sentences describing character appearance, actions, scene environment, lighting and atmosphere — not tag format"
  }
]

Output only the JSON array, nothing else.`,
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
  master_prompt: string
}

/** 4D: Generate global master prompt */
async function generateMasterPrompt(visionText: string, transcript: string): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      messages: [
        {
          role: "system",
          content: "You are a professional AI content creation prompt engineer. Return only plain text with no markdown or extra formatting.",
        },
        {
          role: "user",
          content: `Based on the following video analysis, generate a global style description (master prompt) that can serve as a base prefix for all storyboard shots.

Vision analysis (summary):
${visionText.slice(0, 2000)}

Subtitle reference:
${transcript.slice(0, 800)}

Requirements:
- English natural language description, 2-4 sentences
- Include: overall art style (realistic / cartoon / cyberpunk etc.), world-building background, color palette and atmosphere, core character ensemble
- This description will be placed before each shot prompt as a unified style anchor
- Output the description text directly, no prefix or formatting markers`,
        },
      ],
    })

    return response.choices[0]?.message?.content ?? ""
  } catch (err) {
    console.error("[Step 4D] Master prompt generation failed:", err)
    return ""
  }
}

/**
 * Step 4: Generate four types of prompts in parallel
 * Four independent requests, concurrent via Promise.all + DeepSeek
 */
export async function step4Generate(visionText: string, transcript: string): Promise<GeneratedResult> {
  const start = Date.now()
  console.log("[Step 4] Starting prompt generation (DeepSeek)")
  console.log(`[Step 4] Input: vision text ${visionText.length} chars, transcript ${transcript.length} chars`)

  console.log("[Step 4] Parallel requests: 4A Characters + 4B Story + 4C Shots + 4D Master Prompt")
  const [characters, story, shots, master_prompt] = await Promise.all([
    generateCharacters(visionText, transcript),
    generateStory(visionText, transcript),
    generateShots(visionText),
    generateMasterPrompt(visionText, transcript),
  ])

  console.log(`[Step 4] Done: ${characters.length} characters, ${shots.length} shots, master_prompt ${master_prompt.length} chars, took ${Date.now() - start}ms`)
  return { characters, story, shots, master_prompt }
}
