---
name: hollandcut
description: hollandcut：把中文口播剪成 16:9 金色包装成片（去重录保气口、描边字幕、章节标签、词条、脑图板、截图大图，Remotion 渲染 1080p）。三档效果强度 lite / pro / max，**开工前先问效果强度、动效位置、缺的图，出提案等用户确认**。触发词：「hollandcut」「剪一下这条口播」「做成片（横屏）」「做个宣传片」「动效拉满」「按这个水准剪」「talking-head 16:9」。max 另有开场剪辑器炸开、大字散射标题、圆环仪表盘、结尾 CTA 卡和全片持续微动效；lite 只加字幕、标签、词条和大字数据；素材是手机 / 相机横屏录的 1–N 段 .mov/.mp4。
---

# hollandcut

同一条流水线，三档效果强度：

| 档位 | 画面 | 适合 |
|---|---|---|
| **lite** | 字幕 + 章节标签 + 步进词条 + 大字数据；人物全程全屏 | 日更口播、访谈、纯观点 |
| **pro**（默认） | lite + 脑图板 / 全屏对比 / 截图大图（人物缩左下圆窗）/ 箭头链 / 成对贴纸；落定静止 | 知识讲解、干货 |
| **max** | pro + 招牌时刻（开场剪辑器 / 大字散射标题 / 圆环仪表盘 / 结尾 CTA 卡）+ 全片持续微动效 | 宣传片、发布、要惊艳 |

pro 的标准来自一条口播成片的 11 轮逐版返工，max 来自一条宣传片的 3 轮返工。**硬规则全在 [references/standards.md](references/standards.md)**（第 10 / 11 条是 max / lite 的差异），动效词汇在 [references/motion-vocabulary.md](references/motion-vocabulary.md)，开工前必读两份。下文 `<SKILL>` = 本 skill 所在目录。

## 环境（每台机器第一次）

```bash
python3 <SKILL>/scripts/tools.py    # 体检：ffmpeg(libx264) / whisper-cli + 模型 / Node ≥18 / 中文字体
```

有 ✗ 先按提示装好再开工。依赖清单、安装方法、环境变量见 [README.md](README.md)。

## 开工前先问清楚（写进阶段 0 提案；用户没回不进阶段 1）

1. **效果强度**：lite / pro / max，给推荐和一句理由。用户请求里已经表态的直接预选并注明（「动效拉满 / 要惊艳 / 宣传片」→ max，「简单点 / 快点出」→ lite）。
2. **动效位置**：按时间顺序列出每处动效（时间 + 台词 + 用哪种），用户可以增、删、挪；max 的招牌时刻放哪句单独确认。
3. **缺的图**：每张写「用在哪句、要什么、来源」。公开网页（官网、GitHub、产品页）agent 用 `webshot.py` 自己截；要登录的页面、App 内页、用户自己的数据找用户要。每张都给「不放图，用词条」的备选。lite 不需要图。
4. 其余：原始口播（必需，按录制顺序）、逐字文案（可选，校对错字和漏句）、是否水平镜像、气口松紧、疑似重录段去留、ASR 听不清的数字和专有名词。

## 阶段 0 —— 体检 + 提案（不剪不渲，等用户确认）

```bash
python3 <SKILL>/scripts/plan.py --name <项目名> --src 1.mov 2.mov 3.mov
cd edit_<项目名>
```

`plan.py` 转写全部片段、出静音谱、抽帧，铺好 Remotion 工程和流水线脚本，并把提案模板拷到 `plan/proposal.md`。**agent 亲自读** `plan/transcript.md` + `plan/contact_*.png` + `plan/first_*.png`，按模板填五块——效果强度 / 动效位置 / 缺图清单 / 素材体检 / 不确定项——发到对话里，**停下等用户确认**。

## 阶段 1 —— 剪辑

1. 用户确认后，把提案里的决定写进 `edl_rules.py`（丢弃 / 强制保留 / HFLIP / 气口）和 `cue_rules.py`（错字 / 金色关键词 / 保护词）。
2. 跑：
   ```bash
   python3 detect.py && python3 build_edl.py && python3 build_recut.py   # build_recut 顺带转写母版 → build/tm.json
   python3 build_cues.py
   ```
3. **复核粗剪转写**（`build/tm.json`）：逐句对照原文，看有没有假起残留、好句被误伤、数字听错；改规则重跑，直到全文通顺。这是内容完整性契约，不许跳。
4. 人物层（母版每改一次都要重做）：`python3 layers.py`（顺带抽开场剪辑器用的时间轴缩略图）

## 阶段 2 —— 画面结构

```bash
cd remotion && npm install && cd ..   # 每个项目第一次；想复用已装好的依赖，跑 plan.py 前 export REMOTION_NODE_MODULES=<某个 node_modules>
```

按确认过的提案写 `structure.py`，**第一行写档位** `TIER = "lite" | "pro" | "max"`，全部用台词锚点：

- **lite / pro**：照 [templates/structure_example.py](templates/structure_example.py)。lite 不许有 `g(...)` 和大图（gen_spec 直接报错）。
- **max**：照 [templates/structure_max_example.py](templates/structure_max_example.py)，在 pro 之上加招牌时刻：
  - `OPENING = hook_editor(标题, ui=, badge=(字, 锚点), steps=[(字, 锚点)…], boom=, stamp=(字, 锚点))`：开场剪辑器，从 0 秒起、占开头 5–9 秒，适合「这条视频是 AI 剪的」这类钩子
  - `TITLES = [title(文字, 起, 止, gold_from=, stamp=(字, 锚点), pills=[(字, 锚点)…≤2])]`：大字散射标题，给品牌名 / 核心概念第一次出现
  - `ENDCARD = endcard(名字, 标语, 链接, 起, 止, badge="已开源")`：结尾 CTA 卡（badge 是卡上的小章，可改可留空）
  - `stat(..., gauge=True)`：圆环仪表盘（百分比数据）
  - 持续微动效（词条打字机 / 呼吸光 / 链条能量点 / 大图 3D 入场 + 缓推 + 扫光 / 金色微尘）由 TIER 自动打开，不用写
  - 招牌时刻只放人物全屏段，gen_spec 会查

```bash
python3 gen_spec.py structure.py && python3 preflight.py
```

看体检输出：档位、招牌时刻、覆盖率、最长隐身、每板节点入场时刻、⚠ 项。图片放 `remotion/public/`（公开网页：`python3 webshot.py <网址> remotion/public/<名>.png`），长图用 `show_scroll`，竖图先裁成横版局部；视频素材用 `show_video`（full=True 开场全屏 B-roll，素材先 ffmpeg setpts 变速到窗口长度）；`SUBS = False` 可整片不烧字幕（SRT 照常交付）。

## 阶段 3 —— 局部预览 → 整片渲染 → QA → 交付

先对每个有图 / 有链 / 有接管的时刻出 still 拼 contact sheet 亲眼检查，确认无碰撞、无压脸、无断词；max 档每个招牌时刻至少看入场中、落定后两帧：

```bash
cd remotion && npx remotion bundle src/index.ts --out-dir=../.bundle && npx remotion still ../.bundle Shen ../plan/still_N.png --frame=N && cd ..
```

再整片：

```bash
python3 render.py v1   # 预检 → 打包 → 渲染 → 母版音轨换回 → QA → SRT → contact sheet → ~/Downloads/<项目>_v1/
```

开渲前告诉用户大概要多久：渲染 ≈ 成片时长 × 8，之后 QA 再 1–2 分钟（M1 Pro 并发 1 实测，分阶段耗时见 README「跑一次要多久」）。QA 任一项不过不交付（开场剪辑器的炸开白闪已登记，不算乱帧）。返工只改点名的部分，新版本号，不覆盖旧版。

## 返工原则
所有时间都由台词锚点派生：改剪辑 → 重跑阶段 1 尾段 + `gen_spec` 即可，图形字幕自动跟上。出画面问题先怀疑自己叠的层。用户嫌「平、没冲击力」时先问要不要升档（pro → max），别在 pro 里硬堆元素。
