# -*- coding: utf-8 -*-
"""响度标准化：两遍 loudnorm（先测量再线性校正），音频对齐抖音 / TikTok 的 -14 LUFS、真峰 -1 dBTP，视频流原样拷贝。
用法：python3 loudnorm.py <输入.mp4> <输出.mp4> [目标 LUFS，默认 -14]
用户反馈：之前成片音量太低（实测 -18 LUFS），得手动拉高很多。"""
import json, re, subprocess, sys
from tools import FFMPEG

src, dst = sys.argv[1], sys.argv[2]
I = float(sys.argv[3]) if len(sys.argv) > 3 else -14.0
TP, LRA = -1.0, 11.0

def measure(path, extra=''):
    r = subprocess.run([FFMPEG, '-hide_banner', '-i', path, '-af', f'loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json{extra}', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
    if not m: sys.exit('✗ loudnorm 测量失败：' + r.stderr[-400:])
    return json.loads(m.group(0))

a = measure(src)
print(f"  原始：{float(a['input_i']):.1f} LUFS  真峰 {float(a['input_tp']):.1f} dBTP  LRA {float(a['input_lra']):.1f}")
# 采样率跟源走、音频按视频时长截齐：换采样率会改 AAC 帧网格，母版会凭空多出一百多毫秒，预检 / 音画同步全乱
from tools import FFPROBE
probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate:format=duration', '-of', 'csv=p=0', src],
                       capture_output=True, text=True).stdout.split()
sr = next((x for x in probe if x.isdigit()), '44100')
dur = next((x for x in probe if '.' in x), None)
af = (f"loudnorm=I={I}:TP={TP}:LRA={LRA}:measured_I={a['input_i']}:measured_TP={a['input_tp']}:"
      f"measured_LRA={a['input_lra']}:measured_thresh={a['input_thresh']}:offset={a['target_offset']}:linear=true:print_format=summary")
cmd = [FFMPEG, '-v', 'error', '-y', '-i', src, '-map', '0:v', '-map', '0:a', '-c:v', 'copy',
       '-af', af + f',aresample={sr}', '-ar', sr, '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart']
if dur: cmd += ['-t', dur]
r = subprocess.run(cmd + [dst], capture_output=True, text=True)
if r.returncode: sys.exit('✗ 校正失败：' + r.stderr[-400:])
b = measure(dst)
d2 = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout.strip()
print(f"  校正后：{float(b['input_i']):.1f} LUFS  真峰 {float(b['input_tp']):.1f} dBTP  时长 {dur} → {d2}  → {dst}")
if dur and abs(float(d2) - float(dur)) > 0.02: sys.exit(f"✗ 校正后时长偏了 {float(d2)-float(dur):+.3f}s，不能用")
if abs(float(b['input_i']) - I) > 1.0: print(f"  ⚠ 离目标 {I} LUFS 超过 1 dB，检查素材是否有极端峰值")
