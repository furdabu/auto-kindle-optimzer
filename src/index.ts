import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { recoverStaleJobs } from "./jobs.js";
import { app } from "./server.js";
import { startWorker, stopWorker } from "./worker.js";

const recovered = recoverStaleJobs();
if (recovered > 0) {
  console.log(`[startup] 中断していたジョブ ${recovered} 件を failed に設定しました`);
}

startWorker();

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`[server] http://0.0.0.0:${info.port} で待機中`);
});

function shutdown(signal: string): void {
  console.log(`[server] ${signal} を受信。シャットダウンします`);
  stopWorker();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
