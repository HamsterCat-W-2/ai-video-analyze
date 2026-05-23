import "dotenv/config"
import Fastify from "fastify"
import multipart from "@fastify/multipart"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { runPipeline } from "./pipeline"

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

async function main() {
  const app = Fastify({ logger: true })

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
    },
  })

  app.get("/health", async () => {
    return { status: "ok" }
  })

  app.post("/analyze", async (request, reply) => {
    const reqId = Date.now().toString(36)
    console.log(`[${reqId}] 收到分析请求`)

    const file = await request.file()
    if (!file) {
      console.log(`[${reqId}] 请求被拒绝：缺少文件`)
      return reply.status(400).send({ error: "缺少文件", detail: "请上传视频文件，field 名为 file" })
    }

    const ext = path.extname(file.filename).toLowerCase()
    console.log(`[${reqId}] 文件名: ${file.filename}, 格式: ${ext}, 大小: ${(file.file.bytesRead / 1024 / 1024).toFixed(2)}MB`)

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      console.log(`[${reqId}] 请求被拒绝：不支持的格式 ${ext}`)
      return reply.status(400).send({
        error: "不支持的格式",
        detail: `仅支持 ${ALLOWED_EXTENSIONS.join(" ")} 格式`,
      })
    }

    const tmpPath = path.join(os.tmpdir(), `sdl-upload-${Date.now()}${ext}`)
    try {
      console.log(`[${reqId}] 保存上传文件到临时路径: ${tmpPath}`)
      const buffer = await file.toBuffer()
      await fs.promises.writeFile(tmpPath, buffer)
      console.log(`[${reqId}] 文件保存完成，开始流水线处理`)

      const result = await runPipeline(tmpPath)

      // 保存结果到 output 目录
      const outputDir = path.join(__dirname, "..", "output")
      await fs.promises.mkdir(outputDir, { recursive: true })
      const outputFile = path.join(outputDir, `${result.video_id}.json`)
      await fs.promises.writeFile(outputFile, JSON.stringify(result, null, 2), "utf-8")
      console.log(`[${reqId}] 结果已保存: ${outputFile}`)
      console.log(`[${reqId}] 流水线完成，video_id=${result.video_id}, 总耗时=${result.processing_time_ms}ms`)

      return reply.send(result)
    } catch (err: any) {
      request.log.error(err)
      console.error(`[${reqId}] 处理失败:`, err.message)
      return reply.status(500).send({
        error: "处理失败",
        detail: err.message || "未知错误",
      })
    }
  })

  const port = Number(process.env.PORT) || 3000
  await app.listen({ port, host: "0.0.0.0" })
  console.log(`ShortDramaLens 服务已启动: http://localhost:${port}`)
}

main().catch((err) => {
  console.error("启动失败:", err)
  process.exit(1)
})
