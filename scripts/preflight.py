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
c = spec['cues'][-1]['end']; good = c <= m + 0.5; ok &= good
print(f"  {'✓' if good else '✗'} 末条字幕收在 {c:.2f}s")
g = spec['groups'][-1]['fout'][1]; good = g <= m; ok &= good
print(f"  {'✓' if good else '✗'} 末组溶解收在 {g:.2f}s")
if not os.path.isdir('remotion/node_modules'):
    print("  ✗ remotion/node_modules 不存在：先 cd remotion && npm install"); ok = False
else:
    ensure_browser()
sys.exit(0 if ok else 1)
