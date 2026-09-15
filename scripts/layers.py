"""人物层：全屏人物 / 圆窗 / 音轨 / 磨砂玻璃底 / 开场剪辑器缩略图。母版每改一次都要重做（preflight 会查时长）。"""
import os, subprocess, sys
from tools import FFMPEG, duration
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

# max 档开场剪辑器的时间轴缩略图：母版均匀抽 8 帧（其他档用不到，只要几秒，照做）
os.makedirs(f'{P}/thumbs', exist_ok=True)
d = duration(M)
for i in range(8):
    if subprocess.run([FFMPEG, '-v', 'error', '-y', '-ss', f'{d * (i + 0.5) / 8:.2f}', '-i', M,
                       '-frames:v', '1', '-vf', 'scale=172:97', f'{P}/thumbs/t{i}.jpg']).returncode:
        sys.exit(f'✗ {P}/thumbs/t{i}.jpg 生成失败')
print('  ✓', f'{P}/thumbs/t0-7.jpg')
