import OpenAI from "openai"
import type { Character, Story, Shot } from "../types"

const client = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const MODEL = "deepseek-chat"
const TEMPERATURE = 0.2  // 低温度，输出更稳定可控

/** Content safety guidelines shared by all generation functions */
const SAFETY_GUIDELINES = `
Content Safety Policy (MUST follow strictly — zero tolerance):

BANNED CATEGORIES — do NOT generate any content involving:
1. Violence & self-harm: graphic violence, gore, injury, self-harm, suicide, weapons (guns, knives, explosives), war crimes, torture
2. Sexual exploitation & abuse: explicit sexual content, nudity, sexual violence, non-consensual acts, prostitution
3. Child/adolescent exploitation: any sexualization or endangerment of minors, child labor, abuse
4. Bullying & harassment: targeted insults, intimidation, hate speech, discrimination based on race/gender/religion/orientation
5. Spam & manipulation: deceptive content, phishing, fake claims, misleading information
6. Fraud & deception: impersonation, forgery, scam content, counterfeit references

BANNED WORDS (non-exhaustive): blood, bloody, gore, wound, rotting, decay, corpse, death, dead, kill, murder, stab, shoot, gun, weapon, knife, sword, flesh, mutilate, dismember, torture, rape, abuse, suicide, self-harm, naked, nude, sexual, porn, child abuse, molest

SAFE REPLACEMENT MAPPINGS:
- violence → "tense confrontation", "dramatic conflict", "action sequence"
- dead/bodies → "still figures", "resting silhouettes", "motionless forms"
- blood/injury → "dramatic shadows", "weathered appearance", "dusty textures"
- weapons → "mysterious objects", "props", "tools"
- horror/scary → "eerie atmosphere", "mysterious mood", "suspenseful tone"
- zombies/undead → "shadowy figures", "pale silhouettes", "ethereal beings"

FOCUS ONLY ON: composition, lighting, color palette, atmosphere, character poses, fashion, architecture, nature, technology
All prompts must pass content filters on Stable Diffusion, MidJourney, DALL-E, and Sora
When in doubt, use abstract and artistic language instead of literal descriptions
`.trim()

/** Clean markdown code fences from LLM response */
function cleanJson(text: string): string {
  return text.replace(/```json|```/g, "").trim()
}

/**
 * Hard content filter: post-process output to replace banned words.
 * Compound phrases are matched FIRST to avoid partial replacements.
 * Acts as a safety net when the LLM doesn't fully follow system prompt guidelines.
 */
const BANNED_REPLACEMENTS: [RegExp, string][] = [
  // ── Compound phrases (match before single words) ──
  [/blood\s*stains?/gi, "dramatic shadows"],
  [/blood\s*spill(?:ed|ing)?/gi, "dramatic spill"],
  [/blood\s*shed/gi, "dramatic conflict"],
  [/rotting\s*(?:skin|flesh|corpse|body)/gi, "weathered texture"],
  [/rotting\s*away/gi, "fading away"],
  [/torn\s*(?:flesh|skin|body)/gi, "tattered fabric"],
  [/open\s*wounds?/gi, "visible markings"],
  [/dead\s*bod(?:y|ies)/gi, "still figures"],
  [/dead\s*people/gi, "motionless figures"],
  [/walking\s*dead/gi, "wandering shadows"],
  [/living\s*dead/gi, "ethereal beings"],
  [/undead\s*(?:army|horde|swarm)/gi, "ethereal procession"],
  [/zombie\s*(?:apocalypse|outbreak|horde|army)/gi, "shadowy gathering"],
  [/gun\s*(?:fire|shot|fight|battle)/gi, "dramatic confrontation"],
  [/knife\s*(?:attack|fight|wound)/gi, "tense encounter"],
  [/sexual\s*(?:assault|violence|abuse|exploitation)/gi, "inappropriate conduct"],
  [/child\s*(?:abuse|exploitation|molest)/gi, "mistreatment of minors"],
  [/self[\s-]*harm/gi, "self-destructive behavior"],
  [/hate\s*speech/gi, "hostile language"],

  // ── Single words ──
  [/\bbloody\b/gi, "dramatic"],
  [/\bblood\b/gi, "dramatic shadow"],
  [/\bgore\b/gi, "dark texture"],
  [/\bgory\b/gi, "intense"],
  [/\bwound(?:s|ed)?\b/gi, "markings"],
  [/\brotting\b/gi, "weathered"],
  [/\bdecay(?:ed|ing)?\b/gi, "aged"],
  [/\bcorpse(?:s)?\b/gi, "still figures"],
  [/\bdead\b/gi, "motionless"],
  [/\bdeath\b/gi, "fading"],
  [/\bkill(?:ed|ing|er)?\b/gi, "overcome"],
  [/\bmurder(?:ed|er|ing|ous)?\b/gi, "dramatic conflict"],
  [/\bstab(?:bed|bing)?\b/gi, "confrontation"],
  [/\bshoot(?:s|ing|er)?\b/gi, "action sequence"],
  [/\bgun(?:s)?\b/gi, "mysterious object"],
  [/\bweapon(?:s)?\b/gi, "prop"],
  [/\bknife\b/gi, "tool"],
  [/\bsword(?:s)?\b/gi, "blade-shaped prop"],
  [/\brifle\b/gi, "long prop"],
  [/\bpistol\b/gi, "small prop"],
  [/\bammo\b/gi, "supplies"],
  [/\bbullet(?:s)?\b/gi, "projectiles"],
  [/\bexplosive(?:s|ion)?\b/gi, "burst effect"],
  [/\bbomb(?:s|ing)?\b/gi, "burst device"],
  [/\bflesh\b/gi, "texture"],
  [/\bmutilat(?:e|ed|ion)\b/gi, "dramatic alteration"],
  [/\bdismember(?:ed|ment)?\b/gi, "scattered forms"],
  [/\btortur(?:e|ed|ing)\b/gi, "intense ordeal"],
  [/\brape(?:d)?\b/gi, "violation"],
  [/\bsexual\b/gi, "intimate"],
  [/\bnak(?:ed|edness)\b/gi, "exposed"],
  [/\bnude\b/gi, "bare"],
  [/\bporn(?:ographic)?\b/gi, "explicit"],
  [/\bsuicide\b/gi, "self-endangerment"],
  [/\babuse(?:d|ive)?\b/gi, "mistreatment"],
  [/\bzombie(?:s)?\b/gi, "shadowy figures"],
  [/\bundead\b/gi, "ethereal beings"],
  [/\bmenacing\b/gi, "mysterious"],
  [/\baggressive\b/gi, "intense"],
  [/\bbrutal\b/gi, "intense"],
  [/\bviolent\b/gi, "dramatic"],
  [/\bterrif(?:y|ying|ied)\b/gi, "striking"],
  [/\bhorrif(?:y|ying|ied)\b/gi, "startling"],
  [/\bgrotesque\b/gi, "unusual"],
  [/\bscar(?:y|red|ier)\b/gi, "weathered"],
  [/\bgangrene\b/gi, "discoloration"],
  [/\binfect(?:ed|ion)\b/gi, "marked"],
  [/\bdiseased\b/gi, "weathered"],
]

function sanitizeOutput(text: string): string {
  let result = text
  for (const [pattern, replacement] of BANNED_REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }
  // Clean up double spaces and awkward punctuation from replacements
  result = result.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1")
  return result
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
          content: `You are a professional AI art prompt engineer. Return only a valid JSON array with no markdown code fences or extra text.\n\n${SAFETY_GUIDELINES}`,
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
    "appearance": "English appearance description for SD img2img reference, must include material/texture details",
    "sd_tags": "SDXL-compatible English tags, comma-separated, must include character type + gender + hair/shape + clothing/accessories + expression style",
    "lora_suggestion": "Recommended LoRA model type name",
    "negative_prompt": "Negative prompt for this character to avoid generating incorrect features",
    "ai_prompt": "Universal English natural language character description that can be directly used in any AI tool. Use complete sentences describing appearance, material, clothing, and temperament — not tag format"
  }
]

Output only the JSON array, nothing else.`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? "[]"
    const characters: Character[] = JSON.parse(cleanJson(content))
    return characters.map((c) => ({
      ...c,
      appearance: sanitizeOutput(c.appearance),
      sd_tags: sanitizeOutput(c.sd_tags),
      negative_prompt: sanitizeOutput(c.negative_prompt),
      ai_prompt: sanitizeOutput(c.ai_prompt),
    }))
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
          content: `You are a professional AI short drama content analyst. Return only a valid JSON object with no markdown code fences or extra text.\n\n${SAFETY_GUIDELINES}`,
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
    const story: Story = JSON.parse(cleanJson(content))
    return {
      ...story,
      worldview: sanitizeOutput(story.worldview),
      plot_bible: sanitizeOutput(story.plot_bible),
      tone: sanitizeOutput(story.tone),
    }
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
          content: `You are a professional AI video storyboard artist and Stable Diffusion prompt engineer. Return only a valid JSON array with no markdown code fences or extra text.\n\n${SAFETY_GUIDELINES}`,
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
    const shots: Shot[] = JSON.parse(cleanJson(content))
    return shots.map((s) => ({
      ...s,
      composition: sanitizeOutput(s.composition),
      lighting: sanitizeOutput(s.lighting),
      sd_prompt: sanitizeOutput(s.sd_prompt),
      ai_prompt: sanitizeOutput(s.ai_prompt),
    }))
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
          content: `You are a professional AI content creation prompt engineer. Return only plain text with no markdown or extra formatting.\n\n${SAFETY_GUIDELINES}`,
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

    const raw = response.choices[0]?.message?.content ?? ""
    return sanitizeOutput(raw)
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
