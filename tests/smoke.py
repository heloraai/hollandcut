# -*- coding: utf-8 -*-
"""冒烟测试：合成一段 ~20 秒英文口播 → 走完整条流水线 → 出片。装完依赖跑一次，能出片 = 环境 OK。
用法：python3 tests/smoke.py [工作目录]
需要：tools.py 体检全 ✓，外加 espeak-ng（Linux：sudo apt install espeak-ng）或 macOS 自带的 say。
英文合成语音只为跑通流程；中文转写质量要用 large-v3 + 实拍素材验证。"""
import os, shutil, subprocess, sys, tempfile

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(SKILL, 'scripts'))
from tools import FFMPEG  # noqa: E402

LINES = ["Today I will show you three simple ideas.", "First, build the product only once.",
         "Second, publish content every single day.", "Third, check the numbers every week.",
         "That is the whole system. See you next time."]
STRUCTURE = '''
g(1, "三个简单的想法", "bl", "simple", "system", [
    N("r", "三个简单的想法", None, kind="hero"),
    N("a", "产品只做一次", "product", "r"),
    N("b", "内容每天都发", "content", "r"),
    N("c", "每周看一次数据", "numbers", "r", concl=True),
])
CH = [("Today", "system", "冒烟测试")]
CHIPS, CHAINS, PAIRS, MARKS, SHOWS = [], [], [], [], []
'''


def run(cmd, cwd=None):
    print('$', ' '.join(map(str, cmd))[:140], flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def speak(text, stem):
    if shutil.which('espeak-ng'):
        run(['espeak-ng', '-v', 'en-us', '-s', '150', '-w', stem + '.wav', text])
        return stem + '.wav'
    if shutil.which('say'):
        if subprocess.run(['say', '-v', 'Samantha', '-o', stem + '.aiff', text]).returncode:
            run(['say', '-o', stem + '.aiff', text])
        return stem + '.aiff'
    sys.exit('需要 espeak-ng（Linux：sudo apt install espeak-ng）或 macOS 自带的 say')


W = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='hollandcut_smoke_'))
os.makedirs(W, exist_ok=True)
os.environ['WHISPER_LANG'] = 'en'
parts = []
for i, line in enumerate(LINES):
    wav = os.path.join(W, f'n{i}.wav')
    run([FFMPEG, '-v', 'error', '-y', '-i', speak(line, os.path.join(W, f's{i}')),
         '-af', 'apad=pad_dur=0.6', '-ar', '22050', '-ac', '1', wav])
    parts.append(wav)
lst, speech, clip = (os.path.join(W, f) for f in ('list.txt', 'speech.wav', 'clip.mp4'))
open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
run([FFMPEG, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, speech])
run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30', '-i', speech,
     '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clip])

P = os.path.join(W, 'edit_smoke')
run([sys.executable, os.path.join(SKILL, 'scripts', 'plan.py'), '--name', 'smoke', '--src', clip, '--out', P])
open(os.path.join(P, 'structure.py'), 'w', encoding='utf-8').write(STRUCTURE)
for step in ('detect.py', 'build_edl.py', 'build_recut.py', 'build_cues.py', 'layers.py'):
    run([sys.executable, step], cwd=P)
if not os.path.exists(os.path.join(P, 'remotion', 'node_modules')):
    run([shutil.which('npm') or 'npm', 'install', '--no-audit', '--no-fund'], cwd=os.path.join(P, 'remotion'))
run([sys.executable, 'gen_spec.py', 'structure.py'], cwd=P)
run([sys.executable, 'render.py', 'smoke'], cwd=P)   # render.py 自带 preflight + QA，任一项不过即非零退出
out = os.path.join(P, 'out', 'smoke_smoke.mp4')
assert os.path.getsize(out) > 100_000, out
print('✓ 冒烟测试通过：', out)
