/**
 * encoder.js
 * 影片編碼輸出
 * 主路徑：WebCodecs + mp4-muxer → MP4
 * 備用：MediaRecorder → WebM
 */

import { compositeFrame, OUTPUT_W, OUTPUT_H, FPS } from './renderer.js';

/**
 * encode({ sequence, bgFrames, workCanvas, onProgress })
 * sequence  : HTMLImageElement[]  用戶照片幀序列
 * bgFrames  : HTMLImageElement[]  場景背景幀
 * workCanvas: HTMLCanvasElement   離屏工作畫布
 * onProgress: (pct, label) => void
 * returns   : Blob (mp4 or webm)
 */
export async function encode({ sequence, bgFrames, workCanvas, onProgress }) {
  workCanvas.width  = OUTPUT_W;
  workCanvas.height = OUTPUT_H;

  if (typeof VideoEncoder !== 'undefined') {
    return _encodeWebCodecs({ sequence, bgFrames, workCanvas, onProgress });
  } else {
    return _encodeMediaRecorder({ sequence, bgFrames, workCanvas, onProgress });
  }
}

/* ── WebCodecs path ── */
async function _encodeWebCodecs({ sequence, bgFrames, workCanvas, onProgress }) {
  const { Muxer, ArrayBufferTarget } = await import(
    'https://cdn.jsdelivr.net/npm/mp4-muxer@4/build/mp4-muxer.mjs'
  );

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: 'avc', width: OUTPUT_W, height: OUTPUT_H },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error:  console.error,
  });

  encoder.configure({
    codec:     'avc1.4d0028',
    width:     OUTPUT_W,
    height:    OUTPUT_H,
    bitrate:   3_500_000,
    framerate: FPS,
  });

  const ctx           = workCanvas.getContext('2d');
  const frameDuration = 1_000_000 / FPS; // microseconds
  const total         = sequence.length;

  for (let i = 0; i < total; i++) {
    onProgress(Math.round((i / total) * 88), `合成第 ${i + 1} / ${total} 幀…`);

    compositeFrame(ctx, sequence[i], bgFrames, i, total);

    const bitmap = await createImageBitmap(workCanvas);
    const frame  = new VideoFrame(bitmap, {
      timestamp: i * frameDuration,
      duration:  frameDuration,
    });
    encoder.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();
    bitmap.close();

    if (i % 4 === 0) await _sleep(0); // yield UI
  }

  onProgress(92, '最終編碼中…');
  await encoder.flush();
  muxer.finalize();

  onProgress(100, '完成！');
  return new Blob([target.buffer], { type: 'video/mp4' });
}

/* ── MediaRecorder fallback ── */
async function _encodeMediaRecorder({ sequence, bgFrames, workCanvas, onProgress }) {
  const stream   = workCanvas.captureStream(FPS);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 3_500_000,
  });

  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.start();

  const ctx      = workCanvas.getContext('2d');
  const frameMs  = 1000 / FPS;
  const total    = sequence.length;

  for (let i = 0; i < total; i++) {
    onProgress(Math.round((i / total) * 90), `錄製第 ${i + 1} 幀…`);
    compositeFrame(ctx, sequence[i], bgFrames, i, total);
    await _sleep(frameMs);
  }

  recorder.stop();
  await new Promise(r => (recorder.onstop = r));

  onProgress(100, '完成！');
  return new Blob(chunks, { type: mimeType });
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
