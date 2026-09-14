import json, subprocess, sys
from tools import FFMPEG, transcribe
try:
    from edl_rules import HFLIP
except ImportError:
    HFLIP = True
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
fc = ';'.join(parts) + ';' + ''.join(labels) + f"concat=n={len(edl)}:v=1:a=1[v][a]"
open('build/fc.txt','w').write(fc)
ins = [a for i in keys for a in ('-i', srcs[i])]
# ponytail: -filter_complex_script 在 ffmpeg 7+ 标记弃用但仍可用；等 ffmpeg ≥7 成为下限再换 -/filter_complex
cmd = [FFMPEG, '-v', 'error', '-y', *ins, '-filter_complex_script', 'build/fc.txt',
       '-map', '[v]', '-map', '[a]', '-r', '30', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', 'build/master.mp4']
print(f"拼接 {len(edl)} 段…")
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode: sys.exit(r.stderr[:800])
print("  OK")
subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', 'build/master.mp4', '-vn', '-ar', '16000', '-ac', '1', 'build/master.wav'], check=True)
transcribe('build/master.wav', 'build/tm')
print("  母版转写 → build/tm.json")
