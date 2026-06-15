import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

/**
 * PDF の全ページを PNG 画像にラスタライズする。
 * KCC の直接変換が失敗した場合のフォールバック入力として使う。
 */
export async function rasterizePdf(inputPath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const outputPrefix = path.join(outputDir, "page");
  const args = [
    "-png",
    "-r",
    String(config.PDF_RASTER_DPI),
    inputPath,
    outputPrefix,
  ];

  await runCommand(config.PDF_RASTER_BIN, args, config.KCC_TIMEOUT_MS, "PDF ラスタライズ");

  const entries = await readdir(outputDir);
  const images = entries.filter((name) => /\.png$/i.test(name));
  if (images.length === 0) {
    throw new Error(
      `PDF の画像化は完了しましたが PNG が ${outputDir} に見つかりませんでした`,
    );
  }

  console.log(`[rasterize] ${images.length} ページを生成しました`);
}

function runCommand(
  bin: string,
  args: string[],
  timeoutMs: number,
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${label}がタイムアウトしました（${timeoutMs}ms）`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `${label}の起動に失敗しました（${bin}）: ${err.message}。バイナリがインストールされ PATH 上にあるか確認してください。`,
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const detail = (stderr || stdout).trim().slice(-2000);
        reject(new Error(`${label}が終了コード ${code} で失敗しました:\n${detail}`));
      }
    });
  });
}
