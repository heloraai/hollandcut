"""人物层：全屏人物 / 圆窗 / 音轨 / 磨砂玻璃底。母版每改一次都要重做（preflight 会查时长）。"""
import subprocess, sys
from tools import FFMPEG
M, P = 'build/master.mp4', 'remotion/public'
X264 = ['-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p']
JOBS = [
    ['-i', M, '-vf', 'scale=1920:1080:flags=lanczos', *X264, '-crf', '18', f'{P}/main_v.mp4'],
    ['-i', M, '-vf', 'scale=760:-2:flags=lanczos', *X264, '-crf', '20', f'{P}/pip.mp4'],
    ['-i', M, '-c', 'copy', f'{P}/main.mp4'],
    # 图形段磨砂玻璃底：缩到 160px → 高斯糊 → 放大 → 压暗去饱和 → 胶片颗粒（CSS blur 太慢，必须预渲染）
    ['-i', f'{P}/main_v.mp4', '-vf', 'scale=160:90,gblur=sigma=16,scale=1920:1080:flags=bicubic,'
     'eq=brightness=-0.30:saturation=0.40:contrast=0.82,noise=alls=18:allf=t+u', *X264, '-crf', '22', '-preset', 'veryfast', f'{P}/bg.mp4'],
]
for job in JOBS:
    if subprocess.run([FFMPEG, '-v', 'error', '-y', *job]).returncode:
        sys.exit(f'✗ {job[-1]} 生成失败')
    print('  ✓', job[-1])
