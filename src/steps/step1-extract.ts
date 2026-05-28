import ffmpeg from "fluent-ffmpeg"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface ExtractResult {
  tmpDir: string
  frames: string[]
  audioPath: string
}

/** 从视频中抽帧，1fps，最多 60 帧 */
function extractFrames(videoPath: string, framesDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(["-vf", "fps=1", "-frames:v", "60"])
      .output(path.join(framesDir, "frame_%04d.jpg"))
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`ffmpeg frames extraction failed: ${err.message}`)))
      .run()
  })
}

/** 从视频中提取音轨，输出为 MP3 */
function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .output(audioPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`ffmpeg audio extraction failed: ${err.message}`)))
      .run()
  })
}

/**
 * Step 1: 视频预处理
 * 创建临时目录，并行执行抽帧和音轨分离，返回产物路径
 */
export async function step1Extract(videoPath: string): Promise<ExtractResult> {
  const start = Date.now()
  console.log("[Step 1] 开始视频预处理：抽帧 + 分离音轨")

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sdl-"))
  const framesDir = path.join(tmpDir, "frames")
  await fs.promises.mkdir(framesDir)
  const audioPath = path.join(tmpDir, "audio.mp3")

  await Promise.all([
    extractFrames(videoPath, framesDir),
    extractAudio(videoPath, audioPath),
  ])

  const frameFiles = await fs.promises.readdir(framesDir)
  const frames = frameFiles
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(framesDir, f))

  const audioSize = (await fs.promises.stat(audioPath)).size
  console.log(`[Step 1] 完成：${frames.length} 帧, 音轨 ${(audioSize / 1024).toFixed(1)}KB, 耗时 ${Date.now() - start}ms`)
  return { tmpDir, frames, audioPath }
}
