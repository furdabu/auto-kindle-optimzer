import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3847),
  API_TOKEN: z.string().min(1, "API_TOKEN は必須です"),

  DATA_DIR: z.string().default("./data"),
  TMP_DIR: z.string().default("./tmp"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(100),

  KCC_BIN: z.string().default("kcc-c2e"),
  KCC_PROFILE: z.string().default("KPW6"),
  KCC_FORMAT: z.string().default("EPUB"),
  KCC_MANGA_STYLE: boolFromEnv.default(true),
  KCC_SPLITTER: z.coerce.number().int().min(0).max(2).default(1),
  KCC_UPSCALE: boolFromEnv.default(true),
  KCC_FORCE_PNG: boolFromEnv.default(true),
  KCC_TIMEOUT_MS: z.coerce.number().int().positive().default(20 * 60 * 1000),

  KINDLE_EMAIL: z.email("KINDLE_EMAIL は有効なメールアドレスである必要があります"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: boolFromEnv.default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.email("SMTP_FROM は有効なメールアドレスである必要があります"),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`環境変数の検証に失敗しました:\n${issues}`);
  }
  return parsed.data;
}

export const config = loadConfig();
