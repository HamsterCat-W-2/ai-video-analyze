import ffmpeg from "fluent-ffmpeg"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface ExtractResult {
  tmpDir: string
  frames: string[]
  audioPath: string
}

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

export async function step1Extract(videoPath: string): Promise<ExtractResult> {
  const start = Date.now()
  console.log("[Step 1] 抽帧 + 分离音轨 ...")

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

  console.log(`[Step 1] ...done（耗时 ${Date.now() - start}ms）, ${frames.length} 帧`)
  return { tmpDir, frames, audioPath }
}
