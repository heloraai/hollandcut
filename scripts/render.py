# -*- coding: utf-8 -*-
"""阶段 3：预检 → 打包 → 渲染 → 母版音轨换回 → QA → SRT → contact sheet → 交付到 ~/Downloads/<项目>_<版本>/
用法（项目目录里）：python3 render.py v1
环境变量：CONCURRENCY（默认 1，见 standards 第 9 条）、SCRATCH（渲染暂存目录，默认系统临时目录）"""
import json, os, re, shutil, subprocess, sys, tempfile, time
from tools import FFMPEG, FFPROBE

V = sys.argv[1] if len(sys.argv) > 1 else 'v1'
NAME = re.sub(r'^edit_', '', os.path.basename(os.getcwd()))
SP = os.environ.get('SCRATCH') or os.path.join(tempfile.gettempdir(), f'hollandcut_{NAME}')
NPX = shutil.which('npx') or 'npx'
os.makedirs(SP, exist_ok=True)
os.makedirs('out', exist_ok=True)


def run(args, **kw):
    r = subprocess.run(args, **kw)
    if r.returncode:
        sys.exit(f'✗ 失败（退出码 {r.returncode}）：{" ".join(map(str, args))[:200]}')
    return r


def ff(*a):
    return subprocess.run([FFMPEG, '-hide_banner', *a], capture_output=True, text=True)


run([sys.executable, 'preflight.py'])
bundle = os.path.join(SP, 'bundle')
shutil.rmtree(bundle, ignore_errors=True)
run([NPX, 'remotion', 'bundle', 'src/index.ts', f'--out-dir={bundle}'], cwd='remotion')
print('bundle ok')
raw, log = os.path.join(SP, f'{V}_render.mp4'), os.path.join(SP, f'render_{V}.log')
if os.path.exists(raw):
    os.remove(raw)
with open(log, 'w') as lf:
    r = subprocess.run([NPX, 'remotion', 'render', bundle, 'Shen', raw, f'--concurrency={os.environ.get("CONCURRENCY", "1")}',
                        '--offthreadvideo-cache-size-in-bytes=536870912'], cwd='remotion', stdout=lf, stderr=subprocess.STDOUT)
if r.returncode or not os.path.isfile(raw):
    sys.exit(f'✗ 渲染失败（没有产出 {raw}），日志：{log}')
if shutil.which('pgrep'):   # 渲染进程没退出会再起 ffmpeg 覆写产物
    while subprocess.run(['pgrep', '-f', 'remotion render'], capture_output=True).returncode == 0:
        time.sleep(3)
OUT = f'out/{NAME}_{V}.mp4'
run([FFMPEG, '-v', 'error', '-y', '-i', raw, '-i', 'build/master.mp4', '-map', '0:v', '-map', '1:a', '-c', 'copy', '-movflags', '+faststart', OUT])

print(f'=== QA {OUT} ===')
print('  ' + subprocess.run([FFPROBE, '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
                             'stream=width,height,nb_read_frames', '-of', 'csv=p=0', OUT], capture_output=True, text=True).stdout.strip())
err = ff('-v', 'error', '-i', OUT, '-f', 'null', '-').stderr.strip()
if err:
    sys.exit(f'  解码错误: {err[:300]}')
print('  解码: 无错误')
md5 = lambda f: ff('-v', 'error', '-i', f, '-map', '0:a', '-f', 'md5', '-').stdout
if md5(OUT) != md5('build/master.mp4'):
    sys.exit('  音轨 MD5 不一致！')
print('  音轨: 与母版逐字节一致')
for label, vf, key in [('黑帧', 'blackdetect=d=0.05:pic_th=0.98', 'black_start'),
                       ('白闪', 'negate,blackdetect=d=0.05:pic_th=0.98', 'black_start'),
                       ('真重复帧(n=0.0001)', 'freezedetect=n=0.0001:d=1.2', 'freeze_start')]:
    print(f'  {label}: {ff("-i", OUT, "-vf", vf, "-f", "null", "-").stderr.count(key)}')
if subprocess.run([sys.executable, 'spike_scan.py', OUT]).returncode:
    sys.exit('  有单帧乱帧：用 CONCURRENCY=1 重渲')

# contact sheet：每块板 / 大图 / 链 / 成对贴纸各抽一帧，5 列
s = json.load(open('remotion/public/spec.json'))
shots = sorted([g['end'] - 1.0 for g in s['groups']] + [x['start'] + 1.5 for x in s['shows']] +
               [c['end'] - 0.5 for c in s['chains']] + [p['end'] - 0.4 for p in s['pairs']])[:20]
paths = []
for i, t in enumerate(shots):
    p = os.path.join(SP, f'qc_{i:02d}.png')
    ff('-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', OUT, '-frames:v', '1', '-vf', 'scale=480:270', p)
    paths.append(p)
sheet = f'out/QC_{NAME}_{V}.png'
if paths:
    while len(paths) % 5:
        paths.append(paths[-1])
    rows = len(paths) // 5
    fc = ''.join(''.join(f'[{r * 5 + j}:v]' for j in range(5)) + f'hstack=5[r{r}];' for r in range(rows))
    fc = fc + ''.join(f'[r{r}]' for r in range(rows)) + f'vstack={rows}' if rows > 1 else fc[:-5]   # vstack 至少 2 路
    ff('-v', 'error', '-y', *[a for p in paths for a in ('-i', p)], '-filter_complex', fc, sheet)
    print('  contact sheet:', sheet)


def ts(t):
    return f'{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}'.replace('.', ',')


srt = OUT[:-4] + '.srt'
cues = json.load(open('build/cues.json'))
open(srt, 'w', encoding='utf-8').write('\n'.join(
    f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text'].replace('【', '').replace('】', '')}\n" for i, c in enumerate(cues, 1)))
D = os.path.join(os.path.expanduser('~'), 'Downloads', f'{NAME}_{V}')
os.makedirs(D, exist_ok=True)
for f in (OUT, srt, sheet):
    if os.path.exists(f):
        shutil.copy2(f, D)
print('交付:', D)
