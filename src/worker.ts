import { rm } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { claimNextJob, failJob, setOutput, setStatus } from "./jobs.js";
import { convert } from "./kcc.js";
import { sendToKindle } from "./kindle-mail.js";
import type { Job } from "./types.js";

const POLL_INTERVAL_MS = 2000;

let running = false;
let stopped = false;

async function processJob(job: Job): Promise<void> {
  const outputDir = path.join(config.TMP_DIR, job.id, "out");

  try {
    console.log(`[worker] ジョブ ${job.id} を変換中: ${job.originalFilename}`);
    const outputPath = await convert(job.inputPath, outputDir, job.title);
    setOutput(job.id, outputPath);

    console.log(`[worker] ジョブ ${job.id} を Kindle へ配信中`);
    setStatus(job.id, "sending");
    await sendToKindle(outputPath, job.title);

    setStatus(job.id, "completed");
    console.log(`[worker] ジョブ ${job.id} 完了`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failJob(job.id, message);
    console.error(`[worker] ジョブ ${job.id} 失敗: ${message}`);
  } finally {
    await rm(path.join(config.TMP_DIR, job.id), { recursive: true, force: true }).catch(
      () => {},
    );
  }
}

async function loop(): Promise<void> {
  while (!stopped) {
    const job = claimNextJob();
    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    await processJob(job);
  }
}

export function startWorker(): void {
  if (running) return;
  running = true;
  loop().catch((err) => {
    console.error("[worker] ループが致命的エラーで停止しました:", err);
    running = false;
  });
  console.log("[worker] 起動しました");
}

export function stopWorker(): void {
  stopped = true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
