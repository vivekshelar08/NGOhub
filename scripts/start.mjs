import { spawn } from "node:child_process";

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const port = process.env.PORT ?? "3000";
const host = "0.0.0.0";

console.log(`Starting Next.js on ${host}:${port} (NODE_ENV=${process.env.NODE_ENV})`);

const child = spawn("npx", ["next", "start", "-H", host, "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  console.error(`Next.js exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
