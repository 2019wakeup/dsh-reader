import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.resolve(root, '..', 'docs', 'demos');
const previewDir = path.resolve(root, 'out', 'preview');

const BROWSER = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** README reels: id -> output file. Every GIF is <= 10s at 15fps / 800x540. */
const REELS = [
  { id: 'SelectExplain', file: '01-select-explain.gif' },
  { id: 'AskAI', file: '02-read-and-ask.gif' },
  { id: 'GuideMindmap', file: '03-guide-mindmap.gif' },
];

const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const withMp4 = process.argv.includes('--mp4');

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

console.log('bundling…');
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src', 'index.ts'),
  onProgress: (percent) => {
    if (percent === 100) console.log('bundle ready');
  },
});

for (const reel of REELS) {
  if (only.length > 0 && !only.includes(reel.id)) continue;
  const composition = await selectComposition({ serveUrl, id: reel.id });
  const outputLocation = path.join(outDir, reel.file);
  console.log(`\nrendering ${reel.id} -> ${path.relative(root, outputLocation)}`);
  const started = Date.now();
  await renderMedia({
    composition,
    serveUrl,
    codec: 'gif',
    outputLocation,
    browserExecutable: BROWSER,
    imageFormat: 'png',
    scale: 0.5,
    everyNthFrame: 2,
    numberOfGifLoops: null,
    concurrency: 3,
    onProgress: ({ renderedFrames, encodedFrames, progress }) => {
      if (renderedFrames % 30 === 0) {
        process.stdout.write(
          `  frames ${renderedFrames}/${composition.durationInFrames} (${Math.round(progress * 100)}%)\n`,
        );
      }
    },
  });

  if (withMp4) {
    const mp4 = path.join(previewDir, reel.file.replace(/\.gif$/, '.mp4'));
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: mp4,
      browserExecutable: BROWSER,
      imageFormat: 'jpeg',
      scale: 0.5,
      everyNthFrame: 2,
      crf: 20,
      concurrency: 3,
    });
  }
  const { size } = await fs.stat(outputLocation);
  console.log(`done in ${Math.round((Date.now() - started) / 1000)}s — ${(size / 1024 / 1024).toFixed(2)} MB`);
}

console.log('\nall reels rendered.');
