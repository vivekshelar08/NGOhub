/**
 * Hostinger Node.js entry point — binds 0.0.0.0 and PORT from the environment.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (error) {
        console.error("Request error:", error);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }).listen(port, hostname, () => {
      console.log(`NGO Hub ready on http://${hostname}:${port} (NODE_ENV=${process.env.NODE_ENV})`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Next.js:", error);
    process.exit(1);
  });
