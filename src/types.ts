export type JobStatus =
  | "pending"
  | "converting"
  | "sending"
  | "completed"
  | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  originalFilename: string;
  title: string;
  inputPath: string;
  outputPath: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export type NewJob = Pick<Job, "id" | "originalFilename" | "title" | "inputPath">;
