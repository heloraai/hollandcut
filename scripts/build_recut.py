import json, subprocess, sys
from tools import FFMPEG, transcribe
try:
    from edl_rules import HFLIP
except ImportError:
    HFLIP = True
try:
    from edl_rules import SPEED          # 整片变速（atempo 保音调），1.0 = 原速
except ImportError:
    SPEED = 1.0
try:
    from edl_rules import LOUDNESS       # 母版响度目标（LUFS），抖音 / TikTok 用 -14；None = 不处理
except ImportError:
    LOUDNESS = -14.0
edl = json.load(open('build/edl.json'))
srcs = {int(k): v for k, v in json.load(open('sources.json', encoding='utf-8')).items()}
keys = sorted(srcs)
parts, labels = [], []
for n,(c,s,e) in enumerate(edl):
    k = keys.index(c)
    flip = "hflip," if HFLIP else ""
    parts.append(f"[{k}:v]trim={s}:{e},setpts=PTS-STARTPTS,{flip}format=yuv420p,setsar=1[v{n}]")
    parts.append(f"[{k}:a]atrim={s}:{e},asetpts=PTS-STARTPTS[a{n}]")
    labels.append(f"[v{n}][a{n}]")
tail = "[v][a]" if SPEED == 1 else f"[vc][ac];[vc]setpts=PTS/{SPEED}[v];[ac]atempo={SPEED}[a]"
fc = ';'.join(parts) + ';' + ''.join(labels) + f"concat=n={len(edl)}:v=1:a=1" + tail
open('build/fc.txt','w').write(fc)
ins = [a for i in keys for a in ('-i', srcs[i])]
# ponytail: -filter_complex_script 在 ffmpeg 7+ 标记弃用但仍可用；等 ffmpeg ≥7 成为下限再换 -/filter_complex
cmd = [FFMPEG, '-v', 'error', '-y', *ins, '-filter_complex_script', 'build/fc.txt',
       '-map', '[v]', '-map', '[a]', '-r', '30', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', 'build/master.mp4']
print(f"拼接 {len(edl)} 段…" + (f"（{SPEED} 倍速）" if SPEED != 1 else ""))
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode: sys.exit(r.stderr[:800])
print("  OK")
if LOUDNESS is not None:   # 用户反馈成片太小声（实测 -18 LUFS，得手动拉高）：两遍 loudnorm 对齐平台标准
    import os, shutil
    shutil.move('build/master.mp4', 'build/master_raw.mp4')
    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'loudnorm.py'),
                        'build/master_raw.mp4', 'build/master.mp4', str(LOUDNESS)], capture_output=True, text=True)
    print(r.stdout.rstrip())
    if r.returncode: sys.exit(r.stderr[-600:])
subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', 'build/master.mp4', '-vn', '-ar', '16000', '-ac', '1', 'build/master.wav'], check=True)
transcribe('build/master.wav', 'build/tm')
print("  母版转写 → build/tm.json")
