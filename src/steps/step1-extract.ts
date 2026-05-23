import ffmpeg from "fluent-ffmpeg"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface ExtractResult {
  tmpDir: string      // 临时目录，后续需清理
  frames: string[]    // 抽帧图片绝对路径列表
  audioPath: string   // 音轨文件绝对路径
}

/** 从视频中按 1fps 抽帧，最多 60 帧，输出为 JPG */
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

/** 从视频中提取音轨，输出为 MP3（libmp3lame 编码） */
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
  console.log("[Step 1] 抽帧 + 分离音轨 ...")

  // 创建临时目录用于存放抽帧和音轨产物
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sdl-"))
  const framesDir = path.join(tmpDir, "frames")
  await fs.promises.mkdir(framesDir)
  const audioPath = path.join(tmpDir, "audio.mp3")

  // 抽帧和音轨分离并行执行，互不依赖
  await Promise.all([
    extractFrames(videoPath, framesDir),
    extractAudio(videoPath, audioPath),
  ])

  // 读取帧文件列表，按文件名排序确保时间顺序
  const frameFiles = await fs.promises.readdir(framesDir)
  const frames = frameFiles
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(framesDir, f))

  console.log(`[Step 1] ...done（耗时 ${Date.now() - start}ms）, ${frames.length} 帧`)
  return { tmpDir, frames, audioPath }
}
