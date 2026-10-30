// 批量出静帧（一个浏览器跑完）：node stills.mjs <bundle 目录> <输出目录> <缩放> <秒,秒,...>
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
const [, , bundle, out, scale, list] = process.argv;
const serveUrl = path.resolve(bundle);
fs.mkdirSync(out, {recursive: true});
const browser = await openBrowser('chrome');
const composition = await selectComposition({serveUrl, id: 'Shen', puppeteerInstance: browser});
for (const t of list.split(',').map(Number)) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps));
  const output = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
  await renderStill({composition, serveUrl, output, frame, scale: Number(scale), imageFormat: 'jpeg', jpegQuality: 82, puppeteerInstance: browser});
  process.stdout.write(`${t} `);
}
await browser.close({silent: true});
