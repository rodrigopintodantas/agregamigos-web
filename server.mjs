import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist", "agregamigos-web", "browser");
const indexHtmlPath = path.join(distDir, "index.html");

const CRAWLER_UA =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot/i;

const port = Number(process.env.PORT ?? 4200);
const ogApiBase = String(process.env.OG_API_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function isSocialCrawler(userAgent) {
  return CRAWLER_UA.test(String(userAgent ?? ""));
}

function sendFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] ?? "application/octet-stream";
  res.writeHead(statusCode, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

function tryServeStatic(req, res) {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const candidate = path.normalize(path.join(distDir, relative));

  if (!candidate.startsWith(distDir)) {
    return false;
  }

  if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    return false;
  }

  sendFile(res, candidate);
  return true;
}

async function tryServeOgPreview(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const match = urlPath.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/link-cadastro\/?$/i);
  if (!match || !isSocialCrawler(req.headers["user-agent"])) {
    return false;
  }

  const slug = match[1].toLowerCase();
  const qs = (req.url ?? "").includes("?") ? (req.url ?? "").slice((req.url ?? "").indexOf("?")) : "";
  const ogUrl = `${ogApiBase}/og/link-cadastro/${encodeURIComponent(slug)}${qs}`;

  try {
    const upstream = await fetch(ogUrl, {
      headers: {
        "X-Forwarded-Host": req.headers.host ?? "",
        "X-Forwarded-Proto": "http",
      },
    });

    if (!upstream.ok) {
      return false;
    }

    const html = await upstream.text();
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(html);
    }
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  if (await tryServeOgPreview(req, res)) {
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && tryServeStatic(req, res)) {
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method Not Allowed");
    return;
  }

  if (fs.existsSync(indexHtmlPath)) {
    sendFile(res, indexHtmlPath);
    return;
  }

  res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Build do front ausente. Execute npm run build antes de npm run start:prod.");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`agregamigos-web em http://0.0.0.0:${port} (dist: ${distDir})`);
});
