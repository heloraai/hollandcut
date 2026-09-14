# talking-head-16x9

[![smoke](https://github.com/heloraai/talking-head-16x9/actions/workflows/smoke.yml/badge.svg)](https://github.com/heloraai/talking-head-16x9/actions/workflows/smoke.yml)

一个 **Claude Code skill**（Codex 也能用）：把连续录制的中文口播，剪成 16:9 金色包装成片。

A Claude Code skill that turns raw Chinese talking-head footage into a polished 16:9 video — retake removal, pacing, burned-in subtitles and animated graphics — built on FFmpeg, whisper.cpp and Remotion.

## 它做什么

- 去重录、去口误，按你自己的停顿压气口（静音谱 + 转写对照，只删核实过的）
- whisper.cpp 转写 → 描边白字字幕，关键词金色 + 金线描出
- 贯穿全片的章节标签、步进词条、脑图板、全屏对比、真实截图大图（人物自动缩到左下金框圆窗）、箭头链、大字数据
- Remotion 渲染 1080p，自动 QA（解码、音轨逐字节比对、黑帧 / 白闪 / 重复帧 / 单帧乱帧），交付 MP4 + SRT + 抽帧检查图

画面标准来自一条口播成片的 11 轮逐版返工，全部写在 [references/standards.md](references/standards.md)。

## 它会主动问你要什么

agent 第一步只出「素材体检 + 画面结构提案 + 缺图清单」，**等你确认才开剪**：

1. **原始口播**（必需）：1–N 段，按录制顺序
2. **逐字文案**（可选）：用来校对字幕错字、核对漏句
3. **缺图清单里的每张图**：截图 / 长图 / 视频素材；也可以选「不放图，用词条代替」
4. **拿不准的决定**：要不要水平镜像（手机前置摄像头）、气口松紧、疑似重录段的去留

## 用到的本地工具（完整清单）

| 工具 | 版本要求 | 用来干什么 | 谁调用 |
|---|---|---|---|
| Claude Code 或 Codex | 能看图 | 读转写和缩略图，写提案 / 剪辑规则 / 画面结构，按 SKILL.md 调脚本 | — |
| Python | ≥ 3.8，只用标准库 | 全部流水线脚本，不需要 pip 装任何包 | `scripts/*.py` |
| FFmpeg + ffprobe | ≥ 4.4，**必须带 libx264** | 抽帧、抽音频、静音检测、拼接剪辑、镜像、人物层 / 磨砂底、QA 检测 | 几乎所有脚本 |
| whisper.cpp（`whisper-cli`） | ≥ 1.7 | 语音转写（段级时间戳） | `plan.py`、`build_recut.py` |
| Whisper 模型 `ggml-large-v3.bin` | 3.1 GB | 中文转写；小模型能跑，但错字明显多 | 同上 |
| Node.js + npm | ≥ 18 | 安装和运行 Remotion | `render.py`、预览 |
| Remotion 4.0.410 + React 19 | `npm install` 自动装 | 画图形层和字幕，渲染 1080p | `remotion/` |
| Chromium（chrome-headless-shell） | Remotion 首次渲染时自动下载，约 100 MB | Remotion 用它逐帧截图 | Remotion |
| 中文字体 | 系统自带 | 卡片和字幕的字形 | Remotion |

仓库**不附带任何字体文件**：macOS 用系统的冬青黑体 / 苹方，Windows 用微软雅黑，Linux 需要装 `fonts-noto-cjk`。

## 安装

### 1. 把仓库放进 skill 目录

```bash
git clone https://github.com/heloraai/talking-head-16x9 ~/.claude/skills/talking-head-16x9
# Codex 用户：克隆到 ~/.codex/skills/talking-head-16x9
```

### 2. 装依赖

**macOS**

```bash
brew install ffmpeg whisper-cpp node
```

**Ubuntu / Debian**

```bash
sudo apt install ffmpeg fonts-noto-cjk cmake build-essential
# Node.js ≥ 18：用 nvm 或 https://nodejs.org 安装（apt 自带的版本可能太旧）
git clone --depth 1 https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j --target whisper-cli
echo "export PATH=\"$PWD/build/bin:\$PATH\"" >> ~/.bashrc
```

**Windows**（未实测）：`winget install Gyan.FFmpeg OpenJS.NodeJS.LTS`；whisper.cpp 在 [Releases](https://github.com/ggml-org/whisper.cpp/releases) 下载 `whisper-bin-x64.zip`，解压后把目录加进 PATH；在 Git Bash 或 WSL2 里用，并先执行 `setx PYTHONUTF8 1`（脚本按 UTF-8 读写中文文件）。

### 3. 下载转写模型（3.1 GB）

```bash
mkdir -p ~/.cache/whisper
curl -L -o ~/.cache/whisper/ggml-large-v3.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
# 国内网络：把 huggingface.co 换成 hf-mirror.com
```

### 4. 体检

```bash
python3 ~/.claude/skills/talking-head-16x9/scripts/tools.py
```

```
环境体检（Darwin）
  ✓ Python        3.11.15
  ✓ ffmpeg        /opt/homebrew/bin/ffmpeg  〔已跳过没有 libx264 的 /opt/anaconda3/bin/ffmpeg〕
  ✓ ffprobe       /opt/homebrew/bin/ffprobe
  ✓ whisper-cli   /opt/homebrew/bin/whisper-cli
  ✓ whisper 模型  ~/.cache/whisper/ggml-large-v3.bin  3.1GB
  ✓ Node.js       v22.11.0
  ✓ 中文字体      系统自带
✓ 环境就绪
```

有 ✗ 的项，体检会直接给出你这个系统的安装命令。全 ✓ 后，想确认整条流水线能跑通，再跑一次冒烟测试（合成一段英文口播 → 出片；需要 macOS 自带的 `say` 或 Linux 的 `espeak-ng`）：

```bash
python3 ~/.claude/skills/talking-head-16x9/tests/smoke.py
```

## 使用

在 Claude Code 里直接说：

> 剪一下这条口播：/Users/me/Movies/1.mov /Users/me/Movies/2.mov

| 阶段 | agent 做什么 | 你要做什么 |
|---|---|---|
| 0 体检 + 提案 | 转写、抽帧，出结构提案和缺图清单 | 确认结构，给图或选「不放图」 |
| 1 剪辑 | 去重录压气口，出母版，复核转写，做人物层 | — |
| 2 画面结构 | 按台词锚点写 `structure.py`，生成 spec 并体检 | — |
| 3 预览 → 渲染 | 关键时刻出静帧自查，整片渲染 + QA | 看成片，点名返工 |

成片在 `~/Downloads/<项目名>_v1/`：MP4 + SRT + 抽帧检查图。返工出新版本号，不覆盖旧版。

## 环境变量（都可选）

| 变量 | 默认 | 说明 |
|---|---|---|
| `FFMPEG` / `FFPROBE` | 自动：PATH 上第一个带 libx264 的 ffmpeg | Anaconda 自带的 ffmpeg 没有 libx264，会被自动跳过 |
| `WHISPER_CLI` | PATH 上的 `whisper-cli` | |
| `WHISPER_MODEL` | 依次找 `~/.cache/whisper/`、`~/.cache/hyperframes/whisper/models/` 下的 large-v3 / large-v3-turbo / medium | 装过 HyperFrames 的，可以直接复用它下载的模型 |
| `WHISPER_LANG` | `zh` | 字幕切分和规则按中文调过；其他语言只保证能跑通 |
| `REMOTION_BROWSER_EXECUTABLE` | 空 = Remotion 自动下载 | 下载失败时填本机 Chrome 路径（见下） |
| `REMOTION_NODE_MODULES` | 空 = 每个项目 `npm install` | 填一个已装好的 `node_modules`，新项目直接软链复用 |
| `CONCURRENCY` | `1` | 渲染并发；调高更快，但内存吃紧时会出瓦片乱帧 |
| `SCRATCH` | 系统临时目录 | 渲染暂存，约需 6 GB |

## 国内网络

- npm 慢：`npm config set registry https://registry.npmmirror.com`
- 模型：用 `hf-mirror.com` 替换 `huggingface.co`
- Remotion 下载浏览器失败：改用本机 Chrome
  - macOS：`export REMOTION_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  - Linux：`export REMOTION_BROWSER_EXECUTABLE=/usr/bin/google-chrome`
  - Windows：`C:\Program Files\Google\Chrome\Application\chrome.exe`

## 平台支持

| 平台 | 状态 |
|---|---|
| macOS（Apple Silicon） | 实测；whisper.cpp 走 Metal 加速 |
| Linux（Ubuntu） | 每次提交由 CI 跑完整冒烟测试（上方徽章） |
| Windows | 未实测 |

## 常见问题

- **体检说 ffmpeg 没有 libx264**：多半是 Anaconda 的 ffmpeg 排在 PATH 前面。按上面装一个正常的 ffmpeg，体检会自动挑它；或者 `export FFMPEG=/path/to/ffmpeg`。
- **`npm install` 后报 esbuild 相关错误**：你的 npm 禁用了安装脚本，手动补一步 `node node_modules/esbuild/install.js`。
- **报 `No browser found for rendering frames`**：Remotion 4.0.410 自带的浏览器解压在 Node 26 上会静默中断（17 个文件只解出 2 个）。`preflight.py` 发现后会自动用 Python 补解；如果你绕开流水线直接跑 `npx remotion`，先跑一次 `python3 preflight.py`，或者换 Node 22 / 24 LTS。
- **中文显示成方块**：缺中文字体。Linux 执行 `sudo apt install fonts-noto-cjk`。
- **成片偶发整幅 3×3 瓦片拼贴的乱帧**：保持 `CONCURRENCY=1`；QA 的单帧乱帧扫描扫到会直接报错，不会交付。

## 目录

```
SKILL.md                         agent 读的流程说明
references/standards.md          验收硬规则（内容完整性 / 气口 / 字幕 / 画面 / 动效 / QA）
references/motion-vocabulary.md  动效词汇表
scripts/                         流水线脚本（plan.py 会拷进每个项目目录）
templates/                       每个项目改写的剪辑规则、字幕规则、画面结构模板
assets/remotion/                 Remotion 工程（图形组件）
tests/smoke.py                   冒烟测试
```

## 许可

本仓库代码：MIT。第三方组件有各自的许可：

- **Remotion**：个人、非营利组织和 3 人以内的公司免费；更大的公司商用需要购买公司许可，见 [remotion.dev/license](https://www.remotion.dev/license)
- whisper.cpp、Whisper 模型：MIT
- FFmpeg：LGPL / GPL（本仓库不分发 FFmpeg）
