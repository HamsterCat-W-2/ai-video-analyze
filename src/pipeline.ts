import * as fs from "fs"
import * as crypto from "crypto"
import type { PipelineContext, PromptPack } from "./types"
import { step1Extract } from "./steps/step1-extract"
import { step2Vision } from "./steps/step2-vision"
import { step3Transcribe } from "./steps/step3-transcribe"
import { step4Generate } from "./steps/step4-generate"
import { step5Validate } from "./steps/step5-validate"

function initContext(videoPath: string): PipelineContext {
  return {
    videoId: crypto.randomBytes(4).toString("hex"),
    videoPath,
    tmpDir: "",
    frames: [],
    audioPath: "",
    visionText: "",
    transcript: "",
    startTime: Date.now(),
  }
}

async function cleanup(tmpDir: string, videoPath: string): Promise<void> {
  const tasks: Promise<void>[] = []

  if (tmpDir) {
    tasks.push(
      fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    )
  }
  if (videoPath) {
    tasks.push(
      fs.promises.unlink(videoPath).catch(() => {})
    )
  }

  await Promise.all(tasks)
}

export async function runPipeline(videoPath: string): Promise<PromptPack> {
  const ctx = initContext(videoPath)

  try {
    // Step 1：抽帧（串行）
    const extracted = await step1Extract(ctx.videoPath)
    ctx.tmpDir = extracted.tmpDir
    ctx.frames = extracted.frames
    ctx.audioPath = extracted.audioPath

    // Step 2 + 3：并行（视觉 和 转录 互相独立）
    const [visionText, transcript] = await Promise.all([
      step2Vision(ctx.frames),
      step3Transcribe(ctx.audioPath),
    ])
    ctx.visionText = visionText
    ctx.transcript = transcript

    // Step 4：并行生成三类提示词
    const generated = await step4Generate(ctx.visionText, ctx.transcript)

    // Step 5：校验 + 格式化
    return step5Validate(ctx, generated)

  } finally {
    await cleanup(ctx.tmpDir, ctx.videoPath)
  }
}
