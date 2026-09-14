import json
from tools import speech_spans
for i in json.load(open('sources.json', encoding='utf-8')):
    spans, dur = speech_spans(f'build/a{i}.wav')
    json.dump(spans, open(f'build/spans{i}.json', 'w'))
    tot = sum(b-a for a,b in spans)
    print(f"  clip{i}: {len(spans):3d} 段语音, 有声 {tot:6.1f}s / 全长 {dur:6.1f}s, 静音占 {(dur-tot)/dur*100:4.1f}%")
