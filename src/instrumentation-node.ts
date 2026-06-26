export function registerNodeInstrumentation() {
  process.on("unhandledRejection", (reason) => {
    console.error("[process] unhandledRejection:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("[process] uncaughtException:", error);
  });

  // Hostinger stops idle Node apps — self-ping every 4 minutes to stay warm.
  if (process.env.NODE_ENV === "production") {
    const port = process.env.PORT ?? "3000";
    const ping = () => {
      fetch(`http://127.0.0.1:${port}/api/live`, { signal: AbortSignal.timeout(5000) }).catch(
        () => {}
      );
    };
    setTimeout(ping, 30_000);
    setInterval(ping, 4 * 60 * 1000);
  }
}
