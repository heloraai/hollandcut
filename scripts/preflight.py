"""渲染前预检：人物层必须和母版同一版剪辑，否则画面会和声音错位；顺带确保 Remotion 有浏览器可用。"""
import json, os, sys
from tools import duration as d, ensure_browser
m = d('build/master.mp4'); ok = True
for f in ['remotion/public/main_v.mp4', 'remotion/public/pip.mp4', 'remotion/public/main.mp4', 'remotion/public/bg.mp4']:
    x = d(f); good = abs(x - m) < 0.1
    ok &= good
    print(f"  {'✓' if good else '✗'} {f.split('/')[-1]:<12} {x:8.3f}s  (母版 {m:.3f}s)")
spec = json.load(open('remotion/public/spec.json'))
good = abs(spec['duration'] - m) < 0.1; ok &= good
print(f"  {'✓' if good else '✗'} spec.duration {spec['duration']:8.3f}s")
c = spec['cues'][-1]['end'] if spec['cues'] else 0.0; good = c <= m + 0.5; ok &= good
print(f"  {'✓' if good else '✗'} 末条字幕收在 {c:.2f}s")
ends = [b['fout'][1] for b in spec.get('blocks') or []]   # 板 + 大图合并后的隐人区块；lite 没有
if ends:
    g = max(ends); good = g <= m; ok &= good
    print(f"  {'✓' if good else '✗'} 末个隐人区块溶解收在 {g:.2f}s")
else:
    print("  ✓ 没有隐人区块（人物全程全屏）")
if spec.get('opening'):   # max 开场剪辑器的时间轴缩略图；缺了 <Img> 会 404 卡到渲染超时
    good = all(os.path.exists(f'remotion/public/thumbs/t{i}.jpg') for i in range(8)); ok &= good
    print(f"  {'✓' if good else '✗'} 开场剪辑器缩略图" + ("" if good else "：缺 remotion/public/thumbs/，重跑 python3 layers.py"))
if not os.path.isdir('remotion/node_modules'):
    print("  ✗ remotion/node_modules 不存在：先 cd remotion && npm install"); ok = False
else:
    ensure_browser()
sys.exit(0 if ok else 1)
