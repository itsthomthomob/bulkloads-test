import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

import { SURFACE } from "@/theme";

/**
 * Vector tiles and fonts from OpenFreeMap: free, keyless, OpenMapTiles schema.
 * Only these tile requests leave the browser, and they carry nothing from the
 * tender beyond the area being looked at.
 */
const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FONT = ["Noto Sans Regular"];

const rule = (opacity: number) => `rgba(${SURFACE.rule}, ${opacity})`;

/** Darker than the land so coastlines read without adding a new hue. */
const WATER = "#060B14";

const NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:en"],
  ["get", "name"],
];

/**
 * A map drawn in the page's own palette. Land is the page background, so the
 * map reads as part of the surface rather than a picture set into it; borders
 * and roads are hairlines at the same weights as the UI's rules; labels are
 * small uppercase text like the overlines. The stop pins and route are the
 * only colour on it.
 */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    base: {
      type: "vector",
      url: TILES,
      attribution:
        '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · ' +
        '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · ' +
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": SURFACE.background },
    },
    {
      id: "water",
      type: "fill",
      source: "base",
      "source-layer": "water",
      paint: { "fill-color": WATER },
    },
    {
      id: "roads-major",
      type: "line",
      source: "base",
      "source-layer": "transportation",
      minzoom: 7,
      filter: ["in", ["get", "class"], ["literal", ["trunk", "primary"]]],
      paint: {
        "line-color": rule(0.12),
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 12, 1.5],
      },
    },
    {
      id: "roads-motorway",
      type: "line",
      source: "base",
      "source-layer": "transportation",
      minzoom: 4,
      filter: ["==", ["get", "class"], "motorway"],
      paint: {
        "line-color": rule(0.24),
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 2],
      },
    },
    {
      id: "boundary-state",
      type: "line",
      source: "base",
      "source-layer": "boundary",
      filter: [
        "all",
        ["==", ["get", "admin_level"], 4],
        ["!=", ["get", "maritime"], 1],
      ],
      paint: {
        "line-color": rule(0.32),
        "line-width": 0.75,
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "base",
      "source-layer": "boundary",
      filter: [
        "all",
        ["==", ["get", "admin_level"], 2],
        ["!=", ["get", "maritime"], 1],
      ],
      paint: { "line-color": rule(0.5), "line-width": 1 },
    },
    {
      id: "label-state",
      type: "symbol",
      source: "base",
      "source-layer": "place",
      maxzoom: 7,
      filter: ["==", ["get", "class"], "state"],
      layout: {
        "text-field": ["upcase", NAME],
        "text-font": FONT,
        "text-size": 10,
        "text-letter-spacing": 0.2,
      },
      paint: { "text-color": rule(0.45) },
    },
    {
      id: "label-city",
      type: "symbol",
      source: "base",
      "source-layer": "place",
      minzoom: 5,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": ["upcase", NAME],
        "text-font": FONT,
        "text-size": 10,
        "text-letter-spacing": 0.12,
        // Keep towns out until there is room for them.
        "symbol-sort-key": ["case", ["==", ["get", "class"], "city"], 0, 1],
      },
      paint: {
        "text-color": SURFACE.textSecondary,
        "text-halo-color": SURFACE.background,
        "text-halo-width": 1,
      },
    },
  ],
};
