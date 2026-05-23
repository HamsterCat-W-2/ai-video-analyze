# ShortDramaLens

上传一段 AI 短剧视频，自动分析并输出可复刻该视频的完整提示词包（人物、故事、分镜），JSON 格式返回。

## 功能特性

- 视频抽帧 + 音轨分离（ffmpeg）
- 视觉分析：Qwen2.5-VL-72B 逐帧分析人物、场景、镜头、运镜
- 语音转录：千问3-ASR-Flash 直传 base64 同步转录
- 提示词生成：DeepSeek V4 Pro 并行生成人物/故事/分镜三类提示词
- Zod 数据校验，保证输出格式一致
- 临时文件自动清理

## 前置要求

- Node.js 18+
- ffmpeg（`brew install ffmpeg` 或 `apt install ffmpeg`）
- 阿里云百炼 API Key（视觉分析 + 语音转录共用）
- DeepSeek API Key

## 安装步骤

```bash
git clone <repo-url>
cd ai-video-analyze
npm install
cp .env.example .env
# 编辑 .env，填入你的 API Key
npm run dev
```

## 接口文档

### POST /analyze

上传视频文件，返回提示词包。

```bash
curl -X POST http://localhost:3000/analyze \
  -F "file=@/path/to/video.mp4"
```

支持格式：`.mp4` `.mov` `.avi` `.mkv` `.webm`，最大 500MB。

### GET /health

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## 返回结果示例

```json
{
  "video_id": "a3f9b2c1",
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
    "plot_bible": "平凡女助理意外与强势总裁产生交集...",
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

## 注意事项

- 文件大小限制：500MB
- 临时文件（抽帧、音轨、上传文件）在处理完成后自动清理
- 音频转录最长支持 5 分钟，超出时转录返回空字符串，不影响其他步骤
- 不支持 URL 上传，仅支持本地文件
