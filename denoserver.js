/**
 * A minimal static website server so
 * `deno run --allow-read --allow-net denoserver.js` opens
 * http://localhost:8000
 */
import { serveDir } from "jsr:@std/http/file-server";

Deno.serve((req) => serveDir(req));
