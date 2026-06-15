import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { getProfileResolution } from "./kcc-profiles.js";

/**
 * PDF の全ページを PNG 画像にラスタライズする。
 * KCC の直接変換が失敗した場合のフォールバック入力として使う。
 */
export async function rasterizePdf(inputPath: string, outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const outputPrefix = path.join(outputDir, "page");
  const args = buildRasterArgs(inputPath, outputPrefix);

  console.log(`[rasterize] ${config.PDF_RASTER_BIN} ${args.join(" ")}`);
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

function buildRasterArgs(inputPath: string, outputPrefix: string): string[] {
  const args = ["-png"];

  if (config.PDF_RASTER_MODE === "scale") {
    const resolution = getProfileResolution(config.KCC_PROFILE);
    if (resolution) {
      const [, profileHeight] = resolution;
      const multiplier = config.PDF_RASTER_SCALE_MULTIPLIER;
      // KCC の MuPDF レンダリングと同様、高さ基準でスケールする（-scale-to-x/-scale-to-y 併用は回転 PDF で縦横が入れ替わる）
      const scaleToY = Math.round(profileHeight * multiplier);
      args.push("-scale-to-y", String(scaleToY), "-scale-to-x", "-1");
      console.log(
        `[rasterize] プロファイル ${config.KCC_PROFILE} に合わせて高さ ${scaleToY}px（幅はアスペクト比維持）でレンダリング`,
      );
    } else {
      args.push("-r", String(config.PDF_RASTER_DPI));
      console.warn(
        `[rasterize] プロファイル ${config.KCC_PROFILE} の解像度が不明なため DPI ${config.PDF_RASTER_DPI} でレンダリング`,
      );
    }
  } else {
    args.push("-r", String(config.PDF_RASTER_DPI));
    console.log(`[rasterize] DPI ${config.PDF_RASTER_DPI} でレンダリング`);
  }

  args.push(inputPath, outputPrefix);
  return args;
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
