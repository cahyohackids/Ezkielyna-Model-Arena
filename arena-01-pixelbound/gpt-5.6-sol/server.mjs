import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const port = Number(process.env.PORT || 4271);
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^\//, "");
    const file = join(root, relative);
    if (!file.startsWith(root)) throw new Error("Invalid path");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }); response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`PIXELBOUND online at http://127.0.0.1:${port}`));
