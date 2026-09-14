---
name: talking-head-16x9
description: 把连续录制的中文口播（手机 / 相机横屏，1–N 段 .mov/.mp4）剪成 16:9 金色包装成片——去重录保气口、描边字幕 + 金色关键词、贯穿章节标签、贴纸词条、脑图板、全屏接管对比、真实截图大图（人物自动缩左下圆窗）、箭头链、大字数据，Remotion 渲染 1080p。触发词：「按这个水准剪」「talking-head 16:9」「剪一下这条口播」「做成片（横屏）」。**先出素材体检 + 画面结构提案 + 缺图清单让用户确认，再开工。**
---

# talking-head-16x9

验收标准来自一条口播成片的 11 轮逐版返工。**硬规则全在 [references/standards.md](references/standards.md)**，动效词汇在 [references/motion-vocabulary.md](references/motion-vocabulary.md)，开工前必读两份。下文 `<SKILL>` = 本 skill 所在目录。

## 环境（每台机器第一次）

```bash
python3 <SKILL>/scripts/tools.py    # 体检：ffmpeg(libx264) / whisper-cli + 模型 / Node ≥18 / 中文字体
```

有 ✗ 先按提示装好再开工。依赖清单、安装方法、环境变量见 [README.md](README.md)。

## 开工前主动向用户要的东西

写进阶段 0 的提案，逐项问清；没给齐不进阶段 1：

1. **原始口播**（必需）：1–N 段，按录制顺序。
2. **逐字文案**（可选）：有就用来校对字幕错字、核对漏句。
3. **缺图清单里的每张图**：截图 / 长图 / 视频素材，放 `remotion/public/`；也可以选「不放图，用词条代替」。
4. **拿不准的决定**：是否水平镜像、气口松紧、疑似重录段去留、ASR 听不清的数字和专有名词。

## 阶段 0 —— 体检 + 提案（不剪不渲，等用户确认）

```bash
python3 <SKILL>/scripts/plan.py --name <项目名> --src 1.mov 2.mov 3.mov
cd edit_<项目名>
```

`plan.py` 转写全部片段、出静音谱、抽帧，铺好 Remotion 工程和流水线脚本。然后 **Claude 亲自读** `plan/transcript.md` + `plan/contact_*.png` + `plan/first_*.png`，写 `plan/proposal.md`，内容固定四块：

1. **素材体检**：分辨率 / 是否镜像（看画面文字方向）/ 时长 / 重录密度 / 720p 提示。
2. **内容结构**：按话题分章节（标签文案），每章标注用哪种画面族（词条 / 脑图 / 接管 / 大图 / 链 / 数据），估算图形覆盖率（目标 45–55%）和最长纯人物段。
3. **缺图清单**：每张需要的图写「用在哪句台词、想要什么（官方截图 / 招聘长图 / 数据看板）、建议来源」，让用户**选择或提供**；没有图的地方给「不放图，用词条」的备选。
4. **不确定项**：ASR 听不清的数字 / 专有名词、疑似重录但拿不准的段。

把提案发到对话里，**停下等用户确认**（结构 / 图 / 镜像 / 气口松紧）。用户没回不许进阶段 1。

## 阶段 1 —— 剪辑

1. 用户确认后，把 `plan/proposal.md` 的决定写进 `edl_rules.py`（丢弃 / 强制保留 / HFLIP / 气口）和 `cue_rules.py`（错字 / 金色关键词 / 保护词）。
2. 跑：
   ```bash
   python3 detect.py && python3 build_edl.py && python3 build_recut.py   # build_recut 顺带转写母版 → build/tm.json
   python3 build_cues.py
   ```
3. **复核粗剪转写**（`build/tm.json`）：逐句对照原文，看有没有假起残留、好句被误伤、数字听错；改规则重跑，直到全文通顺。这是内容完整性契约，不许跳。
4. 人物层（母版每改一次都要重做）：`python3 layers.py`

## 阶段 2 —— 画面结构

```bash
cd remotion && npm install && cd ..   # 每个项目第一次；想复用已装好的依赖，跑 plan.py 前 export REMOTION_NODE_MODULES=<某个 node_modules>
```

按确认过的提案写 `structure.py`（照 [templates/structure_example.py](templates/structure_example.py) 的 DSL，全部用台词锚点），然后：

```bash
python3 gen_spec.py structure.py && python3 preflight.py
```

看体检输出：覆盖率、最长隐身、每板节点入场时刻、⚠ 项。图片文件放 `remotion/public/`，长图用 `show_scroll`，竖图先裁成横版局部；视频素材用 `show_video`（full=True 开场全屏 B-roll，素材先 ffmpeg setpts 变速到窗口长度）；`SUBS = False` 可整片不烧字幕（SRT 照常交付）。

## 阶段 3 —— 局部预览 → 整片渲染 → QA → 交付

先对每个有图 / 有链 / 有接管的时刻出 still 拼 contact sheet 亲眼检查，确认无碰撞、无压脸、无断词：

```bash
cd remotion && npx remotion bundle src/index.ts --out-dir=../.bundle && npx remotion still ../.bundle Shen ../plan/still_N.png --frame=N && cd ..
```

再整片：

```bash
python3 render.py v1   # 预检 → 打包 → 渲染 → 母版音轨换回 → QA → SRT → contact sheet → ~/Downloads/<项目>_v1/
```

QA 任一项不过不交付。返工只改点名的部分，新版本号，不覆盖旧版。

## 返工原则
所有时间都由台词锚点派生：改剪辑 → 重跑阶段 1 尾段 + `gen_spec` 即可，图形字幕自动跟上。出画面问题先怀疑自己叠的层。
