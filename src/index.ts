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
    const file = await request.file()
    if (!file) {
      return reply.status(400).send({ error: "缺少文件", detail: "请上传视频文件，field 名为 file" })
    }

    const ext = path.extname(file.filename).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return reply.status(400).send({
        error: "不支持的格式",
        detail: `仅支持 ${ALLOWED_EXTENSIONS.join(" ")} 格式`,
      })
    }

    const tmpPath = path.join(os.tmpdir(), `sdl-upload-${Date.now()}${ext}`)
    try {
      const buffer = await file.toBuffer()
      await fs.promises.writeFile(tmpPath, buffer)

      const result = await runPipeline(tmpPath)

      const outputDir = path.join(__dirname, "..", "output")
      await fs.promises.mkdir(outputDir, { recursive: true })
      const outputFile = path.join(outputDir, `${result.video_id}.json`)
      await fs.promises.writeFile(outputFile, JSON.stringify(result, null, 2), "utf-8")
      console.log(`结果已保存: ${outputFile}`)

      return reply.send(result)
    } catch (err: any) {
      request.log.error(err)
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
