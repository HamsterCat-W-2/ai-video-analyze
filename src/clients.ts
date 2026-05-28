import OpenAI from "openai"

// 视觉分析客户端
export const visionClient = new OpenAI({
  apiKey: process.env.VISION_API_KEY!,
  baseURL: process.env.VISION_BASE_URL!,
})

// 语音转录客户端
export const asrClient = new OpenAI({
  apiKey: process.env.ASR_API_KEY!,
  baseURL: process.env.ASR_BASE_URL!,
})

// 提示词生成客户端
export const llmClient = new OpenAI({
  apiKey: process.env.LLM_API_KEY!,
  baseURL: process.env.LLM_BASE_URL!,
})

// 从环境变量读取模型名
export const MODELS = {
  vision: process.env.VISION_MODEL!,
  asr: process.env.ASR_MODEL!,
  llm: process.env.LLM_MODEL!,
}
