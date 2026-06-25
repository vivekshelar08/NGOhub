import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const port = process.env.PORT ?? "3000";
const host = "0.0.0.0";
const nextBin = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

console.log(`Starting Next.js on ${host}:${port} (NODE_ENV=${process.env.NODE_ENV})`);

const child = spawn(process.execPath, [nextBin, "start", "-H", host, "-p", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  console.error("Failed to spawn Next.js:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0) {
    console.error(`Next.js exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
  }
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
