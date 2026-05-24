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
    // Step 1: Extract candidate characters
    const extractResponse = await client.chat.completions.create({
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
6. Distinguish between real living beings and sculptures/statues/dolls. A sculpture is NOT a character.

Distinguish human characters from non-human subjects (animals, mechanical beings, etc.).
Non-human characters MUST include their type label in sd_tags (e.g. robot, animal, creature).

Vision analysis:
${visionText}

Subtitle reference:
${transcript.slice(0, 800)}

Return a JSON array with this structure:
[
  {
    "name": "角色名称，使用中文（如：机器人男主角、鸵鸟坐骑、女主角雕塑）",
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

    const rawContent = extractResponse.choices[0]?.message?.content ?? "[]"
    console.log("[Step 4A] Extract response length:", rawContent.length)
    const candidates: Character[] = JSON.parse(cleanJson(rawContent))

    if (candidates.length === 0) return []

    // Step 2: Verify each character against the vision text
    const verifyResponse = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are a careful fact-checker. Return only a valid JSON array with no markdown code fences or extra text.",
        },
        {
          role: "user",
          content: `I have a list of characters extracted from video frame analysis. Verify each character's existence.

Vision analysis:
${visionText}

Characters to verify:
${JSON.stringify(candidates, null, 2)}

For EACH character, apply these STRICT verification rules:

CHECK 1 — Sculpture/Statue Detection:
- If the character's own description mentions "sculpture", "statue", "doll", "mannequin", "sometimes depicted as", "not clearly visible", or "face not visible" — this is likely a non-living object. REMOVE it.
- If the vision text describes this subject as a sculpture, statue, doll, mannequin, decoration, or illustration — REMOVE it.

CHECK 2 — Face Visibility:
- A real living character must have a clearly visible face with identifiable features (eyes, expression, etc.)
- If the character description says "face not clearly visible", "face not visible", or lacks any facial description — this strongly suggests a statue/mannequin/sculpture. REMOVE it.

CHECK 3 — Specificity:
- The character must have at least 2 unique identifying features (e.g., "metallic body with bolted joints AND blue glowing eyes AND brown leather jacket")
- If the description is generic with no unique features, REMOVE it.

CHECK 4 — Frame Count:
- The character or character type must appear in 2+ frames
- Group types (zombies, soldiers, crowd) count as valid if the type appears in 2+ frames

A character passes ALL checks only if it is clearly a living being with visible facial features and specific details.

Return the filtered JSON array. If ALL characters fail, return [].

Output only the JSON array, nothing else.`,
        },
      ],
    })

    const verifyContent = verifyResponse.choices[0]?.message?.content ?? "[]"
    console.log("[Step 4A] Verify response length:", verifyContent.length)
    const verified: Character[] = JSON.parse(cleanJson(verifyContent))
    console.log(`[Step 4A] Characters: ${candidates.length} candidates → ${verified.length} verified`)
    return verified
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
      max_tokens: 8000,
      messages: [
        {
          role: "system",
          content: "You are a professional AI video storyboard artist and Stable Diffusion prompt engineer. Return only a valid JSON array with no markdown code fences or extra text.",
        },
        {
          role: "user",
          content: `Extract EXACTLY 20 key storyboard shots from the following video frame analysis. You MUST output 20 shots, covering the ENTIRE video from beginning to end. Do not stop early.

Vision analysis:
${visionText}

Return a JSON array with this structure for each shot:
[
  {
    "index": 1,
    "timestamp": "00:00:05",
    "shot_type": "close-up",
    "composition": "rule of thirds / centered / symmetrical",
    "lighting": "warm side lighting / cold backlight",
    "camera_motion": "static",
    "sd_prompt": "Complete English Stable Diffusion prompt with quality words, style words, scene words, comma-separated",
    "ai_prompt": "Universal English natural language scene description that can be directly used in any AI tool (SD/MidJourney/DALL-E/Sora etc.). Use complete fluent sentences describing character appearance, actions, scene environment, lighting and atmosphere — not tag format"
  }
]

CRITICAL: Output EXACTLY 20 shots. index must be a number, not a string. Spread timestamps evenly across the full video duration. Output only the JSON array, nothing else.`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "[]"
    console.log("[Step 4C] Raw response length:", content.length)
    console.log("[Step 4C] Raw response preview:", content.slice(0, 500))
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
