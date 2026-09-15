# -*- coding: utf-8 -*-
"""冒烟测试：合成一段 ~18 秒英文口播 → 走完整条流水线 → lite / pro / max 三档各出一片。能出片 = 环境 OK。
用法：python3 tests/smoke.py [工作目录]        只测某几档：SMOKE_TIERS=max python3 tests/smoke.py
需要：tools.py 体检全 ✓，外加 espeak-ng（Linux：sudo apt install espeak-ng）或 macOS 自带的 say。
英文合成语音只为跑通流程；中文转写质量要用 large-v3 + 实拍素材验证。
锚点只用 base.en 稳定听写、且不是别的词子串的小写词（three 会被写成 3；day 会先命中 Today）。"""
import os, shutil, subprocess, sys, tempfile

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(SKILL, 'scripts'))
from tools import FFMPEG  # noqa: E402

LINES = ["Today I will show you three simple ideas.", "First, build the product only once.",
         "Second, publish content every single day.", "Third, check the numbers every week.",
         "That is the whole system. See you next time."]
STRUCTURES = {
    'lite': '''
TIER = "lite"
CH = [("Today", "ideas", "三个想法"), ("product", "system", "冒烟测试")]
CHIPS = [{"end": AE("numbers") + 0.8, "items": [
    chip("产品只做一次", "product"), chip("内容每天都发", "content", "gold"), chip("每周看一次数据", "numbers")]}]
CHAINS, PAIRS, MARKS = [], [], []
SHOWS = [stat(3, "三个想法", "simple", "ideas")]
''',
    'pro': '''
TIER = "pro"
g(1, "三个简单的想法", "bl", "simple", "system", [
    N("r", "三个简单的想法", None, kind="hero"),
    N("a", "产品只做一次", "product", "r"),
    N("b", "内容每天都发", "content", "r"),
    N("c", "每周看一次数据", "numbers", "r", concl=True),
])
CH = [("Today", "system", "冒烟测试")]
CHIPS, CHAINS, PAIRS, MARKS, SHOWS = [], [], [], [], []
''',
    'max': '''
TIER = "max"
OPENING = hook_editor("HollandCut · smoke", ui="Today", badge=("AI 剪辑 100%", "show"),
                      steps=[("粗剪", "simple"), ("字幕", "ideas")], boom="build")
TITLES = [title("HollandCut", "publish", "single", gold_from=7, stamp=("今天开源", "content"),
                pills=[("Codex ✓", "every"), ("Claude Code ✓", "single")])]
ENDCARD = endcard("Holland", "冒烟测试", "github.com/heloraai/hollandcut", "whole", "time")
CH = [("Today", "ideas", "开场"), ("publish", "time", "冒烟测试")]
CHIPS = [{"end": AE("week") + 0.5, "items": [chip("每周看一次数据", "numbers", "gold")]}]
CHAINS, PAIRS, MARKS = [], [], []
SHOWS = [show_img("shot.png", 1000, 16/9, "测试截图", "check", "week"),
         stat(5, "测试额度", "whole", "system", suffix="%", gauge=True)]
''',
}
TIERS = [t for t in os.environ.get('SMOKE_TIERS', 'lite,pro,max').split(',') if t]
assert all(t in STRUCTURES for t in TIERS), f'SMOKE_TIERS 只能是 lite / pro / max：{TIERS}'


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
os.environ.setdefault('DELIVER', os.path.join(W, 'deliver'))   # 测试片不往 ~/Downloads 里丢
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
for step in ('detect.py', 'build_edl.py', 'build_recut.py', 'build_cues.py', 'layers.py'):
    run([sys.executable, step], cwd=P)
if not os.path.exists(os.path.join(P, 'remotion', 'node_modules')):
    run([shutil.which('npm') or 'npm', 'install', '--no-audit', '--no-fund'], cwd=os.path.join(P, 'remotion'))
run([FFMPEG, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1600x900', '-frames:v', '1',
     os.path.join(P, 'remotion', 'public', 'shot.png')])   # max 档大图用
for tier in TIERS:
    open(os.path.join(P, 'structure.py'), 'w', encoding='utf-8').write(STRUCTURES[tier])
    run([sys.executable, 'gen_spec.py', 'structure.py'], cwd=P)
    run([sys.executable, 'render.py', tier], cwd=P)   # render.py 自带 preflight + QA，任一项不过即非零退出
    out = os.path.join(P, 'out', f'smoke_{tier}.mp4')
    assert os.path.getsize(out) > 100_000, out
print('✓ 冒烟测试通过（' + ' / '.join(TIERS) + '）：', os.path.join(P, 'out'))
