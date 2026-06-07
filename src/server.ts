import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import type { Context } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { config } from "./config.js";
import { createJob, getJob } from "./jobs.js";

const MAX_UPLOAD_BYTES = config.MAX_UPLOAD_MB * 1024 * 1024;

export const app = new Hono();

app.onError((err, c) => {
  console.error("[server] 未処理エラー:", err);
  return c.json({ error: "内部エラーが発生しました" }, 500);
});

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    kccBin: config.KCC_BIN,
    profile: config.KCC_PROFILE,
    format: config.KCC_FORMAT,
  });
});

const api = new Hono();
api.use("*", bearerAuth({ token: config.API_TOKEN }));

interface Upload {
  filename: string;
  bytes: Buffer;
  mimeType: string;
}

api.post("/jobs", async (c) => {
  const contentType = (c.req.header("content-type") ?? "").toLowerCase();

  let upload: Upload | { error: string; status: 400 | 413 | 415 };
  if (contentType.includes("multipart/form-data")) {
    upload = await readMultipart(c);
  } else {
    upload = await readRawBody(c);
  }

  if ("error" in upload) {
    return c.json({ error: upload.error }, upload.status);
  }

  if (!isPdf(upload.filename, upload.mimeType)) {
    return c.json({ error: "PDF ファイルのみ対応しています" }, 415);
  }

  const id = randomUUID();
  const jobDir = path.join(config.TMP_DIR, id);
  await mkdir(jobDir, { recursive: true });

  const inputPath = path.join(jobDir, "input.pdf");
  await writeFile(inputPath, upload.bytes);

  const title = sanitizeTitle(upload.filename);
  const job = createJob({ id, originalFilename: upload.filename, title, inputPath });

  return c.json({ jobId: job.id, status: job.status, title: job.title }, 202);
});

async function readMultipart(
  c: Context,
): Promise<Upload | { error: string; status: 400 | 413 }> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch (err) {
    console.error("[server] フォーム解析に失敗:", err);
    return {
      error:
        "リクエストボディを multipart/form-data として解析できませんでした。フィールド名 'file' にファイルを設定しているか確認してください。",
      status: 400,
    };
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { error: "multipart フォームの 'file' フィールドが必要です", status: 400 };
  }
  if (file.size === 0) {
    return { error: "空のファイルです", status: 400 };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `ファイルサイズが上限 ${config.MAX_UPLOAD_MB}MB を超えています`,
      status: 413,
    };
  }

  return {
    filename: file.name || "document.pdf",
    bytes: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
  };
}

async function readRawBody(
  c: Context,
): Promise<Upload | { error: string; status: 400 | 413 }> {
  const bytes = Buffer.from(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { error: "空のボディです", status: 400 };
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return {
      error: `ファイルサイズが上限 ${config.MAX_UPLOAD_MB}MB を超えています`,
      status: 413,
    };
  }

  const headerName =
    c.req.header("x-filename") ??
    filenameFromContentDisposition(c.req.header("content-disposition")) ??
    "document.pdf";

  return {
    filename: headerName,
    bytes,
    mimeType: c.req.header("content-type") ?? "",
  };
}

function filenameFromContentDisposition(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(value);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

api.get("/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) {
    return c.json({ error: "ジョブが見つかりません" }, 404);
  }
  return c.json({
    jobId: job.id,
    status: job.status,
    title: job.title,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

app.route("/api", api);

if (!existsSync(config.TMP_DIR)) {
  await mkdir(config.TMP_DIR, { recursive: true });
}

function isPdf(filename: string, mimeType: string): boolean {
  return (
    filename.toLowerCase().endsWith(".pdf") ||
    mimeType === "application/pdf"
  );
}

function sanitizeTitle(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base.trim() || "Untitled";
}
