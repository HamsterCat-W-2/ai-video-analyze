import OpenAI from "openai"
import * as fs from "fs"

// 千问3-ASR-Flash 与视觉分析共用同一个 DashScope API Key
const client = new OpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.DASHSCOPE_API_KEY,
})

/**
 * Step 3: 语音转录
 * 将本地音轨读取为 base64，调用千问3-ASR-Flash 同步转录
 * 失败时返回空字符串，不阻塞后续步骤（兜底逻辑）
 */
export async function step3Transcribe(audioPath: string): Promise<string> {
  const start = Date.now()
  console.log("[Step 3] 语音转录（千问3-ASR-Flash）...")

  try {
    // 读取音轨文件并转为 base64，直传 API 无需 OSS 中转
    const buffer = await fs.promises.readFile(audioPath)
    const base64Audio = buffer.toString("base64")

    // 使用 chat completions 接口，通过 input_audio 类型传入音频
    const response = await client.chat.completions.create({
      model: "qwen3-asr-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format: "mp3",
              },
            },
          ],
        },
      ],
    })

    const transcript = response.choices[0]?.message?.content ?? ""
    console.log(`[Step 3] ...done（耗时 ${Date.now() - start}ms）`)
    return transcript
  } catch (err) {
    // 转录失败不中断流水线，返回空字符串让 Step 4 继续
    console.error(`[Step 3] 转录失败，返回空字符串:`, err)
    console.log(`[Step 3] ...done（耗时 ${Date.now() - start}ms，失败兜底）`)
    return ""
  }
}
