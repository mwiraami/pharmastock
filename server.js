import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json" };
createServer((request, response) => {
  const path = normalize(join(root, request.url === "/" ? "index.html" : request.url.split("?")[0]));
  if (!path.startsWith(root) || !existsSync(path)) { response.writeHead(404); return response.end("Not found"); }
  response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-cache" });
  createReadStream(path).pipe(response);
}).listen(Number(process.env.PORT) || 4173, () => console.log(`PharmaStock : http://localhost:${Number(process.env.PORT) || 4173}`));
