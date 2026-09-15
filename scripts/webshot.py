"""网页截图：缺图清单里「官网 / GitHub / 公开产品页」这类图，agent 可以自己截，不用找用户要。
用法（项目目录里）：python3 webshot.py <网址> <输出.png> [宽 高]
默认视口 1440×810（16:9），2 倍像素输出；等页面脚本跑完再截（虚拟时间 12 秒）。
需要登录的页面、App 内页、私人数据看板截不到——这些照旧写进缺图清单找用户要。
浏览器依次用：REMOTION_BROWSER_EXECUTABLE → Remotion 下载的 chrome-headless-shell → 本机 Chrome / Chromium。"""
import glob, os, shutil, subprocess, sys

if len(sys.argv) < 3:
    sys.exit(__doc__)
url, out = sys.argv[1], os.path.abspath(sys.argv[2])
w, h = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else ('1440', '810')


def browser():
    if os.environ.get('REMOTION_BROWSER_EXECUTABLE'):
        return os.environ['REMOTION_BROWSER_EXECUTABLE']
    if os.path.isdir('remotion/node_modules'):
        from tools import ensure_browser
        ensure_browser()
        hit = sorted(glob.glob('remotion/node_modules/.remotion/chrome-headless-shell/*/chrome-headless-shell-*/chrome-headless-shell*'))
        if hit:
            return hit[0]
    for c in ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              shutil.which('google-chrome'), shutil.which('chromium'), shutil.which('chromium-browser')):
        if c and os.path.exists(c):
            return c
    sys.exit('✗ 找不到浏览器：先 cd remotion && npm install，或 export REMOTION_BROWSER_EXECUTABLE=<Chrome 路径>')


os.makedirs(os.path.dirname(out), exist_ok=True)
r = subprocess.run([browser(), '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    f'--window-size={w},{h}', '--virtual-time-budget=12000', f'--screenshot={out}', url],
                   capture_output=True, text=True, timeout=120)
if r.returncode or not os.path.isfile(out):
    sys.exit(f'✗ 截图失败（{url}）：{r.stderr.strip()[-300:]}')
print('  ✓', out)
