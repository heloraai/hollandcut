# -*- coding: utf-8 -*-
"""
阶段 0：素材体检 + 转写 + 出「结构提案」骨架。**不剪、不渲染**，只产出给用户确认的材料。

用法：python3 plan.py --name <项目名> --src 1.mov 2.mov ... [--out <目录>]
产出（<out>/）：
  sources.json            片段顺序
  build/t{i}.json         whisper 转写（段级）
  build/a{i}.wav          16k 单声道音频（后续脚本共用）
  build/spans{i}.json     静音谱反推的语音区间
  plan/probe.md           分辨率 / 旋转 / 镜像抽帧 / 时长
  plan/transcript.md      带时间码的全文（重录候选已标 ⟲）
  plan/contact_{i}.png    每段 12 帧缩略
  plan/proposal.md         提案模板（效果强度 / 动效位置 / 缺图清单 / 体检 / 不确定项），由 Claude 填好发给用户
之后等用户确认提案，再进入阶段 1。
"""
import argparse, json, os, re, shutil, subprocess

from tools import FFMPEG as FF, FFPROBE as FP, speech_spans, transcribe

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEPS = ("tools.py", "detect.py", "build_edl.py", "build_recut.py", "build_cues.py", "layers.py",
         "gen_spec.py", "preflight.py", "render.py", "spike_scan.py", "webshot.py")

ap = argparse.ArgumentParser()
ap.add_argument("--name", required=True)
ap.add_argument("--src", nargs="+", required=True)
ap.add_argument("--out", default=None)
args = ap.parse_args()
out = os.path.abspath(args.out or f"./edit_{args.name}")
for d in ("src", "build", "plan", "remotion/public"): os.makedirs(f"{out}/{d}", exist_ok=True)

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True).stdout

# 1. 收素材 + 体检
srcs = {}
probe = ["# 素材体检\n"]
for i, p in enumerate(args.src, 1):
    ext = os.path.splitext(p)[1].lower()
    dst = f"{out}/src/{i}{ext}"
    if not os.path.exists(dst): shutil.copy2(p, dst)
    srcs[str(i)] = dst
    j = json.loads(run([FP, '-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate,codec_name:stream_tags=rotate:stream_side_data=rotation',
                        '-show_entries', 'format=duration', '-of', 'json', dst]))
    v = [s for s in j["streams"] if s.get("width")][0]
    rot = v.get("tags", {}).get("rotate") or (v.get("side_data_list") or [{}])[0].get("rotation", 0)
    d = float(j["format"]["duration"])
    run([FF, '-v', 'error', '-y', '-ss', '2', '-i', dst, '-frames:v', '1', '-vf', 'scale=640:-1', f'{out}/plan/first_{i}.png'])
    run([FF, '-v', 'error', '-y', '-i', dst, '-vf', f'fps=12/{max(d, 1):.3f},scale=320:-1,tile=6x2', '-frames:v', '1', f'{out}/plan/contact_{i}.png'])
    run([FF, '-v', 'error', '-y', '-i', dst, '-vn', '-ar', '16000', '-ac', '1', f'{out}/build/a{i}.wav'])
    probe.append(f"- clip{i} `{os.path.basename(p)}`：{v['width']}×{v['height']} rotation={rot} {v['codec_name']} {d:.1f}s  → 抽帧 plan/first_{i}.png（**请确认是否镜像**：看画面里的文字是否反向）")
json.dump(srcs, open(f"{out}/sources.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(f"{out}/plan/probe.md", "w", encoding="utf-8").write("\n".join(probe) + "\n")
print("\n".join(probe))

# 2. 转写 + 静音谱
lines = ["# 逐字稿（⟲ = 疑似重录，后一句是前一句的延长）\n"]
for i in srcs:
    if not os.path.exists(f"{out}/build/t{i}.json"):
        transcribe(f"{out}/build/a{i}.wav", f"{out}/build/t{i}")
    segs = [(s["offsets"]["from"]/1000, s["offsets"]["to"]/1000, s["text"].strip())
            for s in json.load(open(f"{out}/build/t{i}.json", encoding="utf-8"))["transcription"] if s["text"].strip()]
    norm = lambda t: re.sub(r'[\s，。、？！,.?!]', '', t)
    lines.append(f"\n## clip{i}\n")
    for k, (a, b, t) in enumerate(segs):
        nx = norm(segs[k+1][2]) if k+1 < len(segs) else ""
        flag = " ⟲" if len(norm(t)) >= 3 and nx.startswith(norm(t)[:max(3, int(len(norm(t))*0.8))]) else ""
        lines.append(f"[{a:7.2f}-{b:7.2f}] {t}{flag}")
    spans, _ = speech_spans(f"{out}/build/a{i}.wav")
    json.dump(spans, open(f"{out}/build/spans{i}.json", "w"))
open(f"{out}/plan/transcript.md", "w", encoding="utf-8").write("\n".join(lines) + "\n")

# 3. 铺 Remotion 工程骨架 + 流水线脚本（不含 node_modules）
for f in ("package.json", "tsconfig.json", "remotion.config.ts"):
    shutil.copy2(f"{SKILL}/assets/remotion/{f}", f"{out}/remotion/{f}")
if os.path.exists(f"{out}/remotion/src"): shutil.rmtree(f"{out}/remotion/src")
shutil.copytree(f"{SKILL}/assets/remotion/src", f"{out}/remotion/src")
for f in STEPS:
    shutil.copy2(f"{SKILL}/scripts/{f}", f"{out}/{f}")
for f in ("edl_rules.py", "cue_rules.py"):
    if not os.path.exists(f"{out}/{f}"): shutil.copy2(f"{SKILL}/templates/{f}", f"{out}/{f}")
if not os.path.exists(f"{out}/plan/proposal.md"):
    shutil.copy2(f"{SKILL}/templates/proposal.md", f"{out}/plan/proposal.md")
nm = os.environ.get("REMOTION_NODE_MODULES", "")
if nm and os.path.isdir(nm) and not os.path.exists(f"{out}/remotion/node_modules"):
    os.symlink(nm, f"{out}/remotion/node_modules")
print(f"\n项目目录 {out}\n下一步：Claude 读 plan/transcript.md + plan/contact_*.png，填 plan/proposal.md"
      "（先问：效果强度 lite/pro/max、动效位置、缺图），发给用户确认后再剪。")
