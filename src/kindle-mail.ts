import { stat } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { config } from "./config.js";

const ATTACHMENT_LIMIT_BYTES = 50 * 1024 * 1024;

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
});

/**
 * 変換済みファイルを Send to Kindle メールアドレスへ添付送信する。
 * Amazon 仕様により添付合計は 50MB 以下である必要がある。
 */
export async function sendToKindle(filePath: string, title: string): Promise<void> {
  const { size } = await stat(filePath);
  if (size > ATTACHMENT_LIMIT_BYTES) {
    const mb = (size / 1024 / 1024).toFixed(1);
    throw new Error(
      `添付ファイルが Send to Kindle の上限 50MB を超えています（${mb}MB）。KCC_TARGETSIZE 等で出力サイズを抑えてください。`,
    );
  }

  await transporter.sendMail({
    from: config.SMTP_FROM,
    to: config.KINDLE_EMAIL,
    subject: title,
    text: `${title} を Kindle に配信します。`,
    attachments: [{ filename: path.basename(filePath), path: filePath }],
  });
}
