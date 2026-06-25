import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const host = "0.0.0.0";

console.log(`Starting Next.js on ${host}:${port}`);

const child = spawn("npx", ["next", "start", "-H", host, "-p", port], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
