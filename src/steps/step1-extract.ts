import ffmpeg from "fluent-ffmpeg"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const MAX_FRAMES = 60

export interface ExtractResult {
  tmpDir: string      // 临时目录，后续需清理
  frames: string[]    // 抽帧图片绝对路径列表
  audioPath: string   // 音轨文件绝对路径
  duration: number    // 视频时长（秒）
}

/** 用 ffprobe 获取视频时长（秒） */
function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`))
      const dur = metadata.format?.duration
      if (!dur) return reject(new Error("无法获取视频时长"))
      resolve(dur)
    })
  })
}

/** 从视频中抽帧，覆盖全片，最多 MAX_FRAMES 帧，输出为 JPG */
function extractFrames(videoPath: string, framesDir: string, duration: number): Promise<void> {
  // 视频 <= MAX_FRAMES 秒时用 1fps，否则降低 fps 使帧均匀分布全片
  const fps = duration <= MAX_FRAMES ? 1 : MAX_FRAMES / duration
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(["-vf", `fps=${fps}`, "-frames:v", String(MAX_FRAMES)])
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
  console.log("[Step 1] 开始视频预处理：抽帧 + 分离音轨")
  console.log(`[Step 1] 视频路径: ${videoPath}`)

  // 先获取视频时长，用于计算采样率
  const duration = await getVideoDuration(videoPath)
  const fps = duration <= MAX_FRAMES ? 1 : MAX_FRAMES / duration
  console.log(`[Step 1] 视频时长: ${duration.toFixed(1)}秒, 采样率: fps=${fps.toFixed(3)}, 目标帧数: ${Math.min(Math.ceil(duration), MAX_FRAMES)}`)

  // 创建临时目录用于存放抽帧和音轨产物
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sdl-"))
  const framesDir = path.join(tmpDir, "frames")
  await fs.promises.mkdir(framesDir)
  const audioPath = path.join(tmpDir, "audio.mp3")
  console.log(`[Step 1] 临时目录: ${tmpDir}`)

  // 抽帧和音轨分离并行执行，互不依赖
  console.log("[Step 1] 并行执行：抽帧 + 音轨分离(mp3)")
  await Promise.all([
    extractFrames(videoPath, framesDir, duration),
    extractAudio(videoPath, audioPath),
  ])
  console.log("[Step 1] ffmpeg 处理完成")

  // 读取帧文件列表，按文件名排序确保时间顺序
  const frameFiles = await fs.promises.readdir(framesDir)
  const frames = frameFiles
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(framesDir, f))

  const audioSize = (await fs.promises.stat(audioPath)).size
  console.log(`[Step 1] 完成：${frames.length} 帧, 音轨 ${(audioSize / 1024).toFixed(1)}KB, 时长 ${duration.toFixed(1)}秒, 耗时 ${Date.now() - start}ms`)
  return { tmpDir, frames, audioPath, duration }
}
