# -*- coding: utf-8 -*-
"""外部工具定位 + 环境体检。

脚本里：  from tools import FFMPEG, FFPROBE, duration, speech_spans, transcribe
体检：    python3 tools.py        （全 ✓ 才开工；✗ 项按提示安装）

定位顺序：环境变量优先，否则自动找。
  FFMPEG / FFPROBE   PATH 上第一个带 libx264 的 ffmpeg（Anaconda/conda 自带的没有 libx264，会被跳过）
  WHISPER_CLI        whisper.cpp 的 whisper-cli
  WHISPER_MODEL      ~/.cache/whisper/ggml-large-v3.bin 等（见 MODEL_DIRS）
  WHISPER_LANG       转写语言，默认 zh
"""
import glob, os, platform, re, shutil, subprocess, sys, zipfile

HOME = os.path.expanduser('~')
EXE = '.exe' if os.name == 'nt' else ''
MODEL_DIRS = [os.path.join(HOME, '.cache', 'whisper'),
              os.path.join(HOME, '.cache', 'hyperframes', 'whisper', 'models')]   # 后者是 HyperFrames 的缓存，装过可直接复用
MODEL_NAMES = ['ggml-large-v3.bin', 'ggml-large-v3-turbo.bin', 'ggml-medium.bin']
MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin'


def _has_x264(ff):
    try:
        return 'libx264' in subprocess.run([ff, '-hide_banner', '-encoders'],
                                           capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.TimeoutExpired):
        return False


def _candidates(name):
    dirs = os.environ.get('PATH', '').split(os.pathsep) + ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']
    out = []
    for d in dirs:
        p = os.path.join(d, name + EXE)
        if os.path.isfile(p) and p not in out:
            out.append(p)
    return out


def _find_ffmpeg():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    return next((p for p in _candidates('ffmpeg') if _has_x264(p)), None)


def _find_ffprobe(ff):
    if os.environ.get('FFPROBE'):
        return os.environ['FFPROBE']
    if ff and os.path.isfile(os.path.join(os.path.dirname(ff), 'ffprobe' + EXE)):
        return os.path.join(os.path.dirname(ff), 'ffprobe' + EXE)
    return shutil.which('ffprobe')


def _find_model():
    if os.environ.get('WHISPER_MODEL'):
        return os.path.expanduser(os.environ['WHISPER_MODEL'])
    for n in MODEL_NAMES:
        for d in MODEL_DIRS:
            if os.path.isfile(os.path.join(d, n)):
                return os.path.join(d, n)
    return None


FFMPEG = _find_ffmpeg()
FFPROBE = _find_ffprobe(FFMPEG)
WHISPER = os.environ.get('WHISPER_CLI') or shutil.which('whisper-cli') or shutil.which('whisper-cpp')
MODEL = _find_model()
LANG = os.environ.get('WHISPER_LANG', 'zh')

if __name__ != '__main__' and not (FFMPEG and FFPROBE):
    sys.exit('✗ 找不到带 libx264 的 ffmpeg / ffprobe。运行 python3 tools.py 看安装方法，或 export FFMPEG=/path/to/ffmpeg')


def duration(path):
    out = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout.strip()
    if not out:
        sys.exit(f'✗ 读不到时长：{path}')
    return float(out)


def speech_spans(wav):
    """静音谱（-27dB / 0.16s）反推语音区间 → ([[起, 止], ...], 全长)"""
    log = subprocess.run([FFMPEG, '-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-27dB:d=0.16', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    dur = duration(wav)
    spans, cur = [], 0.0
    for a, b in zip(st, en + ([dur] if len(en) < len(st) else [])):
        if a - cur > 0.05:
            spans.append([round(cur, 3), round(a, 3)])
        cur = b
    if dur - cur > 0.05:
        spans.append([round(cur, 3), round(dur, 3)])
    return spans, dur


def transcribe(wav, out_prefix):
    """whisper.cpp 段级转写 → <out_prefix>.json"""
    if not (WHISPER and MODEL and os.path.isfile(MODEL)):
        sys.exit('✗ whisper-cli 或模型缺失。运行 python3 tools.py 看安装方法')
    r = subprocess.run([WHISPER, '-m', MODEL, '-f', wav, '-l', LANG, '-np', '-oj', '-of', out_prefix],
                       capture_output=True, text=True)
    if r.returncode or not os.path.isfile(out_prefix + '.json'):
        sys.exit(f'✗ 转写失败 {wav}：\n{(r.stderr or r.stdout)[-800:]}')


def ensure_browser(remotion_dir='remotion'):
    """确保 Remotion 有浏览器可用。Node 26 上 Remotion 4.0.410 自带的解压（extract-zip）会静默中断，
    17 个文件只解出 2 个，渲染时报 No browser found——发现后用 Python 标准库补解。"""
    if os.environ.get('REMOTION_BROWSER_EXECUTABLE'):
        return
    subprocess.run([shutil.which('npx') or 'npx', 'remotion', 'browser', 'ensure'], cwd=remotion_dir)
    base = os.path.join(remotion_dir, 'node_modules', '.remotion', 'chrome-headless-shell')
    exe = os.path.join(base, '*', 'chrome-headless-shell-*', 'chrome-headless-shell*')
    if glob.glob(exe):
        return
    for z in glob.glob(os.path.join(base, 'chrome-headless-shell-*.zip')):
        plat = os.path.basename(z)[len('chrome-headless-shell-'):-len('.zip')]
        with zipfile.ZipFile(z) as zf:
            for info in zf.infolist():
                path = zf.extract(info, os.path.join(base, plat))
                if info.external_attr >> 16:
                    os.chmod(path, (info.external_attr >> 16) & 0o7777)
    if not glob.glob(exe):
        sys.exit('✗ Remotion 没有可用的浏览器：export REMOTION_BROWSER_EXECUTABLE=<本机 Chrome 路径> 后重试（见 README「国内网络」）')
    print('  ✓ 浏览器已补解（Remotion 自带解压在 Node 26 上会中断）')


if __name__ == '__main__':
    osn = platform.system()
    hints = {
        'ffmpeg': {'Darwin': 'brew install ffmpeg', 'Linux': 'sudo apt install ffmpeg',
                   'Windows': 'winget install Gyan.FFmpeg'},
        'whisper': {'Darwin': 'brew install whisper-cpp',
                    'Linux': '源码编译 https://github.com/ggml-org/whisper.cpp ，把 build/bin 加进 PATH',
                    'Windows': 'https://github.com/ggml-org/whisper.cpp/releases 下载 whisper-bin-x64.zip，解压目录加进 PATH'},
        'node': {'Darwin': 'brew install node', 'Linux': '装 Node.js ≥ 18（nvm 或 https://nodejs.org）',
                 'Windows': 'winget install OpenJS.NodeJS.LTS'},
    }
    hint = lambda k: hints[k].get(osn, hints[k]['Linux'])

    def row(ok, name, detail, fix=''):
        print(f"  {'✓' if ok else '✗'} {name:<13} {detail}" + ('' if ok or not fix else f'\n                  → {fix}'))
        return ok

    print(f'环境体检（{osn}）')
    ok = row(sys.version_info >= (3, 8), 'Python', sys.version.split()[0], '需要 Python ≥ 3.8')
    x264 = bool(FFMPEG) and _has_x264(FFMPEG)
    skipped = [p for p in _candidates('ffmpeg') if p != FFMPEG and not _has_x264(p)]
    ok &= row(x264, 'ffmpeg', (FFMPEG or '没找到') + ('' if x264 else '（需要带 libx264 的版本）') +
              (f'  〔已跳过没有 libx264 的 {", ".join(skipped)}〕' if skipped else ''), hint('ffmpeg'))
    ok &= row(bool(FFPROBE), 'ffprobe', FFPROBE or '没找到', hint('ffmpeg'))
    ok &= row(bool(WHISPER), 'whisper-cli', WHISPER or '没找到', hint('whisper'))
    size = f'{os.path.getsize(MODEL) / 1e9:.1f}GB' if MODEL and os.path.isfile(MODEL) else ''
    ok &= row(bool(size), 'whisper 模型', f'{MODEL}  {size}' if size else '没找到',
              f'mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-large-v3.bin {MODEL_URL}'
              '（国内把 huggingface.co 换成 hf-mirror.com）')
    try:
        nv = subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip()
    except OSError:
        nv = ''
    major = int(nv.lstrip('v').split('.')[0]) if nv else 0
    ok &= row(major >= 18 and bool(shutil.which('npx')), 'Node.js', nv or '没找到', hint('node'))
    if osn == 'Linux':
        fonts = subprocess.run(['fc-list', ':lang=zh', 'family'], capture_output=True, text=True).stdout.strip() \
            if shutil.which('fc-list') else ''
        ok &= row(bool(fonts), '中文字体', fonts.splitlines()[0] if fonts else '没找到',
                  'sudo apt install fonts-noto-cjk')
    else:
        row(True, '中文字体', '系统自带')
    print('✓ 环境就绪' if ok else '✗ 先把上面的 ✗ 装好，装完再跑一次体检')
    sys.exit(0 if ok else 1)
