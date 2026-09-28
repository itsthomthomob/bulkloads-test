/**
 * Copies MapLibre's web worker into `public/maplibre/` so the browser can
 * load it from a real URL.
 *
 * MapLibre 6 finds its worker by resolving `./maplibre-gl-worker.mjs` against
 * its own module URL. Once bundled, that URL is a Next chunk with no worker
 * beside it, so the request 404s and no tiles draw. The worker also imports
 * `./maplibre-gl-shared.mjs`, so both files have to sit side by side.
 *
 * Runs before `dev` and `build`, so the copy always matches the installed
 * version. The output is gitignored.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const from = fileURLToPath(new URL("../node_modules/maplibre-gl/dist/", import.meta.url));
const to = fileURLToPath(new URL("../public/maplibre/", import.meta.url));

mkdirSync(to, { recursive: true });
for (const file of FILES) {
  copyFileSync(from + file, to + file);
}
console.log(`Copied MapLibre worker to ${to}`);
