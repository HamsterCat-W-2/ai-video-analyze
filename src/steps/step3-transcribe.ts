import OpenAI from "openai"
import * as fs from "fs"

const client = new OpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.DASHSCOPE_API_KEY,
})

export async function step3Transcribe(audioPath: string): Promise<string> {
  const start = Date.now()
  console.log("[Step 3] 语音转录（千问3-ASR-Flash）...")

  try {
    const buffer = await fs.promises.readFile(audioPath)
    const base64Audio = buffer.toString("base64")

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
    console.error(`[Step 3] 转录失败，返回空字符串:`, err)
    console.log(`[Step 3] ...done（耗时 ${Date.now() - start}ms，失败兜底）`)
    return ""
  }
}
