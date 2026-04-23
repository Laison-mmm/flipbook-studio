import { compositeFrame, OUTPUT_W, OUTPUT_H, INTERNAL_FPS } from './renderer.js';

export async function encode({ sequence, bgFrames, workCanvas, onProgress }) {
  workCanvas.width = OUTPUT_W;
  workCanvas.height = OUTPUT_H;

  const mimeType = [
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

  onProgress(2, '初始化錄製器…');

  const stream = workCanvas.captureStream(INTERNAL_FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start();

  const ctx = workCanvas.getContext('2d');
  const frameMs = 1000 / INTERNAL_FPS;
  const total = sequence.length;

  for (let i = 0; i < total; i++) {
    onProgress(Math.round(5 + (i / total) * 90), `合成第 ${i + 1} / ${total} 幀…`);
    compositeFrame(ctx, sequence[i], bgFrames);
    await _sleep(frameMs);
  }

  onProgress(96, '封裝影片…');
  recorder.stop();
  await new Promise(r => (recorder.onstop = r));
  onProgress(100, '完成！');

  const ext = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
  return new Blob(chunks, { type: ext });
}

const _sleep = ms => new Promise(r => setTimeout(r, ms));
