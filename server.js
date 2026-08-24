import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json" };
createServer((request, response) => {
  const requestPath = request.url ? decodeURIComponent(request.url.split("?")[0]) : "/";
  const path = normalize(join(root, requestPath === "/" ? "index.html" : requestPath));
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) { response.writeHead(404); return response.end("Not found"); }
  response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
  createReadStream(path).pipe(response);
}).listen(Number(process.env.PORT) || 4173, () => console.log(`PharmaStock : http://localhost:${Number(process.env.PORT) || 4173}`));
