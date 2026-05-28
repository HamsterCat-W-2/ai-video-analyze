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
| **目标** | 跑通核心链路，验证提示词质量；三个 AI 能力层均可通过环境变量自由替换模型 |

---

## 设计原则：模型无关（Model-Agnostic）

三个 AI 能力层**完全解耦**，每层通过独立的环境变量配置 `baseURL`、`apiKey`、`model`，只要目标平台支持 **OpenAI 兼容接口**，换一套环境变量即可切换，无需改动任何代码。

```
视觉分析层   → VISION_BASE_URL  + VISION_API_KEY  + VISION_MODEL
语音转录层   → ASR_BASE_URL     + ASR_API_KEY     + ASR_MODEL
提示词生成层 → LLM_BASE_URL     + LLM_API_KEY     + LLM_MODEL
```

---

## 技术栈

| 用途 | 选型 |
|---|---|
| HTTP 框架 | Fastify |
| 文件上传 | @fastify/multipart |
| 视频处理 | fluent-ffmpeg（需本地安装 ffmpeg） |
| AI 调用统一 SDK | openai（兼容所有 OpenAI 格式接口） |
| 数据校验 | Zod |
| 类型安全 | TypeScript strict 模式 |
| 运行方式 | tsx（开发），tsc + node（生产） |

---

## 目录结构

```
short-drama-lens/
├── src/
│   ├── index.ts               # 服务入口，注册路由
│   ├── pipeline.ts            # 五步流水线主函数
│   ├── clients.ts             # 三个 AI 客户端统一初始化
│   ├── types.ts               # 所有类型定义和 Zod Schema
│   └── steps/
│       ├── step1-extract.ts   # Step1：ffmpeg 抽帧 + 分离音轨
│       ├── step2-vision.ts    # Step2：视觉分析（可换任意视觉模型）
│       ├── step3-transcribe.ts# Step3：语音转录（可换任意 ASR 模型）
│       ├── step4-generate.ts  # Step4：生成三类提示词（可换任意 LLM）
│       └── step5-validate.ts  # Step5：Zod 校验 + 输出格式化
├── .env.example               # 含多套预设配置注释
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 环境变量

文件名：`.env`

```bash
# ── 视觉分析层 ──────────────────────────────────────────
# 需要支持图像输入的多模态模型
VISION_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
VISION_API_KEY=sk-xxxxxxxx
VISION_MODEL=mimo-v2.5

# ── 语音转录层 ──────────────────────────────────────────
# 需要支持音频输入（input_audio）或 audio transcriptions 接口
ASR_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
ASR_API_KEY=sk-xxxxxxxx
ASR_MODEL=mimo-v2-omni

# ── 提示词生成层 ────────────────────────────────────────
# 纯文本大模型，推理能力强即可
LLM_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
LLM_API_KEY=sk-xxxxxxxx
LLM_MODEL=mimo-v2.5-pro

# ── 服务配置 ────────────────────────────────────────────
PORT=3000
```

---

## .env.example：常用平台预设

```bash
# ════════════════════════════════════
# 方案 A：全部使用小米 MiMo（默认推荐）
# ════════════════════════════════════
# VISION_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
# VISION_API_KEY=sk-xxxxxxxx
# VISION_MODEL=mimo-v2.5
#
# ASR_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
# ASR_API_KEY=sk-xxxxxxxx
# ASR_MODEL=mimo-v2-omni
#
# LLM_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
# LLM_API_KEY=sk-xxxxxxxx
# LLM_MODEL=mimo-v2.5-pro

# ════════════════════════════════════
# 方案 B：阿里云百炼（视觉+语音）+ DeepSeek（生成）
# ════════════════════════════════════
# VISION_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# VISION_API_KEY=sk-xxxxxxxx
# VISION_MODEL=qwen2.5-vl-72b-instruct
#
# ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# ASR_API_KEY=sk-xxxxxxxx
# ASR_MODEL=qwen3-asr-flash
#
# LLM_BASE_URL=https://api.deepseek.com/v1
# LLM_API_KEY=sk-xxxxxxxx
# LLM_MODEL=deepseek-chat

# ════════════════════════════════════
# 方案 C：OpenAI 全家桶
# ════════════════════════════════════
# VISION_BASE_URL=https://api.openai.com/v1
# VISION_API_KEY=sk-xxxxxxxx
# VISION_MODEL=gpt-4o
#
# ASR_BASE_URL=https://api.openai.com/v1
# ASR_API_KEY=sk-xxxxxxxx
# ASR_MODEL=whisper-1          # 注意：whisper 走 audio.transcriptions 接口，见 step3 说明
#
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=sk-xxxxxxxx
# LLM_MODEL=gpt-4o

# ════════════════════════════════════
# 方案 D：混搭（视觉用 MiMo，语音用 Groq Whisper，生成用 DeepSeek）
# ════════════════════════════════════
# VISION_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
# VISION_API_KEY=sk-xxxxxxxx
# VISION_MODEL=mimo-v2.5
#
# ASR_BASE_URL=https://api.groq.com/openai/v1
# ASR_API_KEY=gsk-xxxxxxxx
# ASR_MODEL=whisper-large-v3
#
# LLM_BASE_URL=https://api.deepseek.com/v1
# LLM_API_KEY=sk-xxxxxxxx
# LLM_MODEL=deepseek-chat
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
  "description": "AI短剧视频提示词提取器（模型无关架构）",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## clients.ts（三个客户端统一初始化）

```typescript
import OpenAI from "openai"

// 视觉分析客户端
export const visionClient = new OpenAI({
  apiKey: process.env.VISION_API_KEY!,
  baseURL: process.env.VISION_BASE_URL!,
})

// 语音转录客户端
export const asrClient = new OpenAI({
  apiKey: process.env.ASR_API_KEY!,
  baseURL: process.env.ASR_BASE_URL!,
})

// 提示词生成客户端
export const llmClient = new OpenAI({
  apiKey: process.env.LLM_API_KEY!,
  baseURL: process.env.LLM_BASE_URL!,
})

// 从环境变量读取模型名
export const MODELS = {
  vision: process.env.VISION_MODEL!,
  asr:    process.env.ASR_MODEL!,
  llm:    process.env.LLM_MODEL!,
}
```

> 启动时打印当前使用的模型配置，方便调试：
> `console.log("[Config] vision=%s asr=%s llm=%s", MODELS.vision, MODELS.asr, MODELS.llm)`

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
    "plot_bible": "平凡女助理意外与强势总裁产生交集，在误会与纠葛中逐渐相互吸引。",
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
      "sd_prompt": "cinematic close-up portrait, 1man, sharp features, warm side lighting, shallow DOF, bokeh background, 8k"
    }
  ],
  "models_used": {
    "vision": "mimo-v2.5",
    "asr": "mimo-v2-omni",
    "llm": "mimo-v2.5-pro"
  },
  "processing_time_ms": 42300
}
```

> `models_used` 字段记录本次实际使用的模型，方便对比不同配置的效果。

**错误响应（400 / 500）**

```json
{ "error": "错误描述", "detail": "具体原因" }
```

### GET /health

返回 `{ "status": "ok", "models": { "vision": "...", "asr": "...", "llm": "..." } }`

---

## 五步流水线实现规格

### Step 1：extract（src/steps/step1-extract.ts）

**功能：** 用 fluent-ffmpeg 从视频文件抽取帧图片和音轨，与模型无关

**输入：** videoPath: string

**处理逻辑：**
1. 用 `fs.mkdtemp` 创建临时目录 `tmpDir`
2. 并行执行两个 ffmpeg 任务：
   - 任务 A：1fps 抽帧，最多 60 帧，输出到 `tmpDir/frames/frame_%04d.jpg`
   - 任务 B：提取音轨，输出到 `tmpDir/audio.mp3`，编码 libmp3lame
3. 读取 frames 目录，按文件名排序，返回完整路径数组

**输出：**
```typescript
{ tmpDir: string; frames: string[]; audioPath: string }
```

---

### Step 2：vision（src/steps/step2-vision.ts）

**功能：** 调用视觉模型对视频帧批量分析，使用 `visionClient` + `MODELS.vision`

**输入：** frames: string[]

**处理逻辑：**
1. 将帧按每批 10 张分组
2. 每张图片读取为 base64，构造 `image_url` content item（`data:image/jpeg;base64,...`）
3. 每批一次请求，max_tokens: 2000；并发最多 3 批
4. 所有批次结果用 `\n\n---\n\n` 拼接

**分析 Prompt：**
```
按时间顺序分析这 N 帧画面，对每帧依次描述：
1. 人物：外貌特征（发色、发型、面部）、服装（颜色、款式）、表情
2. 场景：地点类型、背景环境、时间氛围、色调
3. 镜头：景别（特写/近景/中景/全景/远景）、构图方式、光线方向与质感
4. 运镜：静止 / 推进 / 拉远 / 摇移 / 跟拍（根据相邻帧推断）

每帧用 [Frame N] 作为标题，内容简洁，每项不超过2句。
```

**输出：** visionText: string

---

### Step 3：transcribe（src/steps/step3-transcribe.ts）

**功能：** 调用语音模型转录音轨，使用 `asrClient` + `MODELS.asr`

**输入：** audioPath: string

**重要：** 不同模型的 ASR 接口方式不同，通过 `ASR_MODEL` 环境变量自动判断走哪种调用路径：

#### 路径 A：Chat Completions + input_audio（适用大多数多模态模型）

适用模型：`mimo-v2-omni`、`qwen3-asr-flash`、`gpt-4o-audio-preview` 等

```typescript
// 读取音频为 base64
const audioData = await fs.readFile(audioPath, { encoding: "base64" })

const res = await asrClient.chat.completions.create({
  model: MODELS.asr,
  messages: [
    {
      role: "system",
      content: "请将音频内容完整转录为文字，只输出转录文本，不要添加任何解释。"
    },
    {
      role: "user",
      content: [{
        type: "input_audio",
        input_audio: { data: audioData, format: "mp3" }
      }]
    }
  ]
})
return res.choices[0].message.content ?? ""
```

#### 路径 B：Audio Transcriptions（适用 Whisper 系列）

适用模型：`whisper-1`、`whisper-large-v3`（OpenAI / Groq）

```typescript
const res = await asrClient.audio.transcriptions.create({
  file: fs.createReadStream(audioPath),
  model: MODELS.asr,
  language: "zh",
  response_format: "text",
})
return res as unknown as string
```

**路径自动选择逻辑：**

```typescript
// 包含 "whisper" 的模型名走路径 B，其余走路径 A
const useWhisperPath = MODELS.asr.toLowerCase().includes("whisper")
```

**兜底逻辑：** 任何路径失败均捕获错误，返回空字符串 `""`，不中断流水线

---

### Step 4：generate（src/steps/step4-generate.ts）

**功能：** 调用 LLM 生成三类提示词，使用 `llmClient` + `MODELS.llm`

**API 配置：**
- temperature: `0.2`
- 三个子任务并行发起

---

#### 4A — 人物提示词

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

返回 JSON 数组：
[{
  "name": "角色名或描述（如男主/女主）",
  "appearance": "英文外貌描述",
  "sd_tags": "SDXL 兼容英文标签，逗号分隔",
  "lora_suggestion": "推荐 LoRA 类型"
}]

只输出 JSON 数组。
```

---

#### 4B — 故事提示词

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
  "genre": ["风格标签"],
  "worldview": "世界观，1-2句",
  "plot_bible": "故事梗概，100-200字",
  "tone": "情感基调，英文"
}

只输出 JSON 对象。
```

---

#### 4C — 分镜提示词

**System：**
```
你是专业的 AI 视频分镜师和 Stable Diffusion 提示词工程师。只返回合法 JSON 数组，不要有任何 markdown 代码块或多余文字。
```

**User：**
```
根据以下视频帧分析，提取关键分镜，最多 20 个场景。

视觉分析：
{visionText}

返回 JSON 数组：
[{
  "index": 序号,
  "timestamp": "HH:MM:SS",
  "shot_type": "close-up | medium | wide | extreme-close-up",
  "composition": "构图描述",
  "lighting": "光线描述",
  "camera_motion": "static | push-in | pull-out | pan | follow | handheld",
  "sd_prompt": "完整英文 SD 提示词，逗号分隔"
}]

只输出 JSON 数组。
```

---

**错误处理：** 三个请求任一失败，捕获错误返回该类型空默认值，不中断流水线

**JSON 解析兜底：** parse 前先 `.replace(/```json|```/g, "").trim()`

---

### Step 5：validate（src/steps/step5-validate.ts）

**功能：** Zod 校验 + 补充 metadata

**处理逻辑：**
1. characters、story、shots 分别 safeParse，失败用空默认值
2. 补充 `video_id`、`models_used`、`processing_time_ms`

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
  models_used: z.object({
    vision: z.string(),
    asr: z.string(),
    llm: z.string(),
  }),
  processing_time_ms: z.number().optional(),
})

export type Character = z.infer<typeof CharacterSchema>
export type Shot = z.infer<typeof ShotSchema>
export type Story = z.infer<typeof StorySchema>
export type PromptPack = z.infer<typeof PromptPackSchema>

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
export async function runPipeline(videoPath: string): Promise<PromptPack> {
  const ctx = initContext(videoPath)

  try {
    // Step 1：抽帧（串行）
    const extracted = await step1Extract(ctx.videoPath)
    ctx.tmpDir    = extracted.tmpDir
    ctx.frames    = extracted.frames
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
```

---

## index.ts 结构

```typescript
// 1. import "dotenv/config"
// 2. 打印当前模型配置（vision / asr / llm）
// 3. 注册 Fastify + multipart（fileSize: 500MB）
// 4. GET /health → { status:"ok", models: MODELS }
// 5. POST /analyze：
//    - 接收文件，校验扩展名（.mp4 .mov .avi .mkv .webm）
//    - 落盘到 os.tmpdir()
//    - 调用 runPipeline，返回 JSON
//    - 错误返回 { error, detail }
// 6. 监听 PORT
```

---

## 开发注意事项

1. **Step 3 ASR 双路径**：含 `whisper` 的模型名走 `audio.transcriptions`，其余走 `chat.completions` + `input_audio`，通过模型名自动判断，无需手动配置
2. **不要使用 ES Module** 语法，`import`/`export` 配合 tsconfig CommonJS 编译
3. **所有 API 调用必须有 try/catch**，单步失败不中断整个请求
4. **本地临时文件在 pipeline.ts 的 finally 中统一清理**
5. **并发控制**：视觉分析每次最多 3 批并发，避免触发限流
6. **JSON 解析兜底**：LLM 返回 content 先 `.replace(/```json|```/g, "").trim()` 再 parse
7. **文件大小限制**：multipart 配置 `fileSize: 500 * 1024 * 1024`
8. **日志格式**：`[Step N][modelName] 描述 ...done（耗时 Xms）`

---

## 常用平台参数速查

| 平台 | baseURL | 视觉模型 | ASR 模型 | LLM 模型 |
|---|---|---|---|---|
| 小米 MiMo | `https://token-plan-cn.xiaomimimo.com/v1` | `mimo-v2.5` | `mimo-v2-omni` | `mimo-v2.5-pro` |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen2.5-vl-72b-instruct` | `qwen3-asr-flash` | `qwen-max` |
| DeepSeek | `https://api.deepseek.com/v1` | ❌ 不支持 | ❌ 不支持 | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` | `whisper-1` | `gpt-4o` |
| Groq | `https://api.groq.com/openai/v1` | ❌ 不支持 | `whisper-large-v3` | `llama-3.3-70b` |

---

*规格版本：v5.0 | 项目：ShortDramaLens | 模型无关架构，三层独立配置 | 2026-05*
