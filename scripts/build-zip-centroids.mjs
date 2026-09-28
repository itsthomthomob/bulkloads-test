/**
 * Builds `public/data/zip-centroids.json` from the `us-zips` package, which
 * holds the centre of every US Census ZIP Code Tabulation Area.
 *
 * The package ships several formats and full-precision coordinates. The map
 * only needs one lookup, and a ZIP centroid is miles from the actual building
 * anyway, so two decimal places (about 1 km) keeps the table small enough to
 * serve as a static file and load in the browser.
 *
 * Run with `npm run data:zips` after updating `us-zips`.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const zips = require("us-zips");

const round = (value) => Math.round(value * 100) / 100;

const table = {};
for (const zip of Object.keys(zips).sort()) {
  const { latitude, longitude } = zips[zip];
  table[zip] = [round(latitude), round(longitude)];
}

const target = fileURLToPath(
  new URL("../public/data/zip-centroids.json", import.meta.url),
);
writeFileSync(target, JSON.stringify(table));
console.log(`Wrote ${Object.keys(table).length} ZIP centroids to ${target}`);
