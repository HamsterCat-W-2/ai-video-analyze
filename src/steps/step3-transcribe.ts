import * as fs from "fs"
import { asrClient, MODELS } from "../clients"

export async function step3Transcribe(audioPath: string): Promise<string> {
  const start = Date.now()
  console.log(`[Step 3][${MODELS.asr}] 开始语音转录`)

  try {
    const useWhisper = MODELS.asr.toLowerCase().includes("whisper")

    if (useWhisper) {
      // Whisper 系列走 audio.transcriptions 接口
      console.log("[Step 3] 使用 Whisper 路径（audio.transcriptions）")
      const res = await asrClient.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: MODELS.asr,
        language: "zh",
        response_format: "text",
      })
      const transcript = res as unknown as string
      console.log(`[Step 3][${MODELS.asr}] 完成：${transcript.length} 字符, 耗时 ${Date.now() - start}ms ...done`)
      return transcript
    } else {
      // 多模态模型走 chat.completions + input_audio
      console.log("[Step 3] 使用 input_audio 路径（chat.completions）")
      const buffer = await fs.promises.readFile(audioPath)
      const base64Audio = buffer.toString("base64")

      const res = await asrClient.chat.completions.create({
        model: MODELS.asr,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: base64Audio, format: "mp3" },
              },
            ],
          },
        ],
      })
      const transcript = res.choices[0]?.message?.content ?? ""
      console.log(`[Step 3][${MODELS.asr}] 完成：${transcript.length} 字符, 耗时 ${Date.now() - start}ms ...done`)
      return transcript
    }
  } catch (err) {
    console.error(`[Step 3][${MODELS.asr}] 转录失败，返回空字符串:`, err)
    console.log(`[Step 3][${MODELS.asr}] ...done（耗时 ${Date.now() - start}ms，失败兜底）`)
    return ""
  }
}
