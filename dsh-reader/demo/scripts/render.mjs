import path from 'node:path';
import fs from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.resolve(root, '..', 'docs', 'demos');
const previewDir = path.resolve(root, 'out', 'preview');

const BROWSER = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

/**
 * README reels: id -> output file.
 * Master: 1600x1080 / 30fps. GIF: 640x432 / 20fps / 64 colors, then a lossy
 * gifsicle pass when the tool is available. 20fps keeps camera moves from
 * strobing; the smaller artboard keeps the readme payload manageable.
 */
const REELS = [
  { id: 'SelectExplain', file: '01-select-explain.gif' },
  { id: 'AskAI', file: '02-read-and-ask.gif' },
  { id: 'GuideMindmap', file: '03-guide-mindmap.gif' },
];

const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const withGifOnly = process.argv.includes('--gif-only');
const hasGifsicle = spawnSync('gifsicle', ['--version'], { stdio: 'ignore' }).status === 0;

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
  const master = path.join(previewDir, `${reel.id}.mp4`);

  if (!withGifOnly) {
    console.log(`\nrendering ${reel.id} master -> ${path.relative(root, master)}`);
    const started = Date.now();
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: master,
      browserExecutable: BROWSER,
      imageFormat: 'jpeg',
      scale: 1,
      crf: 18,
      concurrency: 3,
      onProgress: ({ renderedFrames }) => {
        if (renderedFrames % 30 === 0) {
          process.stdout.write(`  frames ${renderedFrames}/${composition.durationInFrames}\n`);
        }
      },
    });
    console.log(`master done in ${Math.round((Date.now() - started) / 1000)}s`);
  }

  console.log(`encoding ${reel.file} (20fps, 640x432, 64 colors)`);
  const started = Date.now();
  const rawGif = path.join(previewDir, `${reel.id}.raw.gif`);
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-i',
      master,
      '-vf',
      'fps=20,scale=640:432:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none',
      '-loop',
      '0',
      rawGif,
    ],
    { stdio: 'inherit' },
  );

  if (hasGifsicle) {
    execFileSync('gifsicle', ['-O3', '--lossy=100', rawGif, '-o', outputLocation], { stdio: 'inherit' });
    await fs.rm(rawGif, { force: true });
  } else {
    await fs.rename(rawGif, outputLocation);
    console.log('gifsicle not found; kept the larger ffmpeg palette output');
  }

  const { size } = await fs.stat(outputLocation);
  console.log(`done in ${Math.round((Date.now() - started) / 1000)}s — ${(size / 1024 / 1024).toFixed(2)} MB`);
}

console.log('\nall reels rendered.');
