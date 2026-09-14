"""单帧乱帧扫描：整片逐帧平均亮度，找「突变后立刻回弹」的孤立帧（Chromium 瓦片合成缺陷 / 解码空帧）。
用法：python3 spike_scan.py <mp4>   退出码 1 = 有乱帧"""
import re, subprocess, sys
from tools import FFMPEG
V = sys.argv[1]
r = subprocess.run([FFMPEG, '-hide_banner', '-i', V, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'],
                   capture_output=True, text=True)
y = [float(x) for x in re.findall(r'YAVG=([\d.]+)', r.stdout + r.stderr)]
bad = [i for i in range(1, len(y)-1)
       if abs(y[i]-y[i-1]) > 22 and abs(y[i+1]-y[i]) > 22 and (y[i]-y[i-1])*(y[i+1]-y[i]) < 0]
print(f"  单帧乱帧: {len(bad)}" + (f"  @ {', '.join(f'{i/30:.2f}s' for i in bad[:10])}" if bad else ""))
sys.exit(1 if bad else 0)
