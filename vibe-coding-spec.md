# 项目开发规格文档
# ShortDramaLens — AI 短剧视频提示词提取器

---

## 项目信息

| 字段 | 内容 |
|---|---|
| **项目名称** | ShortDramaLens |
| **项目描述** | 上传一段 AI 短剧视频，自动分析并输出可复刻该视频的完整提示词包，包含人物提示词、故事提示词、分镜提示词，JSON 格式返回 |
| **语言** | TypeScript（Node.js） |
| **架构** | 五步顺序流水线，单个 HTTP 接口，无数据库，无鉴权 |
| **目标** | 跑通核心链路，验证提示词质量 |

---

## 技术栈

| 用途 | 选型 |
|---|---|
| HTTP 框架 | Fastify |
| 文件上传 | @fastify/multipart |
| 视频处理 | fluent-ffmpeg（需本地安装 ffmpeg） |
| 视觉分析 | Qwen2.5-VL-72B，阿里云百炼 API |
| 语音转录 | 千问3-ASR-Flash，阿里云百炼 API（直传文件，同步返回） |
| 提示词生成 | DeepSeek V4 Pro，DeepSeek API |
| 数据校验 | Zod |
| 类型安全 | TypeScript strict 模式 |
| 运行方式 | tsx（开发），tsc + node（生产） |

> **所有 AI 服务统一使用阿里云百炼账号**，只需配置 `DASHSCOPE_API_KEY` 和 `DEEPSEEK_API_KEY` 两个密钥即可。

---

## 目录结构

```
short-drama-lens/
├── src/
│   ├── index.ts               # 服务入口，注册路由
│   ├── pipeline.ts            # 五步流水线主函数
│   ├── types.ts               # 所有类型定义和 Zod Schema
│   └── steps/
│       ├── step1-extract.ts   # Step1：ffmpeg 抽帧 + 分离音轨
│       ├── step2-vision.ts    # Step2：Qwen2.5-VL 视觉分析
│       ├── step3-transcribe.ts# Step3：千问3-ASR-Flash 语音转录（base64 直传，同步）
│       ├── step4-generate.ts  # Step4：DeepSeek 生成三类提示词
│       └── step5-validate.ts  # Step5：Zod 校验 + 输出格式化
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 环境变量

文件名：`.env`

```bash
# 阿里云百炼（Qwen2.5-VL 视觉 + 千问3-ASR-Flash 语音，同一个 Key）
DASHSCOPE_API_KEY=sk-xxxxxxxx

# DeepSeek
DEEPSEEK_API_KEY=sk-xxxxxxxx

# 服务端口
PORT=3000
```

---

## 依赖安装

```bash
npm install fastify @fastify/multipart openai zod dotenv
npm install -D typescript @types/node fluent-ffmpeg @types/fluent-ffmpeg tsx
```

ffmpeg 本地安装：
```bash
# macOS
brew install ffmpeg

# Ubuntu
apt install ffmpeg
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

---

## package.json（scripts 部分）

```json
{
  "name": "short-drama-lens",
  "version": "1.0.0",
  "description": "AI短剧视频提示词提取器",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## 接口规格

### POST /analyze

上传视频文件，返回提示词包。

**请求**
- Content-Type: `multipart/form-data`
- Field 名：`file`
- 支持格式：`.mp4` `.mov` `.avi` `.mkv` `.webm`
- 最大文件大小：500MB

**成功响应（200）**

```json
{
  "video_id": "a3f9b2c1",
  "duration_seconds": 87,
  "characters": [
    {
      "name": "男主",
      "appearance": "tall asian male, short black hair, sharp jawline",
      "sd_tags": "1man, black suit, CEO, formal wear, serious expression, sharp features, asian",
      "lora_suggestion": "realistic_asian_male_v2"
    }
  ],
  "story": {
    "genre": ["都市", "总裁", "甜宠"],
    "worldview": "现代都市，豪门商业背景",
    "plot_bible": "平凡女助理意外与强势总裁产生交集，在误会与纠葛中逐渐相互吸引，经历重重阻碍后走到一起。",
    "tone": "lighthearted romance with dramatic tension"
  },
  "shots": [
    {
      "index": 1,
      "timestamp": "00:00:08",
      "shot_type": "close-up",
      "composition": "centered portrait, shallow depth of field",
      "lighting": "warm side lighting, soft shadows",
      "camera_motion": "static",
      "sd_prompt": "cinematic close-up portrait, 1man, sharp features, warm side lighting, shallow DOF, bokeh background, film grain, 8k"
    }
  ],
  "processing_time_ms": 42300
}
```

**错误响应（400 / 500）**

```json
{
  "error": "错误描述",
  "detail": "具体原因"
}
```

### GET /health

健康检查，返回 `{ "status": "ok" }`

---

## 五步流水线实现规格

### Step 1：extract（src/steps/step1-extract.ts）

**功能：** 用 fluent-ffmpeg 从视频文件抽取帧图片和音轨

**输入：** videoPath: string

**处理逻辑：**
1. 用 `fs.mkdtemp` 创建临时目录 `tmpDir`
2. 并行执行两个 ffmpeg 任务：
   - 任务 A：按 1fps 抽帧，最多 60 帧，输出到 `tmpDir/frames/frame_%04d.jpg`
   - 任务 B：提取音轨，输出到 `tmpDir/audio.mp3`，编码 libmp3lame
3. 读取 frames 目录，按文件名排序，返回完整路径数组

**输出：**
```typescript
{
  tmpDir: string
  frames: string[]   // 帧图片绝对路径列表
  audioPath: string  // 音轨文件绝对路径
}
```

**错误处理：** ffmpeg 任务失败直接 throw Error，携带 ffmpeg stderr 信息

---

### Step 2：vision（src/steps/step2-vision.ts）

**功能：** 调用 Qwen2.5-VL-72B 对视频帧批量进行视觉分析

**API 配置：**
- baseURL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- apiKey: `process.env.DASHSCOPE_API_KEY`
- model: `qwen2.5-vl-72b-instruct`

**输入：** frames: string[]（帧路径列表）

**处理逻辑：**
1. 将帧按每批 10 张分组
2. 每张图片读取为 base64，构造 `image_url` 类型的 content item（`data:image/jpeg;base64,...`）
3. 每批发一次 API 请求，max_tokens 设为 2000
4. 并发控制：每次最多同时发 3 批请求（用 for 循环，每次 slice 3 批并 Promise.all）
5. 所有批次结果用 `\n\n---\n\n` 拼接

**分析 Prompt（user message 文字部分）：**

```
按时间顺序分析这 N 帧画面，对每帧依次描述：
1. 人物：出现的所有人物的外貌特征（发色、发型、面部）、服装（颜色、款式）、表情
2. 场景：地点类型、背景环境、时间氛围、色调
3. 镜头：景别（特写/近景/中景/全景/远景）、构图方式、光线方向与质感
4. 运镜：静止 / 推进 / 拉远 / 摇移 / 跟拍（根据相邻帧推断）

每帧用 [Frame N] 作为标题，内容简洁，每项不超过2句。
```

**输出：** visionText: string（所有批次拼接的完整描述）

---

### Step 3：transcribe（src/steps/step3-transcribe.ts）

**功能：** 将本地音轨读取为 base64，直接调用千问3-ASR-Flash 同步转录，无需 OSS 中转

**API 配置：**
- baseURL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- apiKey: `process.env.DASHSCOPE_API_KEY`（与视觉分析共用同一个 Key）
- model: `qwen3-asr-flash`
- 最大音频时长：5 分钟（短剧场景完全够用）

**输入：** audioPath: string（本地 mp3 音轨路径）

**处理逻辑：**
1. 用 `fs.readFile` 读取音轨文件为 base64 字符串
2. 构造 OpenAI 兼容格式的请求，content 中传入 `input_audio` 类型 item：
   - `data`：base64 字符串
   - `format`：`mp3`
3. 调用 `chat.completions.create`，同步等待返回
4. 取 `choices[0].message.content` 作为转录文本

**请求格式：**
```typescript
{
  model: "qwen3-asr-flash",
  messages: [{
    role: "user",
    content: [{
      type: "input_audio",
      input_audio: {
        data: base64AudioString,
        format: "mp3"
      }
    }]
  }]
}
```

**输出：** transcript: string（完整字幕文本）

**兜底逻辑：** 调用失败（超时/格式问题）时捕获错误，返回空字符串 `""`，不中断流水线，后续 Step 4 用空字符串继续

---

### Step 4：generate（src/steps/step4-generate.ts）

**功能：** 调用 DeepSeek V4 Pro，根据视觉分析和字幕生成三类提示词

**API 配置：**
- baseURL: `https://api.deepseek.com/v1`
- apiKey: `process.env.DEEPSEEK_API_KEY`
- model: `deepseek-chat`
- temperature: `0.2`

**输入：** visionText: string, transcript: string

**处理逻辑：** 并行发三个独立请求，分别生成三类提示词

---

#### 4A — 人物提示词请求

**System：**
```
你是专业的 AI 绘图提示词工程师。只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。
```

**User：**
```
根据以下视频帧分析，提取视频中出现的所有主要角色。

视觉分析：
{visionText}

字幕参考：
{transcript 前 800 字}

返回 JSON 数组，每个角色的结构：
[
  {
    "name": "角色名或描述（如男主/女主）",
    "appearance": "英文外貌描述，用于 SD img2img 参考",
    "sd_tags": "SDXL 兼容的英文标签，逗号分隔，包含性别/发型/服装/表情风格",
    "lora_suggestion": "推荐的 LoRA 模型类型名称"
  }
]

只输出 JSON 数组，没有其他内容。
```

---

#### 4B — 故事提示词请求

**System：**
```
你是专业的 AI 短剧内容分析师。只返回合法 JSON 对象，不要有任何 markdown 代码块或多余文字。
```

**User：**
```
根据以下视觉分析和字幕，提取故事设定。

视觉分析（摘要）：
{visionText 前 1500 字}

字幕转录：
{transcript}

返回 JSON 对象：
{
  "genre": ["风格标签1", "风格标签2"],
  "worldview": "世界观和背景设定，1-2句",
  "plot_bible": "故事梗概，100-200字，包含主要人物关系和核心冲突",
  "tone": "情感基调，英文，如 lighthearted romance / dark thriller"
}

只输出 JSON 对象，没有其他内容。
```

---

#### 4C — 分镜提示词请求

**System：**
```
你是专业的 AI 视频分镜师和 Stable Diffusion 提示词工程师。只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。
```

**User：**
```
根据以下视频帧分析，提取关键分镜，最多输出 20 个场景。

视觉分析：
{visionText}

返回 JSON 数组，每个分镜的结构：
[
  {
    "index": 序号从1开始,
    "timestamp": "估算时间戳，格式 HH:MM:SS",
    "shot_type": "close-up 或 medium 或 wide 或 extreme-close-up",
    "composition": "构图描述，如 rule of thirds / centered / symmetrical",
    "lighting": "光线描述，如 warm side lighting / cold backlight",
    "camera_motion": "static 或 push-in 或 pull-out 或 pan 或 follow 或 handheld",
    "sd_prompt": "完整的英文 Stable Diffusion 提示词，包含画质词、风格词、场景词，逗号分隔"
  }
]

只输出 JSON 数组，没有其他内容。
```

---

**错误处理：** 三个请求任一失败，捕获错误并返回该类型的空默认值，不中断整体流水线

**JSON 解析兜底：** parse 前先用正则去掉可能残留的 markdown 代码块标记 ` ```json ` 和 ` ``` `

**输出：**
```typescript
{
  characters: Character[]
  story: Story
  shots: Shot[]
}
```

---

### Step 5：validate（src/steps/step5-validate.ts）

**功能：** 用 Zod 校验数据完整性，补充 metadata，输出最终结果

**输入：** 所有前置步骤的结果

**处理逻辑：**
1. 对 characters、story、shots 分别做 Zod parse（用 safeParse，失败时用空默认值）
2. 组合成完整 PromptPack 对象
3. 补充 `video_id`、`processing_time_ms` 字段

**输出：** PromptPack（类型由 types.ts 定义）

---

## types.ts 完整定义

```typescript
import { z } from "zod"

export const CharacterSchema = z.object({
  name: z.string(),
  appearance: z.string(),
  sd_tags: z.string(),
  lora_suggestion: z.string(),
})

export const ShotSchema = z.object({
  index: z.number(),
  timestamp: z.string(),
  shot_type: z.enum(["close-up", "medium", "wide", "extreme-close-up"]),
  composition: z.string(),
  lighting: z.string(),
  camera_motion: z.enum(["static", "push-in", "pull-out", "pan", "follow", "handheld"]),
  sd_prompt: z.string(),
})

export const StorySchema = z.object({
  genre: z.array(z.string()),
  worldview: z.string(),
  plot_bible: z.string(),
  tone: z.string(),
})

export const PromptPackSchema = z.object({
  video_id: z.string(),
  duration_seconds: z.number().optional(),
  characters: z.array(CharacterSchema),
  story: StorySchema,
  shots: z.array(ShotSchema),
  processing_time_ms: z.number().optional(),
})

export type Character = z.infer<typeof CharacterSchema>
export type Shot = z.infer<typeof ShotSchema>
export type Story = z.infer<typeof StorySchema>
export type PromptPack = z.infer<typeof PromptPackSchema>

// 流水线内部传递的上下文对象
export interface PipelineContext {
  videoId: string
  videoPath: string
  tmpDir: string
  frames: string[]
  audioPath: string
  visionText: string
  transcript: string
  startTime: number
}
```

---

## pipeline.ts 逻辑

```typescript
// pipeline.ts 伪代码结构，按此逻辑实现

export async function runPipeline(videoPath: string): Promise<PromptPack> {
  const ctx = initContext(videoPath)  // 初始化 PipelineContext

  try {
    // Step 1：抽帧（串行，后续步骤依赖产物）
    const extracted = await step1Extract(ctx.videoPath)
    ctx.tmpDir = extracted.tmpDir
    ctx.frames = extracted.frames
    ctx.audioPath = extracted.audioPath

    // Step 2 + Step 3：并行执行（视觉分析 和 语音转录 互相独立）
    const [visionText, transcript] = await Promise.all([
      step2Vision(ctx.frames),
      step3Transcribe(ctx.audioPath),  // 直传 base64，同步返回
    ])
    ctx.visionText = visionText
    ctx.transcript = transcript

    // Step 4：并行生成三类提示词（互相独立）
    const generated = await step4Generate(ctx.visionText, ctx.transcript)

    // Step 5：校验 + 格式化
    const result = step5Validate(ctx, generated)

    return result
  } finally {
    // 无论成功失败，清理本地临时文件
    await cleanup(ctx.tmpDir, ctx.videoPath)
  }
}
```

---

## index.ts 结构

```typescript
// 注册 dotenv、Fastify、multipart
// GET /health → 返回 { status: "ok" }
// POST /analyze：
//   1. 接收 multipart 文件
//   2. 校验扩展名（.mp4 .mov .avi .mkv .webm）
//   3. 将文件流写入 os.tmpdir() 临时路径
//   4. 调用 runPipeline(tmpPath)
//   5. 返回结果 JSON
//   6. 错误统一返回 { error, detail }
// 监听 PORT，启动成功打印地址
```

---

## README.md 内容要求

包含以下章节：
1. 项目简介（一句话）
2. 功能特性（bullet 列表）
3. 前置要求（Node.js 18+、ffmpeg、阿里云百炼 Key、DeepSeek Key）
4. 安装步骤（clone → npm install → 配置 .env → npm run dev）
5. 接口文档（POST /analyze 示例 curl 命令）
6. 返回结果示例（完整 JSON）
7. 注意事项（文件大小限制、临时文件自动清理、音频最长5分钟、不支持 URL）

---

## 开发注意事项

1. **不要使用 ES Module** 语法，`import`/`export` 配合 tsconfig CommonJS 编译
2. **所有 API 调用必须有 try/catch**，单步失败不能导致整个请求 500
3. **本地临时文件在 pipeline.ts 的 finally 中清理**，包括上传的原始视频和 tmpDir
4. **音频时长限制**：千问3-ASR-Flash 最长支持 5 分钟，超出时 step3 捕获错误返回空字符串，不阻塞主流程
5. **并发控制**：Qwen 视觉分析每次最多 3 批并发，避免触发 429 限流
6. **JSON 解析兜底**：DeepSeek 返回的 content 在 parse 前先用 `.replace(/```json|```/g, "").trim()` 清理
7. **文件大小限制**：multipart 配置 `fileSize: 500 * 1024 * 1024`（500MB）
8. **日志**：每个 Step 开始和结束打印 console.log，格式 `[Step N] 描述 ...done（耗时 Xms）`

---

## 费用参考

以一段 3 分钟短剧（1fps 抽帧约 60 帧）为例：

| 步骤 | 模型 | 用量 | 费用 |
|---|---|---|---|
| 视觉分析 | Qwen2.5-VL-72B | ~48K Token 输入 | ¥0.17 |
| 语音转录 | 千问3-ASR-Flash | 180 秒音频 | ¥0.056 |
| 提示词生成 | DeepSeek V4 Pro | ~10K Token | ¥0.07 |
| **合计** | — | — | **≈ ¥0.30** |

新用户开通百炼可领超 7000 万 Token 免费额度，开发测试阶段基本不花钱。

---

*规格版本：v3.0 | 项目：ShortDramaLens | 转录方案：千问3-ASR-Flash 直传（无需 OSS）| 2026-05*
