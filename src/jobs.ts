import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { Job, JobStatus, NewJob } from "./types.js";

if (!existsSync(config.DATA_DIR)) {
  mkdirSync(config.DATA_DIR, { recursive: true });
}

const db = new Database(path.join(config.DATA_DIR, "jobs.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id                TEXT PRIMARY KEY,
    status            TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    title             TEXT NOT NULL,
    input_path        TEXT NOT NULL,
    output_path       TEXT,
    error             TEXT,
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
`);

interface JobRow {
  id: string;
  status: JobStatus;
  original_filename: string;
  title: string;
  input_path: string;
  output_path: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    status: row.status,
    originalFilename: row.original_filename,
    title: row.title,
    inputPath: row.input_path,
    outputPath: row.output_path,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const insertStmt = db.prepare(`
  INSERT INTO jobs (id, status, original_filename, title, input_path, created_at, updated_at)
  VALUES (@id, 'pending', @originalFilename, @title, @inputPath, @now, @now)
`);

const getStmt = db.prepare<[string]>(`SELECT * FROM jobs WHERE id = ?`);

const claimStmt = db.prepare(`
  UPDATE jobs SET status = 'converting', updated_at = @now
  WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1)
  RETURNING *
`);

const updateStatusStmt = db.prepare(`
  UPDATE jobs SET status = @status, updated_at = @now WHERE id = @id
`);

const setOutputStmt = db.prepare(`
  UPDATE jobs SET output_path = @outputPath, updated_at = @now WHERE id = @id
`);

const failStmt = db.prepare(`
  UPDATE jobs SET status = 'failed', error = @error, updated_at = @now WHERE id = @id
`);

export function createJob(job: NewJob): Job {
  const now = Date.now();
  insertStmt.run({ ...job, now });
  return getJob(job.id)!;
}

export function getJob(id: string): Job | undefined {
  const row = getStmt.get(id) as JobRow | undefined;
  return row ? toJob(row) : undefined;
}

/** 次の pending ジョブを converting に遷移させてアトミックに取得する。 */
export function claimNextJob(): Job | undefined {
  const row = claimStmt.get({ now: Date.now() }) as JobRow | undefined;
  return row ? toJob(row) : undefined;
}

export function setStatus(id: string, status: JobStatus): void {
  updateStatusStmt.run({ id, status, now: Date.now() });
}

export function setOutput(id: string, outputPath: string): void {
  setOutputStmt.run({ id, outputPath, now: Date.now() });
}

export function failJob(id: string, error: string): void {
  failStmt.run({ id, error, now: Date.now() });
}

/** 起動時に converting/sending のまま残った中断ジョブを failed に倒す。 */
export function recoverStaleJobs(): number {
  const result = db
    .prepare(
      `UPDATE jobs SET status = 'failed', error = 'サーバー再起動により中断されました', updated_at = @now
       WHERE status IN ('converting', 'sending')`,
    )
    .run({ now: Date.now() });
  return result.changes;
}
