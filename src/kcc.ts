import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

const FORMAT_EXTENSIONS: Record<string, string> = {
  EPUB: ".epub",
  MOBI: ".mobi",
  CBZ: ".cbz",
  KEPUB: ".kepub.epub",
  PDF: ".pdf",
};

function buildArgs(inputPath: string, outputDir: string, title: string): string[] {
  const args = ["-p", config.KCC_PROFILE, "-f", config.KCC_FORMAT, "-t", title];

  if (config.KCC_MANGA_STYLE) args.push("-m");
  if (config.KCC_UPSCALE) args.push("-u");
  if (config.KCC_FORCE_PNG) args.push("--forcepng");
  args.push("-r", String(config.KCC_SPLITTER));

  args.push("-o", outputDir, inputPath);
  return args;
}

/**
 * kcc-c2e を実行し PDF を Kindle 向けフォーマットに変換する。
 * 生成されたファイルの絶対パスを返す。
 */
export async function convert(
  inputPath: string,
  outputDir: string,
  title: string,
): Promise<string> {
  const args = buildArgs(inputPath, outputDir, title);

  await runKcc(args);

  const expectedExt = FORMAT_EXTENSIONS[config.KCC_FORMAT.toUpperCase()] ?? ".epub";
  const entries = await readdir(outputDir);
  const produced = entries.find((name) =>
    name.toLowerCase().endsWith(expectedExt.toLowerCase()),
  );

  if (!produced) {
    throw new Error(
      `変換は完了しましたが ${expectedExt} ファイルが ${outputDir} に見つかりませんでした（生成物: ${entries.join(", ") || "なし"}）`,
    );
  }

  return path.join(outputDir, produced);
}

function runKcc(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.KCC_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });

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
      reject(new Error(`KCC 変換がタイムアウトしました（${config.KCC_TIMEOUT_MS}ms）`));
    }, config.KCC_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `KCC の起動に失敗しました（${config.KCC_BIN}）: ${err.message}。バイナリがインストールされ PATH 上にあるか確認してください。`,
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const detail = (stderr || stdout).trim().slice(-2000);
        reject(new Error(`KCC が終了コード ${code} で失敗しました:\n${detail}`));
      }
    });
  });
}
